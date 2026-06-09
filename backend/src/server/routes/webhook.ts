import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { verifyOneShotWebhook } from "../../security/ed25519.js";
import { db } from "../../db/client.js";
import { protectionEvents, permissionsRegistry } from "../../db/schema.js";
import { updateRelayStatus } from "../../db/queries/protectionEvents.js";
import { invalidateApproval } from "../../db/queries/approvalCache.js";
import { sseManager } from "../sse/sseManager.js";
import { eq, and, isNull, sql } from "drizzle-orm";
import { logger } from "../../utils/logger.js";

interface OneShotWebhookPayload {
  status: "confirmed" | "failed";
  txHash: string;
  relayFee?: string; // Wei-scale fee spent by the 1Shot relayer
}

export async function webhookRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.post<{ Body: OneShotWebhookPayload }>(
    "/webhooks/1shot",
    async (request, reply) => {
      const signatureHeader = request.headers["x-signature"] as string;
      const rawBody = (request as any).rawBody || "";

      // 1. Authenticate webhook using Ed25519 signature verification
      const isDemoBypass = process.env.DEMO_MODE === "true" && signatureHeader === "demo_signature_bypass";
      if (!isDemoBypass && (!signatureHeader || !verifyOneShotWebhook(rawBody, signatureHeader))) {
        logger.warn("⚠️ Webhook: Received unsigned or invalid signature webhook payload");
        return reply.status(401).send({
          error: "Unauthorized",
          message: "Ed25519 webhook signature validation failed"
        });
      }

      const { status, txHash, relayFee = "0" } = request.body;
      logger.info(`🔔 Webhook: Received 1Shot callback for tx ${txHash}. Status: ${status}`);

      try {
        // 2. Fetch the corresponding protection event from DB
        const [event] = await db
          .select()
          .from(protectionEvents)
          .where(eq(protectionEvents.relayTxHash, txHash))
          .limit(1);

        if (!event) {
          logger.warn(`⚠️ Webhook: No protection event found matching txHash: ${txHash}`);
          // Return 200 to acknowledge receipt to 1Shot relayer even if missing locally
          return reply.send({ success: true, warning: "EventNotFound" });
        }

        // 3. Process status update
        if (status === "confirmed") {
          // Update event status to confirmed in DB
          await updateRelayStatus(txHash, "confirmed");

          // Calculate fee deduction: 1.5% success fee + 1Shot relay fee
          const exposedValue = BigInt(event.exposedValue);
          const feeUSDC = (exposedValue * 15n) / 1000n; // 1.5%
          const relayerCost = BigInt(relayFee);
          const totalCost = feeUSDC + relayerCost;

          // Asynchronously deduct budget spent in the permissions_registry
          await db
            .update(permissionsRegistry)
            .set({
              budgetSpent: sql`${permissionsRegistry.budgetSpent} + ${totalCost.toString()}`
            })
            .where(
              and(
                eq(permissionsRegistry.userAddress, event.userAddress.toLowerCase()),
                isNull(permissionsRegistry.revokedAt)
              )
            );

          logger.info(`💸 Webhook: Budget updated for user ${event.userAddress}. Deducted total cost: ${totalCost.toString()} (1.5% Fee: ${feeUSDC}, Relayer: ${relayerCost})`);

          // Invalidate/zero the approval cache so the dashboard doesn't display stale revoked approval
          await invalidateApproval(event.userAddress, event.spenderAddress, event.tokenAddress);
          logger.info(`🧹 Webhook: Approval cache invalidated for user ${event.userAddress}, spender ${event.spenderAddress}`);

          // Emit real-time confirmation alert to browser client via SSE
          sseManager.sendEventToUser(event.userAddress, "PROTECTION_CONFIRMED", {
            eventId: event.id,
            txHash,
            tokenAddress: event.tokenAddress,
            spenderAddress: event.spenderAddress,
            amount: event.exposedValue
          });

        } else if (status === "failed") {
          // Update event status to failed
          await updateRelayStatus(txHash, "failed");

          logger.warn(`❌ Webhook: Transaction execution failed on-chain for tx: ${txHash}`);

          // Emit failure alert to client
          sseManager.sendEventToUser(event.userAddress, "PROTECTION_FAILED", {
            eventId: event.id,
            txHash,
            error: "Relay transaction failed during on-chain execution"
          });
        }

        return reply.send({ success: true });
      } catch (error: any) {
        logger.error(`❌ Webhook: Failed to process webhook status callback:`, error);
        return reply.status(500).send({
          error: "WebhookProcessingError",
          message: "Internal error processing webhook callback logic"
        });
      }
    }
  );
}
