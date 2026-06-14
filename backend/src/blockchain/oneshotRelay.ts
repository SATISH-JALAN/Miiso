import { publicClient } from "./viemClient.js";
import { CHAIN_ID, CHAIN_ID_HEX } from "../config/chain.js";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const ONESHOT_RELAYER_URL =
  process.env.ONESHOT_RELAYER_URL || "https://relayer.1shotapi.com/rpc";

const GAS_ESTIMATE_UPGRADE = 65_000n;
const FEE_MULTIPLIER_NUM = 12n;
const FEE_MULTIPLIER_DEN = 10n;

export interface RelayerCapabilities {
  feeCollector: string;
  minFee: bigint;
  feeToken: string;
  feeUsdc: number;
  effectiveFee: bigint;
}

export interface Upgrade7702Payload {
  userAddress: `0x${string}`;
  authorizationList: Array<{
    chainId: number;
    address: `0x${string}`;
    nonce: number;
    yParity: number;
    r: `0x${string}`;
    s: `0x${string}`;
  }>;
}

async function jsonRpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(ONESHOT_RELAYER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });

  if (!response.ok) {
    throw new Error(`1Shot relayer HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    result?: T;
    error?: { message: string; code?: number };
  };

  if (json.error) {
    throw new Error(`1Shot RPC error: ${json.error.message}`);
  }

  return json.result as T;
}

/**
 * Fetches 1Shot relayer capabilities and computes the USDC fee for an upgrade tx.
 */
export async function getRelayerCapabilities(): Promise<RelayerCapabilities> {
  const capJson = await jsonRpc<{
    feeCollector: string;
    minFee: string;
    feeToken: string;
  }>("relayer_getCapabilities", []);

  const minFee = BigInt(capJson.minFee);
  const gasPrice = await publicClient.getGasPrice();
  const feeRaw =
    (GAS_ESTIMATE_UPGRADE * gasPrice * FEE_MULTIPLIER_NUM) /
    FEE_MULTIPLIER_DEN /
    1_000_000_000_000n;
  const effectiveFee = feeRaw > minFee ? feeRaw : minFee;

  return {
    feeCollector: capJson.feeCollector,
    minFee,
    feeToken: capJson.feeToken,
    feeUsdc: Number(effectiveFee) / 1_000_000,
    effectiveFee,
  };
}

/**
 * Submits an EIP-7702 smart-account upgrade through the 1Shot permissionless relayer.
 */
export async function submit7702Upgrade(
  payload: Upgrade7702Payload,
  caps: RelayerCapabilities
): Promise<{ txHash: string; feeUsdc: number }> {
  const baseParams = {
    authorizationList: payload.authorizationList.map((a) => ({
      chainId: a.chainId,
      address: a.address,
      nonce: a.nonce,
      yParity: a.yParity,
      r: a.r,
      s: a.s,
    })),
    to: payload.userAddress,
    data: "0x",
    value: "0x0",
    chainId: CHAIN_ID_HEX,
    feeToken: caps.feeCollector,
    maxFee: caps.effectiveFee.toString(),
  };

  const methods = ["relayer_send7702Transaction", "relayer_sendTransaction"] as const;

  for (const method of methods) {
    try {
      logger.info(`[1Shot] Submitting EIP-7702 upgrade via ${method}...`);
      const result = await jsonRpc<{ txHash: string }>(method, [baseParams]);
      const txHash = result?.txHash;
      if (!txHash) throw new Error("No txHash in relayer response");

      logger.info(
        `[1Shot] Upgrade accepted. tx=${txHash.slice(0, 10)}... fee=$${caps.feeUsdc.toFixed(4)}`
      );
      return { txHash, feeUsdc: caps.feeUsdc };
    } catch (err) {
      logger.warn(`[1Shot] ${method} failed:`, err);
      if (method === methods[methods.length - 1]) throw err;
    }
  }

  throw new Error("1Shot relayer rejected upgrade transaction");
}

export { ONESHOT_RELAYER_URL, CHAIN_ID };
