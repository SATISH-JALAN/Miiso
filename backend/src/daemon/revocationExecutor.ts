import { publicClient } from "../blockchain/viemClient.js";
import { agentAccount } from "../blockchain/walletClient.js";
import { erc20Abi, APPROVAL_REVOCATION_ENFORCER } from "../blockchain/contracts.js";
import {
  pollRelayerTaskStatus,
  ONESHOT_RELAYER_URL,
} from "../blockchain/oneshotRelay.js";
import { insertProtectionEvent } from "../db/queries/protectionEvents.js";
import { sseManager } from "../server/sse/sseManager.js";
import { encodeFunctionData, getAddress } from "viem";
import { CHAIN_ID } from "../config/chain.js";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const isDemo = process.env.DEMO_MODE === "true";
const WEBHOOK_URL =
  process.env.PUBLIC_WEBHOOK_URL ||
  `http://127.0.0.1:${process.env.PORT || 3001}/api/webhooks/1shot`;
const DEFAULT_FEE_USDC = 10_000n;

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

interface DelegationCaveat {
  enforcer: string;
  terms: string;
  args?: string;
}

interface ParsedPermissionContext {
  delegate?: string;
  delegator?: string;
  authority?: string;
  caveats?: DelegationCaveat[];
  salt?: string;
  signature?: string;
}

function buildPermissionContextEntry(
  parsed: ParsedPermissionContext,
  userAddress: string
) {
  const caveats = (parsed.caveats ?? []).map((c) => ({
    enforcer: c.enforcer,
    terms: c.terms || "0x",
    args: c.args || "0x",
  }));

  if (caveats.length === 0) {
    caveats.push({
      enforcer: APPROVAL_REVOCATION_ENFORCER,
      terms: "0x",
      args: "0x",
    });
  }

  return {
    delegate: parsed.delegate || agentAccount.address,
    delegator: userAddress,
    authority:
      parsed.authority ||
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    caveats,
    salt: parsed.salt || "0x01",
    signature: parsed.signature || "0x",
  };
}

async function fetchChainCapabilities(): Promise<{
  feeCollector: string;
  effectiveFee: bigint;
}> {
  const response = await fetch(ONESHOT_RELAYER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "relayer_getCapabilities",
      params: [String(CHAIN_ID)],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const capJson = (await response.json()) as {
    result?: Record<
      string,
      { feeCollector: string; tokens?: Array<{ address: string }> }
    >;
    error?: { message: string };
  };

  if (capJson.error) {
    throw new Error(capJson.error.message);
  }

  const chainCaps = capJson.result?.[String(CHAIN_ID)];
  if (!chainCaps?.feeCollector) {
    throw new Error(`No capabilities for chain ${CHAIN_ID}`);
  }

  const minFee = DEFAULT_FEE_USDC;
  const gasEstimate = 65_000n;
  const gasPrice = await publicClient.getGasPrice();
  const feeRaw = (gasEstimate * gasPrice * 11n) / 10n / 1_000_000_000_000n;
  const effectiveFee = feeRaw > minFee ? feeRaw : minFee;

  return { feeCollector: chainCaps.feeCollector, effectiveFee };
}

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

  const callData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, 0n],
  });

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
  let feeUsdc = 0.01;

  if (isDemo) {
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
    await fetchChainCapabilities().catch(() => {
      throw new Error("1Shot relayer unreachable");
    });

    let parsedContext: ParsedPermissionContext = {};
    try {
      parsedContext = JSON.parse(req.permissionContext) as ParsedPermissionContext;
    } catch {
      throw new Error("Invalid permissionContext — expected signed delegation JSON");
    }

    if (!parsedContext.signature) {
      throw new Error("permissionContext missing delegation signature from setup");
    }

    const permissionEntry = buildPermissionContextEntry(parsedContext, user);

    logger.info(
      "[RevocationExecutor] Dispatching EIP-7710 gas-relay call to 1Shot Relayer..."
    );

    const rpcResponse = await fetch(ONESHOT_RELAYER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "relayer_send7710Transaction",
        params: {
          chainId: String(CHAIN_ID),
          transactions: [
            {
              permissionContext: [permissionEntry],
              executions: [
                {
                  target: token,
                  value: "0x0",
                  data: callData,
                },
              ],
            },
          ],
          destinationUrl: WEBHOOK_URL,
        },
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
      result?: { txHash?: string; taskId?: string };
      error?: { message: string };
    };

    if (rpcJson.error) {
      throw new Error(
        `1Shot Relayer RPC error: ${JSON.stringify(rpcJson.error)}`
      );
    }

    if (rpcJson.result?.txHash) {
      txHash = rpcJson.result.txHash;
    } else if (rpcJson.result?.taskId) {
      logger.info(
        `[RevocationExecutor] 1Shot accepted taskId=${rpcJson.result.taskId}, polling status...`
      );
      try {
        const polled = await pollRelayerTaskStatus(rpcJson.result.taskId);
        txHash = polled.txHash;
      } catch (pollErr) {
        logger.warn(
          `[RevocationExecutor] Poll timed out for taskId=${rpcJson.result.taskId}, webhook will confirm:`,
          pollErr
        );
        txHash = `pending:${rpcJson.result.taskId}`;
      }
    } else {
      throw new Error("1Shot relayer returned neither txHash nor taskId");
    }

    feeUsdc = Number(DEFAULT_FEE_USDC) / 1_000_000;
    logger.info(
      `[RevocationExecutor] 1Shot accepted. TxHash: ${txHash.slice(0, 10)}...`
    );
  }

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

  sseManager.sendEventToUser(user, "PROTECTION_PENDING", {
    eventId: event.id,
    tokenAddress: token,
    spenderAddress: spender,
    amount: req.exposedValue,
    txHash,
  });

  if (isDemo) {
    setTimeout(async () => {
      logger.info(
        `[RevocationExecutor] DEMO: Firing mock webhook for tx ${txHash}`
      );
      try {
        const port = process.env.PORT || 3001;
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

  return event;
}

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
