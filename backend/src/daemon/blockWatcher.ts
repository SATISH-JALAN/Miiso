import { publicClient } from "../blockchain/viemClient.js";
import { FACTORY_SIGNATURES } from "../config/factorySignatures.js";
import { isWhitelisted } from "../security/whitelist.js";
import { resolveProxyImplementation } from "./proxyResolver.js";
import { fetchBytecodeWithRetry } from "./bytecodeRetry.js";
import { decompileContract } from "./heimdall.js";
import { routeThreatConfidence } from "./confidenceRouter.js";
import { runOrchestrator } from "../agents/orchestrator.js";
import { insertScan, getScanByAddress } from "../db/queries/scanLog.js";
import { insertThreatIntel } from "../db/queries/threatIntel.js";
import { db } from "../db/client.js";
import { contractScanLog } from "../db/schema.js";
import { sha256, getAddress } from "viem";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger.js";
import { upsertApproval } from "../db/queries/approvalCache.js";
import { getAllActivePermissions } from "../db/queries/permissions.js";
import dotenv from "dotenv";

dotenv.config();

let isScanningActive = false;
let unwatchBlockLoop: (() => void) | null = null;
let mockWatcherInterval: NodeJS.Timeout | null = null;
let simulatedBlockHeight = 47200000n;

/**
 * Starts the Base blockchain real-time block watching scanner daemon.
 */
export async function startBlockWatcher() {
  if (isScanningActive) {
    logger.warn("⚠️ BlockWatcher: Scanner is already running.");
    return;
  }

  isScanningActive = true;
  logger.info("⚡ BlockWatcher: Starting blockchain threat scanning engine...");

  try {
    // 0. Verify connection to blockchain client before starting subscription to avoid console spam
    await publicClient.getBlockNumber();
    
    // If online, start the live block watcher
    await startRealBlockWatcher();
  } catch (rpcErr) {
    if (process.env.DEMO_MODE === "true") {
      logger.info("ℹ️ BlockWatcher: Local Anvil RPC offline. Initializing Mock Threat Simulation Loop...");
      startMockBlockWatcher();
    } else {
      logger.warn("⚠️ BlockWatcher: Blockchain RPC offline. Live threat scanning suspended. Retrying in 15 seconds...");
      isScanningActive = false;
      setTimeout(() => startBlockWatcher(), 15000);
    }
  }
}

/**
 * Starts the real blockchain watcher stream.
 */
async function startRealBlockWatcher() {
  try {
    // viem watchBlocks opens a persistent WebSocket/polling stream
    unwatchBlockLoop = publicClient.watchBlocks({
      emitOnBegin: true,
      onBlock: async (block) => {
        try {
          const blockNumber = block.number;
          const blockHash = block.hash;
          logger.info(`📦 BlockWatcher: New block received: #${blockNumber} (${blockHash})`);

          // Execute processing in background to not block the block watcher stream
          processBlock(blockHash, blockNumber).catch((err) => {
            logger.error(`❌ BlockWatcher: Error processing block #${blockNumber}:`, err);
          });

        } catch (blockErr) {
          logger.error("❌ BlockWatcher: Internal block handler error:", blockErr);
        }
      },
      onError: (error: any) => {
        const errMsg = error?.message || "";
        const isConnectionError = errMsg.includes("fetch failed") || errMsg.includes("HTTP request failed") || errMsg.includes("failed to fetch");
        
        if (isConnectionError) {
          logger.warn("⚠️ BlockWatcher: Lost connection to blockchain RPC. Suspending watcher and attempting reconnection in 15 seconds...");
          stopBlockWatcher();
          setTimeout(() => startBlockWatcher(), 15000);
        } else {
          logger.error("❌ BlockWatcher: Subscription WebSocket error:", error);
        }
      }
    });

    logger.info("✅ BlockWatcher: Threat scanning loop successfully listening to Base blocks.");
  } catch (error) {
    logger.error("❌ BlockWatcher: Failed to initialize subscription watchBlocks:", error);
    isScanningActive = false;
    setTimeout(() => startBlockWatcher(), 10000);
  }
}

