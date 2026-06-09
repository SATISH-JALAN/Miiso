import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { getActivePermission } from "../../db/queries/permissions.js";
import { executeRevocation } from "../../daemon/revocationExecutor.js";
import { logger } from "../../utils/logger.js";

interface BatchRevokeApproval {
  tokenAddress: string;
  spenderAddress: string;
  exposedValue: string;
}

interface RevokeBatchBody {
  userAddress: string;
  approvals: BatchRevokeApproval[];
}

export async function revokeBatchRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.post<{ Body: RevokeBatchBody }>(
    "/revoke/batch",
    {
      schema: {
        body: {
          type: "object",
          required: ["userAddress", "approvals"],
          properties: {
            userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            approvals: {
              type: "array",
              items: {
                type: "object",
                required: ["tokenAddress", "spenderAddress", "exposedValue"],
                properties: {
                  tokenAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  spenderAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  exposedValue: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { userAddress, approvals } = request.body;

      try {
        // 1. Verify user has active on-chain delegation permissions with Miiso
        const permission = await getActivePermission(userAddress);
        if (!permission) {
          return reply.status(400).send({
            error: "NoActiveDelegation",
            message: "User has no active security delegation registered with Miiso"
          });
        }

        logger.info(`🚨 Batch Revocation triggered by user: ${userAddress} for ${approvals.length} approvals.`);

        const eventIds: string[] = [];
        const txHashes: string[] = [];

        // 2. Loop and trigger EIP-7710/1Shot transaction for each target
        for (const item of approvals) {
          try {
            const protectionEvent = await executeRevocation({
              userAddress,
              tokenAddress: item.tokenAddress,
              spenderAddress: item.spenderAddress,
              exposedValue: item.exposedValue,
              permissionContext: permission.permissionContext,
              delegationHash: permission.delegationHash,
              severity: "low"
            });
            eventIds.push(protectionEvent.id);
            if (protectionEvent.relayTxHash) {
              txHashes.push(protectionEvent.relayTxHash);
            }
          } catch (itemErr: any) {
            logger.error(`❌ Batch: Individual revocation failed for token ${item.tokenAddress} / spender ${item.spenderAddress}:`, itemErr);
          }
        }

        return reply.status(202).send({
          success: true,
          eventIds,
          txHashes,
          message: `Batch revocation queued successfully. Processed ${eventIds.length} of ${approvals.length} requests.`
        });
      } catch (error: any) {
        logger.error(`❌ Failed to execute batch revocation for ${userAddress}:`, error);
        return reply.status(500).send({
          error: "ExecutionError",
          message: error.message || "Failed to execute batch revocation transactions"
        });
      }
    }
  );
}
