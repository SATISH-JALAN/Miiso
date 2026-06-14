import { publicClient } from "../blockchain/viemClient.js";
import { walletClient, agentAccount } from "../blockchain/walletClient.js";
import { erc20Abi, APPROVAL_REVOCATION_ENFORCER } from "../blockchain/contracts.js";
import { getActivePermission } from "../db/queries/permissions.js";
import { insertProtectionEvent } from "../db/queries/protectionEvents.js";
import { sseManager } from "../server/sse/sseManager.js";
import { encodeFunctionData, getAddress } from "viem";
import { CHAIN_ID, CHAIN_ID_HEX } from "../config/chain.js";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const ONESHOT_RELAYER_URL =
  process.env.ONESHOT_RELAYER_URL || "https://relayer.1shotapi.com/rpc";
const isDemo = process.env.DEMO_MODE === "true";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RevocationRequest {
  userAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  exposedValue: string;
  permissionContext: string;
  delegationHash: string;
  severity?: "high" | "medium" | "low";
}

export interface RevocationResult {
  txHash: string;
  fee: number;
  relayStatus: "pending" | "confirmed" | "failed";
  executedAt: string;
  errorMessage?: string;
}

// ── Main executor (RevocationRequest object interface) ───────────────────────

/**
 * Triggers a token revocation by submitting an ERC-7710 transaction payload
 * to the 1Shot Relayer. Handles DEMO_MODE local Anvil simulation.
 *
 * Budget is NOT deducted here — it is deducted in the webhook handler
 * (webhook.ts) AFTER 1Shot confirms the transaction, since feeRaw is
 * an estimate and the actual confirmed fee may differ slightly.
 */
