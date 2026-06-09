import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { getEventsByUser } from "../../db/queries/protectionEvents.js";
import { logger } from "../../utils/logger.js";

interface HistoryRequestQuery {
  page?: number;
  limit?: number;
}

export async function historyRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get<{ Params: { address: string }; Querystring: HistoryRequestQuery }>(
    "/history/:address",
    {
      schema: {
        params: {
          type: "object",
          required: ["address"],
          properties: {
            address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" }
          }
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 }
          }
        }
      }
    },
    async (request, reply) => {
      const { address } = request.params;
      const { page = 1, limit = 20 } = request.query;

      try {
        const events = await getEventsByUser(address, page, limit);
        return reply.send({
          success: true,
          page,
          limit,
          events: events.map(event => ({
            id: event.id,
            userAddress: event.userAddress,
            tokenAddress: event.tokenAddress,
            spenderAddress: event.spenderAddress,
            exposedValue: event.exposedValue,
            actionType: event.actionType,
            relayTxHash: event.relayTxHash,
            relayStatus: event.relayStatus,
            severity: event.severity,
            vetoCancelled: event.vetoCancelled,
            stagedUntil: event.stagedUntil ? event.stagedUntil.toISOString() : null,
            createdAt: event.createdAt.toISOString(),
            explainer: event.explainer,
            confidence: event.confidence,
            staticFlags: event.staticFlags,
            staticRisk: event.staticRisk
          }))
        });
      } catch (error: any) {
        logger.error(`❌ Failed to fetch history for ${address}:`, error);
        return reply.status(500).send({
          error: "DatabaseError",
          message: "Could not retrieve protection event log history"
        });
      }
    }
  );
}
