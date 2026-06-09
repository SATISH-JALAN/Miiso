import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { db } from "../../db/client.js";
import { protectionEvents } from "../../db/schema.js";
import { cancelVeto } from "../../db/queries/protectionEvents.js";
import { sseManager } from "../sse/sseManager.js";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";

export async function vetoRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.post<{ Params: { eventId: string } }>(
    "/veto/:eventId",
    {
      schema: {
        params: {
          type: "object",
          required: ["eventId"],
          properties: {
            eventId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { eventId } = request.params;

      try {
        // 1. Fetch the protection event details
        const [event] = await db
          .select()
          .from(protectionEvents)
          .where(eq(protectionEvents.id, eventId))
          .limit(1);

        if (!event) {
          return reply.status(404).send({
            error: "EventNotFound",
            message: "The protection event ID does not exist"
          });
        }

        // 2. Validate veto conditions
        if (!event.stagedUntil) {
          return reply.status(400).send({
            error: "NotVetoable",
            message: "This event was executed immediately (Tier 1) and cannot be vetoed"
          });
        }

        if (event.vetoCancelled) {
          return reply.status(400).send({
            error: "AlreadyVetoed",
            message: "This protection action has already been vetoed"
          });
        }

        const now = new Date();
        const vetoExpiry = new Date(event.stagedUntil);
        if (now > vetoExpiry) {
          return reply.status(400).send({
            error: "VetoWindowExpired",
            message: "The 60-second veto window has already closed"
          });
        }

        // 3. Mark veto as cancelled in the database
        await cancelVeto(eventId);
        logger.info(`🚫 Veto confirmed by user for event ${eventId} (User: ${event.userAddress})`);

        // 4. Dispatch SSE cancellation alert to the frontend client
        sseManager.sendEventToUser(event.userAddress, "VETO_CONFIRMED", {
          eventId,
          message: "Auto-revocation cancelled by user veto"
        });

        return reply.send({
          success: true,
          message: "Protection action successfully vetoed and cancelled"
        });
      } catch (error: any) {
        logger.error(`❌ Failed to process veto for event ${eventId}:`, error);
        return reply.status(500).send({
          error: "VetoProcessingError",
          message: "An error occurred while canceling the scheduled protection action"
        });
      }
    }
  );
}
