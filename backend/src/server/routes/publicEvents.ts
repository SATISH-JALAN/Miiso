import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { sseManager } from "../sse/sseManager.js";
import { logger } from "../../utils/logger.js";

/**
 * Public SSE endpoint — no wallet address required.
 * Streams live CLEAN_SCAN events to the landing page terminal.
 * Replays the last 50 scans from the ring buffer on connect.
 */
export async function publicEventsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get(
    "/events/public",
    async (request, reply) => {
      logger.info(`🔌 SSE: New public connection request (landing page terminal)`);
      sseManager.registerPublic(reply);
      await reply;
    }
  );
}