export async function executeRevocation(req: RevocationRequest) {
  const user = getAddress(req.userAddress);
  const token = getAddress(req.tokenAddress);
  const spender = getAddress(req.spenderAddress);
  const severity = req.severity || "high";

  logger.info(
    `[RevocationExecutor] Preparing EIP-7710 revocation: user=${user.slice(0, 8)}... token=${token.slice(0, 8)}... spender=${spender.slice(0, 8)}...`
  );

  // ── Step 3: Build calldata ────────────────────────────────────────────
  const callData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, 0n],
  });

  // ── Step 4: Local pre-validation (CRITICAL) ───────────────────────────
  const selector = callData.substring(0, 10);
  if (selector !== "0x095ea7b3") {
    throw new Error(
      "Calldata pre-validation failed — selector must be approve(address,uint256)"
    );
  }
  if (
    !callData.endsWith(
      "0000000000000000000000000000000000000000000000000000000000000000"
    )
  ) {
    throw new Error(
      "Calldata pre-validation failed — amount must be zero"
    );
  }

  let txHash = "";
  let feeUsdc = 0.01; // Default estimate

  if (isDemo) {
    // ──── DEMO / ANVIL SIMULATION MODE ────────────────────────────────
    // Skip Steps 1, 7, 8 — no real 1Shot calls
    logger.info(
      "[RevocationExecutor] DEMO MODE: Simulating EIP-7710 transaction..."
    );

    const randomBytes = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
    );
    txHash =
      "0xdemo_revocation_" +
      randomBytes
        .slice(0, 8)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    feeUsdc = 0.01;
  } else {
    // ──── LIVE 1SHOT API PRODUCTION MODE ──────────────────────────────

    // Step 1: Get relayer capabilities
    let feeCollector: string;
    let minFee: bigint;

    try {
      const capResponse = await fetch(ONESHOT_RELAYER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "relayer_getCapabilities",
          params: [],
          id: 1,
        }),
      });

      if (!capResponse.ok) {
        throw new Error(`HTTP ${capResponse.status}`);
      }

      const capJson = (await capResponse.json()) as {
        result: { feeCollector: string; minFee: string; feeToken: string };
      };
      feeCollector = capJson.result.feeCollector;
      minFee = BigInt(capJson.result.minFee);
    } catch (err) {
      throw new Error("1Shot relayer unreachable");
    }

    // Step 2: Estimate gas and calculate fee
    const gasEstimate = 65_000n;
    const gasPrice = await publicClient.getGasPrice();
    const rate = 11n; // 1.1x as integer math (multiply by 11, divide by 10)
    const feeRaw =
      (gasEstimate * gasPrice * rate) / 10n / 1_000_000_000_000n;
    const effectiveFee = feeRaw > minFee ? feeRaw : minFee;
    feeUsdc = Number(effectiveFee) / 1_000_000;

    // Step 6: Build ERC-7710 delegation payload
    let parsedContext: Record<string, unknown> = {};
    try {
      parsedContext = JSON.parse(req.permissionContext) as Record<string, unknown>;
    } catch {
      // If permissionContext isn't JSON, use it as-is
    }

    const delegationPayload = {
      delegate: agentAccount.address,
      delegator: user,
      authority: parsedContext.authority || req.permissionContext,
      caveats: parsedContext.caveats || [],
      salt: parsedContext.salt || "0x0",
      signature: parsedContext.signature || "0x",
    };

    // Step 7: Sign the transaction with agent EOA
    const signedPayload = await walletClient.signMessage({
      account: agentAccount,
      message: JSON.stringify({
        delegation: delegationPayload,
        calldata: callData,
        to: token,
        value: "0x0",
        chainId: CHAIN_ID,
      }),
    });

    // Step 8: Submit to 1Shot
    logger.info(
      "[RevocationExecutor] Dispatching EIP-7710 gas-relay call to 1Shot Relayer..."
    );

    const rpcResponse = await fetch(ONESHOT_RELAYER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "relayer_send7710Transaction",
        params: [
          {
            delegation: delegationPayload,
            calldata: callData,
            to: token,
            value: "0x0",
            chainId: CHAIN_ID_HEX,
            feeToken: feeCollector,
            maxFee: effectiveFee.toString(),
            signature: signedPayload,
          },
        ],
        id: 2,
      }),
    });

    if (!rpcResponse.ok) {
      const errorText = await rpcResponse.text();
      throw new Error(
        `1Shot Relayer RPC failed: ${rpcResponse.status} - ${errorText}`
      );
    }

    const rpcJson = (await rpcResponse.json()) as {
      result?: { txHash: string };
      error?: { message: string };
    };
    if (rpcJson.error) {
      throw new Error(
        `1Shot Relayer RPC error: ${JSON.stringify(rpcJson.error)}`
      );
    }

    txHash = rpcJson.result?.txHash || "";
    logger.info(
      `[RevocationExecutor] 1Shot accepted. TxHash: ${txHash.slice(0, 10)}...`
    );
  }

  // ── Step 9: Insert protection event to DB ──────────────────────────
  const event = await insertProtectionEvent({
    userAddress: user,
    tokenAddress: token,
    spenderAddress: spender,
    exposedValue: req.exposedValue,
    actionType: "revocation",
    relayTxHash: txHash,
    relayStatus: "pending",
    severity,
  });

  // ── Step 10: Notify client via SSE ─────────────────────────────────
  sseManager.sendEventToUser(user, "PROTECTION_PENDING", {
    eventId: event.id,
    tokenAddress: token,
    spenderAddress: spender,
    amount: req.exposedValue,
    txHash,
  });

  // In demo mode, fire a mock webhook callback after 2 seconds
  if (isDemo) {
    setTimeout(async () => {
      logger.info(
        `[RevocationExecutor] DEMO: Firing mock webhook for tx ${txHash}`
      );
      try {
        const port = process.env.PORT || 3000;
        await fetch(`http://127.0.0.1:${port}/api/webhooks/1shot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Signature": "demo_signature_bypass",
          },
          body: JSON.stringify({
            status: "confirmed",
            txHash,
            relayFee: "1000",
          }),
        });
      } catch (err) {
        logger.error(
          "[RevocationExecutor] DEMO: Mock webhook trigger failed:",
          err
        );
      }
    }, 2000);
  }

  logger.info(
    `[RevocationExecutor] Complete: user=${user.slice(0, 8)}... txHash=${txHash.slice(0, 10)}... fee=$${feeUsdc.toFixed(4)}`
  );

  // NOTE: Budget deduction happens in webhook.ts AFTER 1Shot confirms
  return event;
}

// ── Convenience wrapper for manual revocation triggers ───────────────────────

export async function queueManualRevocation(req: {
  userAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  exposedValue: string;
  permissionContext: string;
  delegationHash: string;
}) {
  return await executeRevocation({
    ...req,
    severity: "low",
  });
}
