import { publicClient } from "../blockchain/viemClient.js";
import { walletClient } from "../blockchain/walletClient.js";
import { erc20Abi, APPROVAL_REVOCATION_ENFORCER } from "../blockchain/contracts.js";
import { insertProtectionEvent } from "../db/queries/protectionEvents.js";
import { sseManager } from "../server/sse/sseManager.js";
import { encodeFunctionData, getAddress } from "viem";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const ONESHOT_RELAYER_URL = process.env.ONESHOT_RELAYER_URL || "https://relayer.1shotapi.com/rpc";
const isDemo = process.env.DEMO_MODE === "true";

interface RevocationRequest {
  userAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  exposedValue: string;
  permissionContext: string;
  delegationHash: string;
  severity?: "high" | "medium" | "low";
}

/**
 * Triggers a token revocation by submitting an ERC-7710 transaction payload to the 1Shot Relayer.
 * Handles DEMO_MODE local Anvil simulation.
 */
export async function executeRevocation(req: RevocationRequest) {
  const user = getAddress(req.userAddress);
  const token = getAddress(req.tokenAddress);
  const spender = getAddress(req.spenderAddress);
  const severity = req.severity || "high";

  logger.info(`🚨 Executor: Preparing EIP-7710 revocation for user ${user}, spender ${spender}, token ${token}`);

  // 1. Encode ERC-20 approve(spender, 0) calldata
  const callData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, 0n]
  });

  // Verify function selector and amount parameters locally before sending
  const selector = callData.substring(0, 10);
  if (selector !== "0x095ea7b3") {
    throw new Error("InvalidCalldataScope: Selector must be approve(address,uint256)");
  }

  let txHash = "";
  
  if (isDemo) {
    // ──── DEMO / ANVIL SIMULATION MODE ────
    logger.info("⚡ Executor (Demo Mode): Simulating EIP-7710 transaction submission on Anvil...");
    
    // Generate a mock tx hash
    const randomBytes = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
    txHash = "0x" + randomBytes.map(b => b.toString(16).padStart(2, "0")).join("");

    // Insert pending protection event in DB
    const event = await insertProtectionEvent({
      userAddress: user,
      tokenAddress: token,
      spenderAddress: spender,
      exposedValue: req.exposedValue,
      actionType: "revocation",
      relayTxHash: txHash,
      relayStatus: "pending",
      severity
    });

    // Notify client via SSE of pending protection trigger
    sseManager.sendEventToUser(user, "PROTECTION_PENDING", {
      eventId: event.id,
      tokenAddress: token,
      spenderAddress: spender,
      amount: req.exposedValue,
      txHash
    });

    // Trigger mock asynchronous webhook callback after 2 seconds to simulate network confirmation
    setTimeout(async () => {
      logger.info(`⚡ Executor (Demo Mode): Firing mock webhook confirmation for tx ${txHash}`);
      try {
        const port = process.env.PORT || 3000;
        const response = await fetch(`http://127.0.0.1:${port}/api/webhooks/1shot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Pass a mock signature that is bypassed in webhook parser in demo mode
            "X-Signature": "demo_signature_bypass"
          },
          body: JSON.stringify({
            status: "confirmed",
            txHash,
            relayFee: "1000" // 0.001 USDC relay fee simulation
          })
        });
        
        if (!response.ok) {
          logger.error(`❌ Executor (Demo Mode): Mock webhook trigger failed with status ${response.status}`);
        }
      } catch (err) {
        logger.error("❌ Executor (Demo Mode): Failed to connect to local webhook receiver:", err);
      }
    }, 2000);

    return event;
  } else {
    // ──── LIVE 1SHOT API PRODUCTION MODE ────
    logger.info("⚡ Executor: Dispatching EIP-7710 gas-relay call to 1Shot Relayer...");

    // Assemble delegation payload
    const delegationPayload = {
      delegationManager: APPROVAL_REVOCATION_ENFORCER, // Enforcer contract address
      permissionContext: req.permissionContext,
      delegationHash: req.delegationHash,
      execution: {
        target: token,
        value: "0",
        callData
      }
    };

    const feePayload = {
      feeToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      maxFee: "100000" // maximum fee limit in USDC wei scale ($0.10)
    };

    const webhookUrl = `https://${process.env.HOST_URL || "api.miiso.security"}/api/webhooks/1shot`;

    const rpcResponse = await fetch(ONESHOT_RELAYER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "relayer_send7710Transaction",
        params: [delegationPayload, feePayload, webhookUrl]
      })
    });

    if (!rpcResponse.ok) {
      const errorText = await rpcResponse.text();
      throw new Error(`1Shot Relayer RPC failed: ${rpcResponse.status} - ${errorText}`);
    }

    const rpcJson: any = await rpcResponse.json();
    if (rpcJson.error) {
      throw new Error(`1Shot Relayer returned RPC error: ${JSON.stringify(rpcJson.error)}`);
    }

    txHash = rpcJson.result.txHash;
    logger.info(`✅ Executor: 1Shot accepted transaction request. Relay TxHash: ${txHash}`);

    // Insert pending protection event in DB
    const event = await insertProtectionEvent({
      userAddress: user,
      tokenAddress: token,
      spenderAddress: spender,
      exposedValue: req.exposedValue,
      actionType: "revocation",
      relayTxHash: txHash,
      relayStatus: "pending",
      severity
    });

    // Send SSE event to notify dashboard that protection is pending
    sseManager.sendEventToUser(user, "PROTECTION_PENDING", {
      eventId: event.id,
      tokenAddress: token,
      spenderAddress: spender,
      amount: req.exposedValue,
      txHash
    });

    return event;
  }
}

/**
 * REST endpoint adapter for manual revocation triggers.
 */
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
    severity: "low" // Manual revokes are flagged as low severity
  });
}
