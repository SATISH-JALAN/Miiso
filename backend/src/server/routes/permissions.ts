import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { createPermission } from "../../db/queries/permissions.js";
import { logger } from "../../utils/logger.js";

interface PermissionsRequestBody {
  userAddress: string;
  permissionContext: string;
  delegationHash: string;
  sessionSignerAddress: string;
  budgetCap: string;
  expiry: number; // Unix timestamp in seconds
}

export async function permissionsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.post<{ Body: PermissionsRequestBody }>(
    "/permissions",
    {
      schema: {
        body: {
          type: "object",
          required: ["userAddress", "permissionContext", "delegationHash", "sessionSignerAddress", "budgetCap", "expiry"],
          properties: {
            userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            permissionContext: { type: "string" },
            delegationHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
            sessionSignerAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            budgetCap: { type: "string" },
            expiry: { type: "integer" }
          }
        }
      }
    },
    async (request, reply) => {
      const { userAddress, permissionContext, delegationHash, sessionSignerAddress, budgetCap, expiry } = request.body;
      
      try {
        const expiryDate = new Date(expiry * 1000);
        
        logger.info(`📝 Registering new permission for user ${userAddress}`, {
          sessionSignerAddress,
          budgetCap,
          expiryDate: expiryDate.toISOString()
        });

        const permission = await createPermission({
          userAddress,
          permissionContext,
          delegationHash,
          sessionSignerAddress,
          budgetCap,
          expiry: expiryDate
        });

        return reply.status(201).send({
          success: true,
          permission: {
            id: permission.id,
            userAddress: permission.userAddress,
            delegationHash: permission.delegationHash,
            budgetCap: permission.budgetCap,
            expiry: permission.expiry
          }
        });
      } catch (error: any) {
        logger.error("❌ Failed to register permissions:", error);
        return reply.status(500).send({
          error: "DatabaseError",
          message: "Could not persist permissions registry entry"
        });
      }
    }
  );
}
