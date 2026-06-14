import { FastifyInstance, FastifyPluginOptions } from "fastify";

import { createPermission, updateSecurityProfile, getActivePermission, revokePermission, updateFeeAllowance } from "../../db/queries/permissions.js";

import { setUserWhitelist, getUserWhitelist } from "../../db/queries/userWhitelist.js";

import { scanUserApprovals } from "../../blockchain/approvalScanner.js";

import { sseManager } from "../sse/sseManager.js";

import { logger } from "../../utils/logger.js";



interface PermissionsRequestBody {

  userAddress: string;

  permissionContext: string;

  delegationHash: string;

  sessionSignerAddress: string;

  budgetCap: string;

  expiry: number;

  grantMethod?: "erc7715" | "signed_delegation";

  feeAllowanceApproved?: boolean;

  whitelistAddresses?: string[];

}



interface UpdateProfileRequestBody {

  userAddress: string;

  securityProfile: 'safe' | 'balanced' | 'manual';

}



export async function permissionsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {

  // POST /permissions — register new ERC-7715 delegation

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

            expiry: { type: "integer" },

            grantMethod: { type: "string", enum: ["erc7715", "signed_delegation"] },

            feeAllowanceApproved: { type: "boolean" },

            whitelistAddresses: {

              type: "array",

              items: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" }

            }

          }

        }

      }

    },

    async (request, reply) => {

      const {

        userAddress,

        permissionContext,

        delegationHash,

        sessionSignerAddress,

        budgetCap,

        expiry,

        grantMethod,

        feeAllowanceApproved,

        whitelistAddresses = [],

      } = request.body;

      try {

        const expiryDate = new Date(expiry * 1000);

        logger.info(`📝 Registering new permission for user ${userAddress}`, {

          sessionSignerAddress,

          budgetCap,

          grantMethod,

          feeAllowanceApproved,

          whitelistCount: whitelistAddresses.length,

          expiryDate: expiryDate.toISOString(),

        });



        const permission = await createPermission({

          userAddress,

          permissionContext,

          delegationHash,

          sessionSignerAddress,

          budgetCap,

          expiry: expiryDate,

          grantMethod,

          feeAllowanceApproved,

        });



        if (whitelistAddresses.length > 0) {

          await setUserWhitelist(userAddress, whitelistAddresses);

        }



        // Populate approval cache in background so threat routing can find affected users

        scanUserApprovals(userAddress).catch((err) => {

          logger.error(`❌ Background approval scan failed for ${userAddress}:`, err);

        });



        return reply.status(201).send({

          success: true,

          permission: {

            id: permission.id,

            userAddress: permission.userAddress,

            delegationHash: permission.delegationHash,

            budgetCap: permission.budgetCap,

            expiry: permission.expiry,

            grantMethod: permission.grantMethod,

            feeAllowanceApproved: permission.feeAllowanceApproved,

          }

        });

      } catch (error: any) {

        logger.error("❌ Failed to register permissions:", error);

        return reply.status(500).send({ error: "DatabaseError", message: "Could not persist permissions registry entry" });

      }

    }

  );



  // GET /permissions/:address — retrieve active permission

  fastify.get<{ Params: { address: string } }>(

    "/permissions/:address",

    {

      schema: {

        params: {

          type: "object", required: ["address"],

          properties: { address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } }

        }

      }

    },

    async (request, reply) => {

      const { address } = request.params;

      try {

        const permission = await getActivePermission(address);

        if (!permission) {

          return reply.status(404).send({ error: "NotFound", message: "No active delegation permission found for this address" });

        }



        const userWhitelistAddresses = await getUserWhitelist(address);



        return reply.send({

          success: true,

          permission: {

            id: permission.id,

            userAddress: permission.userAddress,

            delegationHash: permission.delegationHash,

            budgetCap: permission.budgetCap,

            budgetSpent: permission.budgetSpent,

            securityProfile: permission.securityProfile,

            grantMethod: permission.grantMethod,

            feeAllowanceApproved: permission.feeAllowanceApproved,

            whitelistAddresses: userWhitelistAddresses,

            expiry: permission.expiry

          }

        });

      } catch (error: any) {

        logger.error(`❌ Failed to retrieve active permission for ${address}:`, error);

        return reply.status(500).send({ error: "DatabaseError", message: "Failed to retrieve permission status" });

      }

    }

  );



  // DELETE /permissions/:address — revoke delegation permission

  fastify.delete<{ Params: { address: string } }>(

    "/permissions/:address",

    {

      schema: {

        params: {

          type: "object", required: ["address"],

          properties: { address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } }

        }

      }

    },

    async (request, reply) => {

      const { address } = request.params;

      try {

        const permission = await getActivePermission(address);

        if (!permission) {

          return reply.status(404).send({ error: "NotFound", message: "No active delegation permission found to revoke" });

        }



        await revokePermission(address);

        logger.info(`🔒 Permission revoked for user ${address}`);



        // On-chain disableDelegation would go here in production:

        // if (process.env.DEMO_MODE !== "true") {

        //   await walletClient.writeContract({ ... disableDelegation ... });

        // }



        sseManager.sendEventToUser(address, "PERMISSION_REVOKED", {

          userAddress: address, message: "Delegation permission has been revoked"

        });



        return reply.send({ success: true, message: "Permission revoked successfully" });

      } catch (error: any) {

        logger.error(`❌ Failed to revoke permission for ${address}:`, error);

        return reply.status(500).send({ error: "DatabaseError", message: "Failed to revoke delegation permission" });

      }

    }

  );



  // POST /permissions/profile — update security strategy

  fastify.post<{ Body: UpdateProfileRequestBody }>(

    "/permissions/profile",

    {

      schema: {

        body: {

          type: "object", required: ["userAddress", "securityProfile"],

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

          return reply.status(404).send({ error: "NotFound", message: "No active session permission found to update strategy profile" });

        }

        logger.info(`⚙️ Updated security strategy profile to '${securityProfile}' for ${userAddress}`);

        return reply.send({ success: true, permission: { userAddress: updated.userAddress, securityProfile: updated.securityProfile } });

      } catch (error: any) {

        logger.error(`❌ Failed to update security profile for ${userAddress}:`, error);

        return reply.status(500).send({ error: "DatabaseError", message: "Failed to modify security strategy profile settings" });

      }

    }

  );



  // POST /permissions/:address/fee-allowance — mark success fee USDC approval
  fastify.post<{ Params: { address: string }; Body: { approved: boolean } }>(
    "/permissions/:address/fee-allowance",
    {
      schema: {
        params: {
          type: "object",
          required: ["address"],
          properties: { address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } }
        },
        body: {
          type: "object",
          required: ["approved"],
          properties: { approved: { type: "boolean" } }
        }
      }
    },
    async (request, reply) => {
      const { address } = request.params;
      const { approved } = request.body;

      try {
        const updated = await updateFeeAllowance(address, approved);
        if (!updated) {
          return reply.status(404).send({ error: "NotFound", message: "No active permission found" });
        }
        return reply.send({ success: true, feeAllowanceApproved: updated.feeAllowanceApproved });
      } catch (error: unknown) {
        logger.error(`❌ Failed to update fee allowance for ${address}:`, error);
        return reply.status(500).send({ error: "DatabaseError", message: "Failed to update fee allowance" });
      }
    }
  );

  // PUT /permissions/:address/whitelist — update user trusted protocols
  fastify.put<{ Params: { address: string }; Body: { addresses: string[] } }>(

    "/permissions/:address/whitelist",

    {

      schema: {

        params: {

          type: "object",

          required: ["address"],

          properties: { address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } }

        },

        body: {

          type: "object",

          required: ["addresses"],

          properties: {

            addresses: {

              type: "array",

              items: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" }

            }

          }

        }

      }

    },

    async (request, reply) => {

      const { address } = request.params;

      const { addresses } = request.body;



      try {

        const permission = await getActivePermission(address);

        if (!permission) {

          return reply.status(404).send({ error: "NotFound", message: "No active permission found" });

        }



        await setUserWhitelist(address, addresses);

        return reply.send({ success: true, whitelistAddresses: addresses });

      } catch (error: unknown) {

        logger.error(`❌ Failed to update whitelist for ${address}:`, error);

        return reply.status(500).send({ error: "DatabaseError", message: "Failed to update whitelist" });

      }

    }

  );

}