/**
 * Simulates block detection and threat triggers when offline in DEMO_MODE.
 */
function startMockBlockWatcher() {
  mockWatcherInterval = setInterval(async () => {
    try {
      simulatedBlockHeight += 1n;
      logger.info(`📦 BlockWatcher (SIMULATED): New block received: #${simulatedBlockHeight}`);

      // 30% chance to simulate a malicious contract deployment
      if (Math.random() < 0.3) {
        // Generate a random mock spender contract address
        const randomHex = Array(20)
          .fill(0)
          .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, "0"))
          .join("");
        const mockContractAddress = getAddress(`0x${randomHex}`);
        
        logger.warn(`🚨 BlockWatcher (SIMULATED): Detected Direct deployment contract at address: ${mockContractAddress}`);

        // Find active users who have granted delegation permissions to target
        const activePermissions = await getAllActivePermissions();
        const targetUsers = activePermissions.length > 0 
          ? activePermissions.map(p => p.userAddress)
          : ["0x976ea74026e726554db657fa54763abd0c3a0aa9"]; // fallback standard agent address

        const tokenAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; // Mock USDC on Base

        // Register mock approval for these users
        for (const user of targetUsers) {
          await upsertApproval({
            userAddress: user,
            tokenAddress,
            spenderAddress: mockContractAddress,
            allowance: "50000000000", // $50,000 allowance
            lastScannedBlock: simulatedBlockHeight
          });
        }

        // Randomly select threat type (Tier 1 immediate, Tier 2 staged veto, or Tier 3 info)
        const rand = Math.random();
        let staticRisk: "high" | "medium" | "low" = "high";
        let staticFlags = ["selfdestruct", "delegatecall"];
        let veniceConfidence = 0.79;
        let combinedConfidence = 0.89;
        let explainer = "Simulated honeypot contract. Dangerous delegatecall and selfdestruct functions detected.";
        let tier: 1 | 2 | 3 = 1;

        if (rand < 0.4) {
          // Tier 2: Staged veto countdown (0.70 <= confidence < 0.85)
          staticRisk = "high";
          staticFlags = ["selfdestruct", "delegatecall"];
          veniceConfidence = 0.65; // 0.65 + 0.10 = 0.75 combined
          combinedConfidence = 0.75;
          explainer = "Simulated vulnerable contract. Medium confidence pattern match, staged for 60-second user veto.";
          tier = 2;
        } else if (rand < 0.8) {
          // Tier 1: Immediate auto-revocation (confidence >= 0.85)
          staticRisk = "high";
          staticFlags = ["selfdestruct", "delegatecall"];
          veniceConfidence = 0.79; // 0.79 + 0.10 = 0.89 combined
          combinedConfidence = 0.89;
          explainer = "Simulated critical honeypot contract. Immediate auto-revocation triggered.";
          tier = 1;
        } else {
          // Tier 3: Informational (0.50 <= confidence < 0.70)
          staticRisk = "medium";
          staticFlags = ["reentrancy"];
          veniceConfidence = 0.50; // 0.50 + 0.05 = 0.55 combined
          combinedConfidence = 0.55;
          explainer = "Simulated low-risk warning. Potential reentrancy pattern detected, monitoring only.";
          tier = 3;
        }

        // Simulating honeypot/approval drainer contract bytecode
        const mockBytecode = "0x608060405234801561001057600080fd5b50600436106100415760003560e01c8063095ea7b31461004657806323b872dd14610060578063ff11223314610080575b600080fd5b50604051ff5b34801561006c57600080fd5b5061007423b872dd565b00";
        const bytecodeHash = sha256(mockBytecode as `0x${string}`);

        // Save scan result to Database
        await insertScan({
          contractAddress: mockContractAddress,
          bytecodeHash,
          blockNumber: simulatedBlockHeight,
          vulnerable: tier !== 3,
          confidence: combinedConfidence.toString(),
          verdict: JSON.stringify({
            combinedConfidence,
            shouldExecute: tier === 1 || tier === 2,
            tier,
            totalCostUsdc: 0.00038
          }),
          staticRisk,
          staticFlags,
          explainer
        });

        // Save mock threat intelligence vector embeddings
        const mockVector = Array(1536).fill(0).map(() => Math.random() - 0.5);
        await insertThreatIntel({
          bytecodeHash,
          bytecode: mockBytecode,
          embedding: mockVector
        });

        // Trigger threat confidence router to stage the veto event!
        await routeThreatConfidence({
          contractAddress: mockContractAddress,
          bytecode: mockBytecode,
          staticRisk,
          staticFlags,
          veniceVulnerable: tier !== 3,
          veniceConfidence
        });
      }
    } catch (err) {
      logger.error("❌ BlockWatcher (SIMULATED): Error during mock block iteration:", err);
    }
  }, 25000); // scan block every 25 seconds
}

