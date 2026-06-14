import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { db } from "../../db/client.js";
import { permissionsRegistry, approvalCache, protectionEvents, contractScanLog, whitelist } from "../../db/schema.js";
import { loadWhitelist } from "../../security/whitelist.js";
import { loadUserWhitelists } from "../../db/queries/userWhitelist.js";
import { logger } from "../../utils/logger.js";

interface SeedWalletRequestBody {
  userAddress: string;
  budgetCap?: number;
  whitelistAddresses?: string[];
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
            userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            budgetCap: { type: "number" },
            whitelistAddresses: {
              type: "array",
              items: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { userAddress, budgetCap = 100, whitelistAddresses = [] } = request.body;
      const normalizedUser = userAddress.toLowerCase();

      try {
        logger.info(`🌱 Dev seeding wallet data for address: ${normalizedUser} with budget: ${budgetCap} WETH and ${whitelistAddresses.length} custom whitelist addresses`);

        // Convert budgetCap to WETH equivalent in wei (assuming budgetCap is in WETH)
        const budgetCapWei = (budgetCap * 1e18).toString();

        // 1. Create permission registry
        await db
          .insert(permissionsRegistry)
          .values({
            userAddress: normalizedUser,
            permissionContext: "0x1234567890abcdef",
            delegationHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            sessionSignerAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8".toLowerCase(),
            budgetCap: budgetCapWei,
            budgetSpent: "0",
            securityProfile: "balanced",
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
              spenderAddress: "0x9488a0b0b0000000000000000000000000000099".toLowerCase(), // Malicious Spender
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

        // 4. Seed contract scans with Venice AI explanations
        await db
          .insert(contractScanLog)
          .values([
            {
              contractAddress: "0x6666666666666666666666666666666666666666".toLowerCase(),
              bytecodeHash: "0xhash666666666666666666666666666666666666666",
              blockNumber: 12000000n,
              vulnerable: true,
              confidence: "0.9850",
              verdict: JSON.stringify({ vulnerable: true, confidence: 0.985, vulnerabilities: [{ type: "APPROVAL_DRAINER", severity: "CRITICAL", description: "Unrestricted transferFrom drainer" }] }),
              staticRisk: "high",
              staticFlags: ["UNRESTRICTED_TRANSFER_FROM"],
              explainer: "This contract implements an approval drainer pattern that targets your ERC20 tokens by triggering transferFrom without user-initiated context.",
              createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
            },
            {
              contractAddress: "0x7777777777777777777777777777777777777777".toLowerCase(),
              bytecodeHash: "0xhash777777777777777777777777777777777777777",
              blockNumber: 12000000n,
              vulnerable: true,
              confidence: "0.7820",
              verdict: JSON.stringify({ vulnerable: true, confidence: 0.782, vulnerabilities: [{ type: "REENTRANCY", severity: "HIGH", description: "Potential reentrancy vulnerability in state updates" }] }),
              staticRisk: "high",
              staticFlags: ["CALL_BEFORE_SSTORE"],
              explainer: "This contract exhibits state-changing operations executing after external calls, rendering it vulnerable to a reentrancy attack.",
              createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
            },
            {
              contractAddress: "0x9488a0b0b0000000000000000000000000000099".toLowerCase(),
              bytecodeHash: "0xhash9488a0b0b000000000000000000000000000099",
              blockNumber: 12000000n,
              vulnerable: true,
              confidence: "0.9200",
              verdict: JSON.stringify({ vulnerable: true, confidence: 0.92, vulnerabilities: [{ type: "BACKDOOR", severity: "CRITICAL", description: "Delegatecall vulnerability to a remote logic controller" }] }),
              staticRisk: "high",
              staticFlags: ["DYNAMIC_DELEGATECALL"],
              explainer: "This contract performs a delegatecall to an uncontrolled logic proxy address, which grants remote admin access to your funds.",
              createdAt: new Date()
            }
          ])
          .onConflictDoNothing();

        // 5. Seed custom whitelist
        if (whitelistAddresses && whitelistAddresses.length > 0) {
          for (const addr of whitelistAddresses) {
            await db
              .insert(whitelist)
              .values({
                address: addr.toLowerCase(),
                protocolName: "Custom User Protocol"
              })
              .onConflictDoNothing();
          }
        }

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

  fastify.post("/dev/reload-cache", async (_request, reply) => {
    try {
      await loadWhitelist();
      await loadUserWhitelists();
      return reply.send({ success: true, message: "Whitelist caches reloaded from database" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: "ReloadFailed", message });
    }
  });

  fastify.post<{ Body: { spenderAddress: string; veniceConfidence?: number; staticRisk?: string; staticFlags?: string[] } }>(
    "/dev/simulate-threat",
    {
      schema: {
        body: {
          type: "object",
          required: ["spenderAddress"],
          properties: {
            spenderAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            veniceConfidence: { type: "number" },
            staticRisk: { type: "string", enum: ["high", "medium", "low"] },
            staticFlags: { type: "array", items: { type: "string" } }
          }
        }
      }
    },
    async (request, reply) => {
      const { spenderAddress, veniceConfidence = 0.85, staticRisk = "high", staticFlags = ["UNRESTRICTED_TRANSFER_FROM"] } = request.body;
      try {
        logger.info(`🚨 Dev simulating threat for spender: ${spenderAddress}`);
        const { routeThreatConfidence } = await import("../../daemon/confidenceRouter.js");
        await routeThreatConfidence({
          contractAddress: spenderAddress,
          bytecode: "0x",
          staticRisk: staticRisk as any,
          staticFlags,
          veniceVulnerable: true,
          veniceConfidence
        });
        return reply.status(200).send({
          success: true,
          message: `Threat routing simulation triggered for spender: ${spenderAddress}`
        });
      } catch (err: any) {
        logger.error(`❌ Dev threat simulation failed:`, err);
        return reply.status(500).send({
          error: "SimulationError",
          message: err.message || "Failed to route simulated threat"
        });
      }
    }
  );
}
