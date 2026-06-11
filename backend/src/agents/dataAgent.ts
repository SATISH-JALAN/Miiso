import { publicClient } from "../blockchain/viemClient.js";
import { USDC_ADDRESS, erc20Abi } from "../blockchain/contracts.js";
import { logger } from "../utils/logger.js";
import { parseAbiItem } from "viem";
import type { AgentResult, DataOutput } from "./types.js";

/**
 * Data Agent: Collects on-chain exposure data — how many wallets have
 * interacted with a contract, estimated TVL at risk via USDC balance.
 */
export async function runDataAgent(
  contractAddress: string
): Promise<AgentResult<DataOutput>> {
  const start = Date.now();

  try {
    // 10-second timeout guard
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DataAgent timeout after 10s")), 10_000)
    );

    const resultPromise = fetchContractExposure(contractAddress);

    const output = await Promise.race([resultPromise, timeoutPromise]).catch(
      (err) => {
        logger.warn(
          `[DataAgent] Timeout or error for ${contractAddress.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`
        );
        return null;
      }
    );

    if (!output) {
      return {
        agentId: "data",
        status: "timeout",
        output: null,
        costUsdc: 0,
        durationMs: Date.now() - start,
      };
    }

    logger.info(
      `[DataAgent] ${contractAddress.slice(0, 8)} wallets=${output.exposedWallets.length} tvl=$${output.totalTVLAtRisk.toFixed(2)}`
    );

    return {
      agentId: "data",
      status: "success",
      output,
      costUsdc: 0,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[DataAgent] Failed for ${contractAddress.slice(0, 8)}: ${message}`);
    return {
      agentId: "data",
      status: "error",
      output: null,
      costUsdc: 0,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}

/**
 * Internal: Fetches Transfer logs and USDC balance to build the exposure dataset.
 */
async function fetchContractExposure(
  contractAddress: string
): Promise<DataOutput> {
  const isDemo = process.env.DEMO_MODE === "true";
  if (isDemo) {
    return {
      exposedWallets: [],
      totalTVLAtRisk: 0,
      contractAgeMs: 3600000, // 1 hour
      hasLiquidity: false,
    };
  }

  const currentBlock = await publicClient.getBlockNumber();

  // Fetch Transfer event logs in 2 chunks of 500 blocks to stay within RPC limits
  const transferEvent = parseAbiItem(
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  );

  const fromBlock1 = currentBlock > 1000n ? currentBlock - 1000n : 0n;
  const toBlock1 = currentBlock > 501n ? currentBlock - 501n : 0n;
  const fromBlock2 = currentBlock > 500n ? currentBlock - 500n : 0n;

  const [chunk1, chunk2] = await Promise.all([
    publicClient.getLogs({
      address: contractAddress as `0x${string}`,
      event: transferEvent,
      fromBlock: fromBlock1,
      toBlock: toBlock1,
    }),
    publicClient.getLogs({
      address: contractAddress as `0x${string}`,
      event: transferEvent,
      fromBlock: fromBlock2,
      toBlock: currentBlock,
    }),
  ]);

  const allLogs = [...chunk1, ...chunk2];

  // Extract unique sender addresses (deduplicated, max 500)
  const exposedWallets = [
    ...new Set(
      allLogs
        .map((log) => log.args.from)
        .filter(
          (addr): addr is `0x${string}` =>
            !!addr &&
            addr !== "0x0000000000000000000000000000000000000000"
        )
    ),
  ].slice(0, 500) as string[];

  // Get USDC balance held by the contract (TVL proxy)
  let totalTVLAtRisk = 0;
  try {
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [contractAddress as `0x${string}`],
    });
    totalTVLAtRisk = Number(usdcBalance) / 1_000_000;
  } catch {
    // Contract may not hold USDC — that's fine, TVL stays 0
    logger.debug(`[DataAgent] USDC balanceOf failed for ${contractAddress.slice(0, 8)}, assuming $0 TVL`);
  }

  // Estimate contract age from the oldest block in our scan window
  let contractAgeMs = 0;
  try {
    const deployBlock = await publicClient.getBlock({
      blockNumber: fromBlock1,
    });
    contractAgeMs = Date.now() - Number(deployBlock.timestamp) * 1000;
  } catch {
    // If block retrieval fails, leave age at 0
  }

  return {
    exposedWallets,
    totalTVLAtRisk,
    contractAgeMs,
    hasLiquidity: totalTVLAtRisk > 0,
  };
}
