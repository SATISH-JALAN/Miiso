import { executeRevocation } from "../daemon/revocationExecutor.js";
import { payForRelay } from "../payments/x402Client.js";
import { getActivePermission } from "../db/queries/permissions.js";
import { logger } from "../utils/logger.js";
import type { AgentResult, ExecutorOutput } from "./types.js";

/**
 * Executor Agent: Wraps the revocation executor and x402 relay payment.
 * Called by the orchestrator after a Tier 1 or Tier 2 threat routing decision.
 */
export async function runExecutorAgent(
  userAddress: string,
  tokenAddress: string,
  spenderAddress: string,
  exposedValue: number
): Promise<AgentResult<ExecutorOutput>> {
  const start = Date.now();

  try {
    // Step 1: Pay for relay authorization via x402 USDC micro-payment
    const payment = await payForRelay();
    logger.info(
      `[ExecutorAgent] x402 relay payment txHash=${payment.txHash.slice(0, 10)} amount=$${payment.amountUsdc}`
    );

    // Step 2: Get user's active EIP-7710 delegation permission
    const permission = await getActivePermission(userAddress);
    if (!permission) {
      throw new Error(`No active permission for ${userAddress.slice(0, 8)}`);
    }

    // Step 3: Execute the revocation via 1Shot relayer
    const result = await executeRevocation({
      userAddress,
      tokenAddress,
      spenderAddress,
      exposedValue: exposedValue.toString(),
      permissionContext: permission.permissionContext,
      delegationHash: permission.delegationHash,
      severity: "high",
    });

    // Map the returned event object to our ExecutorOutput shape
    const txHash = result.relayTxHash || `0x_event_${result.id}`;
    const relayStatus = (result.relayStatus || "pending") as "pending" | "confirmed" | "failed";

    const costUsdc = payment.amountUsdc;

    logger.info(
      `[ExecutorAgent] Revocation fired user=${userAddress.slice(0, 8)} token=${tokenAddress.slice(0, 8)} txHash=${txHash.slice(0, 10)} totalCost=$${costUsdc.toFixed(4)}`
    );

    return {
      agentId: "executor",
      status: "success",
      output: {
        txHash,
        fee: costUsdc,
        relayStatus,
        executedAt: new Date().toISOString(),
      },
      costUsdc,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      `[ExecutorAgent] Failed for user=${userAddress.slice(0, 8)}: ${message}`
    );
    return {
      agentId: "executor",
      status: "error",
      output: null,
      costUsdc: 0,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}
