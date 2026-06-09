import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { scanUserApprovals } from "../../blockchain/approvalScanner.js";
import { logger } from "../../utils/logger.js";

export async function approvalsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get<{ Params: { address: string } }>(
    "/approvals/:address",
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
        logger.info(`🔍 Scanning approvals on-chain for user: ${address}`);
        const approvals = await scanUserApprovals(address);
        
        return reply.send({
          success: true,
          approvals
        });
      } catch (error: any) {
        logger.error(`❌ Failed to scan active approvals for ${address}:`, error);
        return reply.status(500).send({
          error: "ScannerError",
          message: "Failed to scan historical or active approvals from blockchain logs"
        });
      }
    }
  );
}
