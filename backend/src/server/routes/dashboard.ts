import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { getDashboardStats } from "../../db/queries/protectionEvents.js";
import { logger } from "../../utils/logger.js";

export async function dashboardRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get<{ Params: { address: string } }>(
    "/dashboard/:address",
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

      try {
        const stats = await getDashboardStats(address);
        
        return reply.send({
          success: true,
          stats
        });
      } catch (error: any) {
        logger.error(`❌ Failed to fetch dashboard metrics for ${address}:`, error);
        return reply.status(500).send({
          error: "DatabaseError",
          message: "Could not compile user dashboard statistics"
        });
      }
    }
  );
}
