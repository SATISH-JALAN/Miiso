import { publicClient } from "../blockchain/viemClient.js";
import { FACTORY_SIGNATURES } from "../config/factorySignatures.js";
import { isWhitelisted } from "../security/whitelist.js";
import { resolveProxyImplementation } from "./proxyResolver.js";
import { fetchBytecodeWithRetry } from "./bytecodeRetry.js";
import { decompileContract } from "./heimdall.js";
import { analyzeContractStatic } from "./staticAnalyzer.js";
import { analyzeBytecodeWithVenice } from "./veniceAnalyzer.js";
import { routeThreatConfidence } from "./confidenceRouter.js";
import { insertScan, getScanByAddress } from "../db/queries/scanLog.js";
import { insertThreatIntel } from "../db/queries/threatIntel.js";
import { db } from "../db/client.js";
import { contractScanLog } from "../db/schema.js";
import { sha256, getAddress } from "viem";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

let isScanningActive = false;
let unwatchBlockLoop: (() => void) | null = null;

/**
 * Starts the Base blockchain real-time block watching scanner daemon.
 */
export async function startBlockWatcher() {
  if (isScanningActive) {
    logger.warn("⚠️ BlockWatcher: Scanner is already running.");
    return;
  }

  isScanningActive = true;
  logger.info("⚡ BlockWatcher: Starting live blockchain threat scanning engine...");

  try {
    // 0. Verify connection to blockchain client before starting subscription to avoid console spam
    await publicClient.getBlockNumber();
  } catch (rpcErr) {
    logger.warn("⚠️ BlockWatcher: Blockchain RPC offline. Live threat scanning suspended (Anvil not running). Retrying in 15 seconds...");
    isScanningActive = false;
    setTimeout(() => startBlockWatcher(), 15000);
    return;
  }

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

  // 6. Run static threat checker
  const staticResult = analyzeContractStatic(decompiledCode);

  // 7. Run Venice AI inference analysis
  const veniceResult = await analyzeBytecodeWithVenice(normalizedAddress, decompiledCode);

  logger.info(`🤖 BlockWatcher: Scan completed for ${normalizedAddress}. Verdict vulnerable: ${veniceResult.vulnerable}. Venice Confidence: ${veniceResult.confidence}. Static Risk: ${staticResult.staticRisk}`);

  // 8. Log scan results to Database
  await insertScan({
    contractAddress: normalizedAddress,
    bytecodeHash,
    blockNumber,
    vulnerable: veniceResult.vulnerable,
    confidence: veniceResult.confidence.toString(),
    verdict: JSON.stringify(veniceResult),
    staticRisk: staticResult.staticRisk,
    staticFlags: staticResult.staticFlags,
    explainer: veniceResult.explanation
  });

  // 9. If vulnerability confirmed, catalog threat intel with mock pgvector embedding vector and route threat action
  if (veniceResult.vulnerable) {
    try {
      // Create a mock 1536-dimensional vector for pgvector storage
      const mockVector = Array(1536).fill(0).map(() => Math.random() - 0.5);
      
      await insertThreatIntel({
        bytecodeHash,
        bytecode,
        embedding: mockVector
      });
    } catch (intelErr) {
      logger.error(`⚠️ BlockWatcher: Failed to catalog threat intel embeddings for ${normalizedAddress}:`, intelErr);
    }

    // Trigger router checks
    await routeThreatConfidence({
      contractAddress: normalizedAddress,
      bytecode,
      staticRisk: staticResult.staticRisk,
      staticFlags: staticResult.staticFlags,
      veniceVulnerable: veniceResult.vulnerable,
      veniceConfidence: veniceResult.confidence
    });
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
  isScanningActive = false;
  logger.info("🛑 BlockWatcher: Scanner daemon stopped.");
}
