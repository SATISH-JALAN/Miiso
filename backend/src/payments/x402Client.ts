import { walletClient, agentAccount } from "../blockchain/walletClient.js";
import { USDC_ADDRESS, VENICE_VAULT } from "../blockchain/contracts.js";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const isDemo = process.env.DEMO_MODE === "true";

const RELAY_VAULT = (process.env.ONESHOT_VAULT_ADDRESS ||
  (() => {
    logger.warn("[x402Client] ONESHOT_VAULT_ADDRESS not set — using placeholder vault address");
    return "0x0000000000000000000000000000000000000001";
  })()) as `0x${string}`;

// ERC-20 transfer ABI fragment
const transferAbi = [
  {
    name: "transfer" as const,
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "to" as const, type: "address" as const },
      { name: "amount" as const, type: "uint256" as const },
    ],
    outputs: [{ name: "" as const, type: "bool" as const }],
  },
] as const;

/**
 * Pays Venice AI for LLM inference via USDC micro-payment.
 * Cost formula: estimatedTokens * $0.00000038 per token.
 */
export async function payForInference(
  estimatedTokens: number
): Promise<{ txHash: string; amountUsdc: number }> {
  // Calculate raw USDC amount (6 decimals) — minimum 1 unit ($0.000001)
  const amountRaw = Math.max(
    1,
    Math.ceil(estimatedTokens * 0.00000038 * 1_000_000)
  );
  const amountUsdc = amountRaw / 1_000_000;

  if (isDemo) {
    logger.info(
      `[x402Client] DEMO: Inference payment skipped — amount=$${amountUsdc.toFixed(6)}`
    );
    return { txHash: "0xdemo_inference_payment", amountUsdc };
  }

  try {
    const txHash = await walletClient.writeContract({
      account: agentAccount,
      address: USDC_ADDRESS as `0x${string}`,
      abi: transferAbi,
      functionName: "transfer",
      args: [VENICE_VAULT as `0x${string}`, BigInt(amountRaw)],
    });

    logger.info(
      `[x402Client] Inference payment sent txHash=${txHash.slice(0, 10)} amount=$${amountUsdc.toFixed(6)}`
    );
    return { txHash, amountUsdc };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[x402Client] Inference payment failed: ${message}`);
    throw err;
  }
}

/**
 * Pays 1Shot relay for EIP-7710 gas execution via USDC flat fee.
 * Flat cost: $0.01 USDC = 10,000 raw units.
 */
export async function payForRelay(): Promise<{
  txHash: string;
  amountUsdc: number;
}> {
  const amountRaw = 10_000; // $0.01 USDC
  const amountUsdc = 0.01;

  if (isDemo) {
    logger.info(
      `[x402Client] DEMO: Relay payment skipped — amount=$${amountUsdc.toFixed(4)}`
    );
    return { txHash: "0xdemo_relay_payment", amountUsdc };
  }

  try {
    const txHash = await walletClient.writeContract({
      account: agentAccount,
      address: USDC_ADDRESS as `0x${string}`,
      abi: transferAbi,
      functionName: "transfer",
      args: [RELAY_VAULT, BigInt(amountRaw)],
    });

    logger.info(
      `[x402Client] Relay payment sent txHash=${txHash.slice(0, 10)} amount=$${amountUsdc.toFixed(4)}`
    );
    return { txHash, amountUsdc };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[x402Client] Relay payment failed: ${message}`);
    throw err;
  }
}
