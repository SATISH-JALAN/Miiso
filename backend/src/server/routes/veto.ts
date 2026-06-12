import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { db } from "../../db/client.js";
import { protectionEvents } from "../../db/schema.js";
import { cancelVeto } from "../../db/queries/protectionEvents.js";
import { getActivePermission } from "../../db/queries/permissions.js";
import { sseManager } from "../sse/sseManager.js";
import { stagedTimers } from "../../daemon/confidenceRouter.js";
import { executeRevocation } from "../../daemon/revocationExecutor.js";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../../utils/logger.js";

export async function vetoRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  fastify.post<{ Params: { eventId: string } }>(
    "/veto/:eventId",
    {
      schema: {
        params: {
          type: "object",
          required: ["eventId"],
          properties: {
            eventId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const { eventId } = request.params;

      try {
        // 1. Find event in protection_events by eventId where relay_status = 'staged' or 'pending'
        const [event] = await db
          .select()
          .from(protectionEvents)
          .where(eq(protectionEvents.id, eventId))
          .limit(1);

        if (!event || (event.relayStatus !== "staged" && event.relayStatus !== "pending")) {
          logger.warn(`[VetoHandler] Event ${eventId} not found or already executed/cancelled`);
          return reply.status(404).send({
            error: "EventNotFound",
            message: "Event not found or already executed",
          });
        }

        // 3. Check staged_until: if new Date() > event.staged_until → reply.code(409).send({ error: 'Veto window expired — revocation already fired' })
        if (event.stagedUntil) {
          const now = new Date();
          const vetoExpiry = new Date(event.stagedUntil);
          if (now > vetoExpiry) {
            logger.warn(`[VetoHandler] Veto window expired for event ${eventId}`);
            return reply.status(409).send({
              error: "VetoWindowExpired",
              message: "Veto window expired — revocation already fired",
            });
          }
        }

        // 4. Call cancelVeto(eventId) from db/queries/protectionEvents.ts (sets status = 'cancelled', veto_cancelled = true)
        // We set status to failed/cancelled directly in DB as part of vetoing
        await db
          .update(protectionEvents)
          .set({ vetoCancelled: true, relayStatus: "failed" })
          .where(eq(protectionEvents.id, eventId));

        await cancelVeto(eventId);

        logger.info(`🚫 [VetoHandler] Veto confirmed by user for event ${eventId} (User: ${event.userAddress})`);

        // 5. Clear the in-memory setTimeout for this eventId
        if (stagedTimers.has(eventId)) {
          clearTimeout(stagedTimers.get(eventId));
          stagedTimers.delete(eventId);
          logger.info(`[VetoHandler] Cleared in-memory staged timer for event ${eventId}`);
        }

        // 6. Emit NOTIFY miiso_events: { type: 'VETO_CONFIRMED', userAddress: event.userAddress, eventId }
        await db.execute(
          sql`NOTIFY miiso_events, ${JSON.stringify({
            type: "VETO_CONFIRMED",
            userAddress: event.userAddress,
            eventId,
          })}`
        );

        // Also emit via SSE for real-time UI updates
        sseManager.sendEventToUser(event.userAddress, "VETO_CONFIRMED", {
          eventId,
          message: "Auto-revocation cancelled by user veto",
        });

        // 7. reply.code(200).send({ cancelled: true, eventId })
        return reply.code(200).send({ cancelled: true, eventId });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`❌ [VetoHandler] Failed to process veto for event ${eventId}:`, error);
        return reply.code(500).send({
          error: "VetoProcessingError",
          message: "An error occurred while canceling the scheduled protection action",
        });
      }
    }
  );

  fastify.post<{ Params: { eventId: string } }>(
    "/veto/execute/:eventId",
    {
      schema: {
        params: {
          type: "object",
          required: ["eventId"],
          properties: {
            eventId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const { eventId } = request.params;

      try {
        const [event] = await db
          .select()
          .from(protectionEvents)
          .where(eq(protectionEvents.id, eventId))
          .limit(1);

        if (!event || (event.relayStatus !== "staged" && event.relayStatus !== "pending")) {
          logger.warn(`[VetoExecute] Event ${eventId} not found or already executed/cancelled`);
          return reply.status(404).send({
            error: "EventNotFound",
            message: "Event not found or already executed",
          });
        }

        if (event.vetoCancelled) {
          return reply.status(409).send({
            error: "AlreadyVetoed",
            message: "This event was already vetoed and cannot be executed.",
          });
        }

        logger.info(`🔥 [VetoExecute] Immediate execution triggered for event ${eventId} (User: ${event.userAddress})`);

        // Clear the in-memory timer
        if (stagedTimers.has(eventId)) {
          clearTimeout(stagedTimers.get(eventId));
          stagedTimers.delete(eventId);
          logger.info(`[VetoExecute] Cleared in-memory staged timer for event ${eventId}`);
        }

        const permission = await getActivePermission(event.userAddress);
        if (!permission) {
          logger.error(`❌ [VetoExecute] Cannot execute. User ${event.userAddress} revoked Miiso delegation permissions.`);
          return reply.status(403).send({ error: "NoPermission", message: "User revoked delegation" });
        }

        await executeRevocation({
          userAddress: event.userAddress,
          tokenAddress: event.tokenAddress,
          spenderAddress: event.spenderAddress,
          exposedValue: event.exposedValue,
          permissionContext: permission.permissionContext,
          delegationHash: permission.delegationHash,
          severity: event.severity as "medium" | "high"
        });

        return reply.code(200).send({ executed: true, eventId });
      } catch (error: unknown) {
        logger.error(`❌ [VetoExecute] Failed to immediately execute event ${eventId}:`, error);
        return reply.code(500).send({
          error: "ExecutionError",
          message: "An error occurred while executing the scheduled protection action",
        });
      }
    }
  );
}
