import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { sseManager } from "../sse/sseManager.js";
import { logger } from "../../utils/logger.js";

export async function eventsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get<{ Params: { address: string } }>(
    "/events/:address",
    {
      schema: {
        params: {
          type: "object",
          required: ["address"],
          properties: {
            address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" }
          }
        }
      }
    },
    async (request, reply) => {
      const { address } = request.params;
      
      logger.info(`🔌 SSE: New connection request from client for user address: ${address}`);
      
      // Register with SSE manager. It sets SSE headers, manages connection pool
      // and binds to response close event.
      sseManager.register(address, reply);
      
      // Return the reply directly - Fastify expects us to manage raw response output
      // when we send custom status headers and use writeHead/write manually.
      await reply;
    }
  );
}
