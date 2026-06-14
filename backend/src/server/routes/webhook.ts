import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { verifyOneShotWebhook } from "../../security/ed25519.js";
import { db } from "../../db/client.js";
import { protectionEvents, permissionsRegistry } from "../../db/schema.js";
import { updateRelayStatus } from "../../db/queries/protectionEvents.js";
import { invalidateApproval } from "../../db/queries/approvalCache.js";
import { sseManager } from "../sse/sseManager.js";
import { eq, and, isNull, sql } from "drizzle-orm";
import { collectSuccessFee } from "../../payments/successFee.js";
import { logger } from "../../utils/logger.js";

// NOTE: For raw body access, Fastify must be configured with:
//   fastify.addContentTypeParser('application/json', { parseAs: 'string' }, ...)
// or use the rawBody plugin. The current setup passes rawBody via (request as any).rawBody

interface OneShotWebhookPayload {
  txHash: string;
  status: "confirmed" | "failed" | "pending";
  timestamp?: number;
  signature?: string;
  relayFee?: string;
  actualFee?: number;
}

export async function webhookRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  fastify.post<{ Body: OneShotWebhookPayload }>(
    "/webhooks/1shot",
    {
      schema: {
        body: {
          type: "object",
          required: ["txHash", "status"],
          properties: {
            txHash: { type: "string" },
            status: {
              type: "string",
              enum: ["confirmed", "failed", "pending"],
            },
            timestamp: { type: "number" },
            signature: { type: "string" },
            relayFee: { type: "string" },
            actualFee: { type: "number" },
          },
        },
      },
    },
    async (request, reply) => {
      const signatureHeader = request.headers["x-signature"] as string;
      const rawBody =
        (request as any).rawBody || "";

      // ── 1. Authenticate webhook using Ed25519 signature verification ──
      const isDemoBypass =
        process.env.DEMO_MODE === "true" &&
        signatureHeader === "demo_signature_bypass";

      if (!isDemoBypass) {
        const isProduction =
          process.env.NODE_ENV === "production" &&
          process.env.DEMO_MODE !== "true";

        let signatureValid = false;

        if (request.body.signature) {
          signatureValid = verifyOneShotWebhook(
            String(rawBody),
            request.body.signature.replace("0x", "")
          );
        } else if (signatureHeader) {
          signatureValid = verifyOneShotWebhook(
            String(rawBody),
            signatureHeader
          );
        }

        if (!signatureValid) {
          if (isProduction) {
            if (!process.env.ONESHOT_WEBHOOK_PUBLIC_KEY) {
              logger.error(
                "[WebhookHandler] ONESHOT_WEBHOOK_PUBLIC_KEY missing in production"
              );
            }
            logger.warn("[WebhookHandler] Rejected unsigned/invalid webhook");
            return reply.code(401).send({ error: "Invalid or missing signature" });
          }
          logger.warn(
            "[WebhookHandler] Processing unsigned webhook (non-production only)"
          );
        }
      }

      // ── 2. Replay attack prevention ───────────────────────────────────
      if (request.body.timestamp) {
        const age = Math.abs(
          Date.now() / 1000 - request.body.timestamp
        );
        if (age > 300) {
          logger.warn(
            `[WebhookHandler] Webhook expired (age: ${age.toFixed(0)}s)`
          );
          return reply
            .code(400)
            .send({ error: "Webhook expired" });
        }
      }

      const { status, txHash, relayFee = "0", actualFee } = request.body;
      logger.info(
        `[WebhookHandler] Received 1Shot callback: txHash=${txHash} status=${status}`
      );

      try {
        // ── 3. Find the protection event by txHash ──────────────────────
        const [event] = await db
          .select()
          .from(protectionEvents)
          .where(eq(protectionEvents.relayTxHash, txHash))
          .limit(1);

        if (!event) {
          logger.warn(
            `[WebhookHandler] No protection event found for txHash: ${txHash}`
          );
          return reply.send({
            received: true,
            warning: "EventNotFound",
          });
        }

        // ── 4. Update relay status in DB ────────────────────────────────
        if (status === "confirmed" || status === "failed") {
          await updateRelayStatus(txHash, status);
        }

        // ── 5. Handle confirmed status ──────────────────────────────────
        if (status === "confirmed") {
          let feeToDeduct = "0";
          if (actualFee) {
            feeToDeduct = Math.ceil(actualFee * 1_000_000).toString();
          } else if (relayFee && relayFee !== "0") {
            const parsed = parseFloat(relayFee);
            if (parsed > 0) {
              if (parsed < 1.0) {
                feeToDeduct = Math.ceil(parsed * 1_000_000).toString();
              } else {
                feeToDeduct = Math.ceil(parsed).toString();
              }
            }
          }

          if (feeToDeduct && feeToDeduct !== "0") {
            await db
              .update(permissionsRegistry)
              .set({
                budgetSpent: sql`${permissionsRegistry.budgetSpent} + ${feeToDeduct}`,
              })
              .where(
                and(
                  eq(
                    permissionsRegistry.userAddress,
                    event.userAddress.toLowerCase()
                  ),
                  isNull(permissionsRegistry.revokedAt)
                )
              );

            logger.info(
              `[WebhookHandler] Budget deducted for ${event.userAddress.slice(0, 8)}...: ${feeToDeduct}`
            );
          }

          // Invalidate approval cache
          await invalidateApproval(
            event.userAddress,
            event.spenderAddress,
            event.tokenAddress
          );

          // Collect success fee (1.5% of protected value)
          const feeResult = await collectSuccessFee(
            event.userAddress,
            event.exposedValue,
            event.id
          );

          // Emit real-time confirmation via SSE
          sseManager.sendEventToUser(
            event.userAddress,
            "PROTECTION_CONFIRMED",
            {
              eventId: event.id,
              txHash,
              tokenAddress: event.tokenAddress,
              spenderAddress: event.spenderAddress,
              amount: event.exposedValue,
              actualFee: actualFee || Number(relayFee) / 1_000_000,
              successFeeUsdc: feeResult.feeUsdc,
              successFeeCollected: feeResult.collected,
            }
          );

          logger.info(
            `[WebhookHandler] REVOCATION_CONFIRMED: user=${event.userAddress.slice(0, 8)}... txHash=${txHash.slice(0, 10)}...`
          );
        }

        // ── 6. Handle failed status ─────────────────────────────────────
        if (status === "failed") {
          sseManager.sendEventToUser(
            event.userAddress,
            "PROTECTION_FAILED",
            {
              eventId: event.id,
              txHash,
              error:
                "Relay transaction failed during on-chain execution",
            }
          );

          logger.error(
            `[WebhookHandler] REVOCATION_FAILED: txHash=${txHash}`
          );
        }

        return reply.code(200).send({ received: true });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        logger.error(
          `[WebhookHandler] Processing error: ${message}`
        );
        return reply.code(500).send({
          error: "WebhookProcessingError",
          message:
            "Internal error processing webhook callback logic",
        });
      }
    }
  );
}