/**
 * Processes a single block: scans for direct and factory deployments.
 */
async function processBlock(blockHash: `0x${string}`, blockNumber: bigint) {
  // 1. Fetch block details containing transactions
  const block = await publicClient.getBlock({
    blockHash,
    includeTransactions: true
  });

  const txs = block.transactions;
  logger.debug(`📦 BlockWatcher: Processing block #${blockNumber} containing ${txs.length} transactions.`);

  // In-memory set to prevent duplicate scans in same block
  const detectedContracts = new Set<string>();

  // 2. Scan direct deployments (tx.to === null)
  for (const tx of txs) {
    if (typeof tx === "object" && tx.to === null) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
        if (receipt.contractAddress) {
          const contractAddr = getAddress(receipt.contractAddress);
          logger.warn(`🚨 BlockWatcher: Detected Direct deployment contract at address: ${contractAddr}`);
          detectedContracts.add(contractAddr);
        }
      } catch (err) {
        logger.error(`⚠️ BlockWatcher: Failed fetching receipt for direct creation tx ${tx.hash}:`, err);
      }
    }
  }

  // 3. Scan factory deployments by fetching block logs (efficient single RPC call)
  try {
    const logs = await publicClient.getLogs({
      blockHash
    });

    for (const log of logs) {
      const topic0 = log.topics[0];
      if (!topic0) continue;

      for (const factory of FACTORY_SIGNATURES) {
        if (topic0.toLowerCase() === factory.topic.toLowerCase()) {
          try {
            const contractAddr = factory.extractAddress(log.topics, log.data);
            if (contractAddr) {
              const normalizedAddr = getAddress(contractAddr);
              logger.warn(`🚨 BlockWatcher: Detected Factory deployment (${factory.name}) contract at: ${normalizedAddr}`);
              detectedContracts.add(normalizedAddr);
            }
          } catch (extErr) {
            logger.error(`⚠️ BlockWatcher: Error decoding factory address for signature ${factory.name}:`, extErr);
          }
        }
      }
    }
  } catch (logErr) {
    logger.error(`⚠️ BlockWatcher: Failed to fetch block logs for block hash ${blockHash}:`, logErr);
  }

  // 4. Analyze all detected contracts in parallel worker streams
  for (const address of detectedContracts) {
    processContractDeployment(address, blockNumber).catch((err) => {
      logger.error(`❌ BlockWatcher: Error analyzing contract ${address}:`, err);
    });
  }
}

/**
 * Executes decompilation, caching checks, static analysis, AI analysis, and threat routing.
 */
