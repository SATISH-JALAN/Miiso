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

      // x402 SIWE gating — in production, verify SIWE bearer token
      // In DEMO_MODE, bypass authentication
      if (process.env.DEMO_MODE !== "true") {
        const authHeader = request.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return reply.status(402).send({
            error: "PaymentRequired",
            message: "x402 SIWE authentication required for B2B threat intel access",
            paymentRequired: {
              network: "Base",
              chainId: 8453,
              tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              minimumTopUp: "1.000000"
            }
          });
        }
        // In a full implementation, validate the SIWE bearer token here
        // For hackathon: any bearer token passes (just checks presence)
      }

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
