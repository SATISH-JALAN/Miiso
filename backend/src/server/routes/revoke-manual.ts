import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { getActivePermission } from "../../db/queries/permissions.js";
import { queueManualRevocation } from "../../daemon/revocationExecutor.js";
import { logger } from "../../utils/logger.js";

interface RevokeManualBody {
  userAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  exposedValue: string; // BigInt wei representation as string
}

export async function revokeManualRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.post<{ Body: RevokeManualBody }>(
    "/revoke/manual",
    {
      schema: {
        body: {
          type: "object",
          required: ["userAddress", "tokenAddress", "spenderAddress", "exposedValue"],
          properties: {
            userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            tokenAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            spenderAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            exposedValue: { type: "string" }
          }
        }
      }
    },
    async (request, reply) => {
      const { userAddress, tokenAddress, spenderAddress, exposedValue } = request.body;

      try {
        // 1. Verify user has active on-chain delegation permissions with Miiso
        const permission = await getActivePermission(userAddress);
        if (!permission) {
          return reply.status(400).send({
            error: "NoActiveDelegation",
            message: "User has no active security delegation registered with Miiso"
          });
        }

        logger.info(`🚨 Manual Revocation triggered by user: ${userAddress} for token ${tokenAddress} / spender ${spenderAddress}`);

        // 2. Queue the manual revocation via the revocation executor
        const protectionEvent = await queueManualRevocation({
          userAddress,
          tokenAddress,
          spenderAddress,
          exposedValue,
          permissionContext: permission.permissionContext,
          delegationHash: permission.delegationHash
        });

        return reply.status(202).send({
          success: true,
          eventId: protectionEvent.id,
          message: "Manual revocation submitted to relayer queue",
          relayTxHash: protectionEvent.relayTxHash
        });
      } catch (error: any) {
        logger.error(`❌ Failed to queue manual revocation for ${userAddress}:`, error);
        return reply.status(500).send({
          error: "ExecutionError",
          message: error.message || "Failed to execute manual revocation transaction"
        });
      }
    }
  );
}
