import { db } from "../src/db/client.js";
import { whitelist, permissionsRegistry, approvalCache, protectionEvents } from "../src/db/schema.js";
import { getAddress } from "viem";
import { logger } from "../src/utils/logger.js";

// Base Sepolia — whitelisted safe contracts (false positive guard)
const INITIAL_WHITELIST = [
  { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", name: "USDC (Base Sepolia)" },
  { address: "0x4200000000000000000000000000000000000006", name: "WETH (Base)" },
  { address: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", name: "Uniswap V2 Router (Base Sepolia)" },
];

// Demo User setup matching typical Anvil addresses for immediate frontend local-host preview
const DEMO_USER = {
  address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266".toLowerCase(), // Anvil Address #1
  sessionSigner: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8".toLowerCase(), // Anvil Address #2
  delegationHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  budgetCap: "100000000" // $100 USDC scale budget
};

async function seed() {
  logger.info("🌱 Seeding database with initial hackathon demo data...");

  try {
    // 1. Seed Whitelisted protocols
    logger.info("🛡️ Seeding whitelist protocols...");
    for (const item of INITIAL_WHITELIST) {
      await db
        .insert(whitelist)
        .values({
          address: item.address.toLowerCase(),
          protocolName: item.name,
          createdAt: new Date()
        })
        .onConflictDoNothing();
    }
    logger.info(`✅ Seeded ${INITIAL_WHITELIST.length} whitelist items.`);

    // 2. Seed active permission registries for Demo User
    logger.info("📝 Seeding active user delegation permissions...");
    const [permission] = await db
      .insert(permissionsRegistry)
      .values({
        userAddress: DEMO_USER.address,
        permissionContext: "0x1234567890abcdef",
        delegationHash: DEMO_USER.delegationHash,
        sessionSignerAddress: DEMO_USER.sessionSigner,
        budgetCap: DEMO_USER.budgetCap,
        budgetSpent: "0",
        expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year expiry
      })
      .onConflictDoNothing()
      .returning();
      
    logger.info(`✅ Seeded active permission registry entry for user: ${DEMO_USER.address}`);

    // 3. Seed active approval cache (simulating on-chain assets vulnerable)
    logger.info("🧹 Seeding active token approvals cache...");
    
    // Approval 1: USDC approved to a mock spender (e.g. Uniswap V3 Pool - low risk, active)
    await db
      .insert(approvalCache)
      .values({
        userAddress: DEMO_USER.address,
        tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e".toLowerCase(), // USDC Sepolia
        spenderAddress: "0x88e6A0c2dDD26FEEb64F039a2c41296fcB3f5640".toLowerCase(), // Spender
        allowance: "50000000", // $50 USDC
        lastScannedBlock: 12000000n,
        updatedAt: new Date()
      })
      .onConflictDoNothing();

    // Approval 2: WETH approved to a mock dangerous spender (simulating malicious spender - vulnerable)
    await db
      .insert(approvalCache)
      .values({
        userAddress: DEMO_USER.address,
        tokenAddress: "0x4200000000000000000000000000000000000006".toLowerCase(), // WETH
        spenderAddress: "0x9488a0b0b0000000000000000000000000000099".toLowerCase(), // Malicious Spender
        allowance: "1500000000000000000", // 1.5 WETH
        lastScannedBlock: 12000000n,
        updatedAt: new Date()
      })
      .onConflictDoNothing();

    // 4. Seed historical protection events (to show saved assets & threat timeline in UI)
    logger.info("📊 Seeding historical protection events logs...");
    
    // Event 1: Confirmed revocation of USDC approval on malicious drainer contract
    await db
      .insert(protectionEvents)
      .values({
        userAddress: DEMO_USER.address,
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase(),
        spenderAddress: "0x6666666666666666666666666666666666666666".toLowerCase(),
        exposedValue: "1500000000", // $1500 USDC saved
        actionType: "revocation",
        relayTxHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        relayStatus: "confirmed",
        severity: "high",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      })
      .onConflictDoNothing();

    // Event 2: Staged (veto window expired and then confirmed)
    await db
      .insert(protectionEvents)
      .values({
        userAddress: DEMO_USER.address,
        tokenAddress: "0x4200000000000000000000000000000000000006".toLowerCase(),
        spenderAddress: "0x7777777777777777777777777777777777777777".toLowerCase(),
        exposedValue: "2000000000000000000", // 2.0 ETH (~$6000 saved)
        actionType: "veto",
        relayTxHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        relayStatus: "confirmed",
        severity: "medium",
        stagedUntil: new Date(Date.now() - 5 * 24 * 60 * 1000), // Veto expired
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      })
      .onConflictDoNothing();

    logger.info("🎉 Database successfully seeded! Ready for local integration testing.");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
