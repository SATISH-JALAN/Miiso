import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { db } from "../../db/client.js";
import { permissionsRegistry, approvalCache, protectionEvents } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";

interface SeedWalletRequestBody {
  userAddress: string;
}

export async function seedWalletRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.post<{ Body: SeedWalletRequestBody }>(
    "/dev/seed-wallet",
    {
      schema: {
        body: {
          type: "object",
          required: ["userAddress"],
          properties: {
            userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" }
          }
        }
      }
    },
    async (request, reply) => {
      const { userAddress } = request.body;
      const normalizedUser = userAddress.toLowerCase();

      try {
        logger.info(`🌱 Dev seeding wallet data for address: ${normalizedUser}`);

        // 1. Create permission registry
        await db
          .insert(permissionsRegistry)
          .values({
            userAddress: normalizedUser,
            permissionContext: "0x1234567890abcdef",
            delegationHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            sessionSignerAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8".toLowerCase(),
            budgetCap: "100000000",
            budgetSpent: "0",
            expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          })
          .onConflictDoNothing();

        // 2. Insert active approvals
        await db
          .insert(approvalCache)
          .values([
            {
              userAddress: normalizedUser,
              tokenAddress: "0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913".toLowerCase(), // USDC
              spenderAddress: "0x88e6A0c2dDD26FEEb64F039a2c41296fcB3f5640".toLowerCase(),
              allowance: "50000000", // $50 USDC
              lastScannedBlock: 12000000n,
              updatedAt: new Date()
            },
            {
              userAddress: normalizedUser,
              tokenAddress: "0x4200000000000000000000000000000000000006".toLowerCase(), // WETH
              spenderAddress: "0x9488a0b0b0000000000000000000000000000099".toLowerCase(),
              allowance: "1500000000000000000", // 1.5 WETH
              lastScannedBlock: 12000000n,
              updatedAt: new Date()
            }
          ])
          .onConflictDoNothing();

        // 3. Insert historical protection events
        await db
          .insert(protectionEvents)
          .values([
            {
              userAddress: normalizedUser,
              tokenAddress: "0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913".toLowerCase(),
              spenderAddress: "0x6666666666666666666666666666666666666666".toLowerCase(),
              exposedValue: "1500000000", // $1500 USDC saved
              actionType: "revocation",
              relayTxHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
              relayStatus: "confirmed",
              severity: "high",
              createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
            },
            {
              userAddress: normalizedUser,
              tokenAddress: "0x4200000000000000000000000000000000000006".toLowerCase(),
              spenderAddress: "0x7777777777777777777777777777777777777777".toLowerCase(),
              exposedValue: "2000000000000000000", // 2.0 ETH
              actionType: "veto",
              relayTxHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
              relayStatus: "confirmed",
              severity: "medium",
              stagedUntil: new Date(Date.now() - 5 * 24 * 60 * 1000),
              createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
            }
          ])
          .onConflictDoNothing();

        return reply.status(200).send({
          success: true,
          message: `Wallet ${normalizedUser} successfully seeded with demo mock data.`
        });
      } catch (err: any) {
        logger.error(`❌ Dev seeding failed for wallet ${normalizedUser}:`, err);
        return reply.status(500).send({
          error: "DatabaseError",
          message: err.message || "Failed to seed mock values"
        });
      }
    }
  );
}
