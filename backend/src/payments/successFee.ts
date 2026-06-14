import { walletClient, agentAccount } from "../blockchain/walletClient.js";
import { logger } from "../utils/logger.js";
import { encodeFunctionData, keccak256, toBytes } from "viem";
import dotenv from "dotenv";

dotenv.config();

const SUCCESS_FEE_HOOK = process.env.SUCCESS_FEE_HOOK as `0x${string}` | undefined;
const SUCCESS_FEE_RATE = parseFloat(process.env.SUCCESS_FEE_RATE || "0.015");
const MAX_FEE_USDC = 500;

const feeHookAbi = [
  {
    name: "collectFee",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_user", type: "address" },
      { name: "_protectedValueUsdc", type: "uint256" },
      { name: "_protectionEventId", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export interface SuccessFeeResult {
  collected: boolean;
  feeUsdc: number;
  txHash?: string;
  error?: string;
}

/**
 * Collects the success fee after a confirmed protection event.
 */
export async function collectSuccessFee(
  userAddress: string,
  exposedValueRaw: string,
  protectionEventId: string
): Promise<SuccessFeeResult> {
  if (!SUCCESS_FEE_HOOK || SUCCESS_FEE_HOOK === "0x0000000000000000000000000000000000000000") {
    logger.warn("[SuccessFee] SUCCESS_FEE_HOOK not configured — skipping fee collection");
    return { collected: false, feeUsdc: 0, error: "hook_not_configured" };
  }

  if (process.env.DEMO_MODE === "true") {
    const protectedUsdc = Number(exposedValueRaw) / 1_000_000;
    const feeUsdc = Math.min(protectedUsdc * SUCCESS_FEE_RATE, MAX_FEE_USDC);
    logger.info(`[SuccessFee] DEMO MODE: would collect $${feeUsdc.toFixed(2)} from ${userAddress.slice(0, 8)}`);
    return { collected: true, feeUsdc, txHash: "0xdemo_success_fee" };
  }

  try {
    const protectedValueUsdc = BigInt(exposedValueRaw);
    if (protectedValueUsdc === 0n) {
      return { collected: false, feeUsdc: 0, error: "zero_protected_value" };
    }

    const feeUsdcFloat =
      (Number(protectedValueUsdc) / 1_000_000) * SUCCESS_FEE_RATE;
    const feeUsdc = Math.min(feeUsdcFloat, MAX_FEE_USDC);

    const eventIdBytes = keccak256(toBytes(protectionEventId)) as `0x${string}`;

    const calldata = encodeFunctionData({
      abi: feeHookAbi,
      functionName: "collectFee",
      args: [userAddress as `0x${string}`, protectedValueUsdc, eventIdBytes],
    });

    const txHash = await walletClient.sendTransaction({
      account: agentAccount,
      to: SUCCESS_FEE_HOOK,
      data: calldata,
      value: 0n,
    });

    logger.info(
      `[SuccessFee] Collected $${feeUsdc.toFixed(2)} from ${userAddress.slice(0, 8)} tx=${txHash.slice(0, 10)}`
    );

    return { collected: true, feeUsdc, txHash };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[SuccessFee] Failed to collect fee: ${message}`);
    return { collected: false, feeUsdc: 0, error: message };
  }
}
