import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { createPermission, updateSecurityProfile, getActivePermission } from "../../db/queries/permissions.js";
import { logger } from "../../utils/logger.js";

interface PermissionsRequestBody {
  userAddress: string;
  permissionContext: string;
  delegationHash: string;
  sessionSignerAddress: string;
  budgetCap: string;
  expiry: number; // Unix timestamp in seconds
}

interface UpdateProfileRequestBody {
  userAddress: string;
  securityProfile: 'safe' | 'balanced' | 'manual';
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

  fastify.get<{ Params: { address: string } }>(
    "/permissions/:address",
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
        const permission = await getActivePermission(address);
        if (!permission) {
          return reply.status(404).send({
            error: "NotFound",
            message: "No active delegation permission found for this address"
          });
        }
        return reply.send({
          success: true,
          permission: {
            id: permission.id,
            userAddress: permission.userAddress,
            budgetCap: permission.budgetCap,
            budgetSpent: permission.budgetSpent,
            securityProfile: permission.securityProfile,
            expiry: permission.expiry
          }
        });
      } catch (error: any) {
        logger.error(`❌ Failed to retrieve active permission for ${address}:`, error);
        return reply.status(500).send({
          error: "DatabaseError",
          message: "Failed to retrieve permission status"
        });
      }
    }
  );

  fastify.post<{ Body: UpdateProfileRequestBody }>(
    "/permissions/profile",
    {
      schema: {
        body: {
          type: "object",
          required: ["userAddress", "securityProfile"],
          properties: {
            userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            securityProfile: { type: "string", enum: ["safe", "balanced", "manual"] }
          }
        }
      }
    },
    async (request, reply) => {
      const { userAddress, securityProfile } = request.body;
      try {
        const updated = await updateSecurityProfile(userAddress, securityProfile);
        if (!updated) {
          return reply.status(404).send({
            error: "NotFound",
            message: "No active session permission found to update strategy profile"
          });
        }
        logger.info(`⚙️ Updated security strategy profile to '${securityProfile}' for ${userAddress}`);
        return reply.send({
          success: true,
          permission: {
            userAddress: updated.userAddress,
            securityProfile: updated.securityProfile
          }
        });
      } catch (error: any) {
        logger.error(`❌ Failed to update security profile for ${userAddress}:`, error);
        return reply.status(500).send({
          error: "DatabaseError",
          message: "Failed to modify security strategy profile settings"
        });
      }
    }
  );
}