async function processContractDeployment(address: string, blockNumber: bigint) {
  const normalizedAddress = getAddress(address);

  // 1. Whitelist Check (skip analysis for safe protocols)
  if (isWhitelisted(normalizedAddress)) {
    logger.info(`🛡️ BlockWatcher: Contract ${normalizedAddress} is Whitelisted. Skipping analysis.`);
    return;
  }

  // 2. Resolve Proxy implementation (check EIP-1967 slots)
  const targetAddress = await resolveProxyImplementation(normalizedAddress);

  // 3. Fetch bytecode with exponential backoff retries
  const bytecode = await fetchBytecodeWithRetry(targetAddress);
  if (bytecode === "0x") {
    logger.info(`ℹ️ BlockWatcher: Contract ${normalizedAddress} returned empty bytecode. Skipping.`);
    return;
  }

  // 4. Calculate bytecode SHA-256 hash to check duplication
  const bytecodeHash = sha256(bytecode as `0x${string}`);
  
  // Check if this exact bytecode hash has already been scanned
  const [existingScan] = await db
    .select()
    .from(contractScanLog)
    .where(eq(contractScanLog.bytecodeHash, bytecodeHash))
    .limit(1);

  if (existingScan) {
    logger.info(`🔄 BlockWatcher: Bytecode duplication detected. Reusing analysis cache for ${normalizedAddress} (Hash: ${bytecodeHash})`);
    
    // If the cached bytecode was flagged vulnerable, run routing for the NEW deployment address!
    if (existingScan.vulnerable) {
      logger.warn(`🚨 BlockWatcher: Reused cache indicates contract is vulnerable. Triggering routing...`);
      await routeThreatConfidence({
        contractAddress: normalizedAddress,
        bytecode,
        staticRisk: existingScan.staticRisk as "high" | "medium" | "low",
        staticFlags: existingScan.staticFlags,
        veniceVulnerable: true,
        veniceConfidence: parseFloat(existingScan.confidence)
      });
    }
    return;
  }

  // 5. Decompile bytecode using Worker Pool (Heimdall-rs wrapper)
  const decompiledCode = await decompileContract(normalizedAddress, bytecode);

  // 6. Run multi-agent orchestrator (Research + Data + Analysis + Executor)
  const decision = await runOrchestrator(normalizedAddress, decompiledCode);

  // Extract analysis output for DB logging
  const analysisAgent = decision.agentResults.find((r) => r.agentId === "analysis");
  const analysisOutput = analysisAgent?.output as { confidence: number; vulnerabilities: string[]; staticRisk: string; staticFlags: string[]; veniceRaw: unknown } | null;

  const isVulnerable = decision.combinedConfidence >= 0.5 && decision.shouldExecute;
  const staticRisk = (analysisOutput?.staticRisk ?? "low") as "high" | "medium" | "low";
  const staticFlags = analysisOutput?.staticFlags ?? [];

  logger.info(`🤖 BlockWatcher: Orchestrator completed for ${normalizedAddress}. Tier: ${decision.tier} | Confidence: ${decision.combinedConfidence.toFixed(2)} | Cost: $${decision.totalCostUsdc.toFixed(4)}`);

  // 7. Log scan results to Database
  await insertScan({
    contractAddress: normalizedAddress,
    bytecodeHash,
    blockNumber,
    vulnerable: isVulnerable,
    confidence: decision.combinedConfidence.toString(),
    verdict: JSON.stringify(decision),
    staticRisk,
    staticFlags,
    explainer: analysisOutput?.vulnerabilities?.join("; ") ?? null
  });

  // Emit CLEAN_SCAN to all connected clients if the contract is deemed safe
  if (!isVulnerable) {
    import("../server/sse/sseManager.js").then(({ sseManager }) => {
      sseManager.sendEventToUser("*", "CLEAN_SCAN", {
        contractAddress: normalizedAddress,
        inferenceCostUsdc: decision.totalCostUsdc,
        timestamp: new Date().toISOString()
      });
    }).catch(err => logger.error("Failed to dynamically import sseManager:", err));
  }

  // 8. If vulnerability confirmed, catalog threat intel
  if (isVulnerable) {
    try {
      const mockVector = Array(1536).fill(0).map(() => Math.random() - 0.5);
      await insertThreatIntel({
        bytecodeHash,
        bytecode,
        embedding: mockVector
      });
    } catch (intelErr) {
      logger.error(`⚠️ BlockWatcher: Failed to catalog threat intel embeddings for ${normalizedAddress}:`, intelErr);
    }
  }
}

/**
 * Stops block watcher scanning daemon.
 */
export function stopBlockWatcher() {
  if (unwatchBlockLoop) {
    unwatchBlockLoop();
    unwatchBlockLoop = null;
  }
  if (mockWatcherInterval) {
    clearInterval(mockWatcherInterval);
    mockWatcherInterval = null;
  }
  isScanningActive = false;
  logger.info("🛑 BlockWatcher: Scanner daemon stopped.");
}
