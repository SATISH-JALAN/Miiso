import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { getRecentScans } from "../../db/queries/scanLog.js";
import { logger } from "../../utils/logger.js";

export async function threatIntelRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get(
    "/scans",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 }
          }
        }
      }
    },
    async (request, reply) => {
      const { limit = 20 } = request.query as { limit?: number };

      try {
        const scans = await getRecentScans(limit);
        
        return reply.send({
          success: true,
          scans: scans.map(scan => ({
            id: scan.id,
            contractAddress: scan.contractAddress,
            bytecodeHash: scan.bytecodeHash,
            blockNumber: scan.blockNumber.toString(),
            vulnerable: scan.vulnerable,
            confidence: scan.confidence,
            verdict: JSON.parse(scan.verdict),
            staticRisk: scan.staticRisk,
            staticFlags: scan.staticFlags,
            createdAt: scan.createdAt.toISOString()
          }))
        });
      } catch (error: any) {
        logger.error("❌ Failed to fetch recent scan logs:", error);
        return reply.status(500).send({
          error: "DatabaseError",
          message: "Could not compile list of recent contract scans"
        });
      }
    }
  );
}
