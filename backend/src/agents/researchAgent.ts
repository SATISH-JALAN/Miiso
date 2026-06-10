import { db } from "../db/client.js";
import { contractScanLog } from "../db/schema.js";
import { inArray } from "drizzle-orm";
import { logger } from "../utils/logger.js";
import type { AgentResult, ResearchOutput } from "./types.js";
import dotenv from "dotenv";

dotenv.config();

const BASESCAN_API_URL = "https://api.basescan.org/api";

/**
 * Research Agent: Investigates the deployer of a contract — checks their
 * deployment history and cross-references with known malicious contracts.
 */
export async function runResearchAgent(
  contractAddress: string
): Promise<AgentResult<ResearchOutput>> {
  const start = Date.now();

  try {
    const apiKey = process.env.BASESCAN_API_KEY;

    if (!apiKey) {
      logger.warn("[ResearchAgent] BASESCAN_API_KEY not set, returning low risk default");
      return {
        agentId: "research",
        status: "success",
        output: {
          deployerRisk: "low",
          pastContracts: 0,
          pastMaliciousContracts: 0,
          deployerAddress: "0x0000000000000000000000000000000000000000",
        },
        costUsdc: 0,
        durationMs: Date.now() - start,
      };
    }

    // Step 1: Get contract creator via Basescan API
    const creatorUrl = `${BASESCAN_API_URL}?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}&apikey=${apiKey}`;
    const creatorResponse = await fetch(creatorUrl);
    const creatorJson = await creatorResponse.json() as {
      status: string;
      result: Array<{ contractCreator: string; txHash: string }> | null;
    };

    if (!creatorJson.result || creatorJson.result.length === 0) {
      logger.warn("[ResearchAgent] Could not resolve deployer for %s", contractAddress.slice(0, 8));
      return {
        agentId: "research",
        status: "success",
        output: {
          deployerRisk: "low",
          pastContracts: 0,
          pastMaliciousContracts: 0,
          deployerAddress: "0x0000000000000000000000000000000000000000",
        },
        costUsdc: 0,
        durationMs: Date.now() - start,
      };
    }

    const deployerAddress = creatorJson.result[0].contractCreator.toLowerCase();

    // Step 2: Fetch deployer's full transaction history
    const txListUrl = `${BASESCAN_API_URL}?module=account&action=txlist&address=${deployerAddress}&sort=asc&startblock=0&endblock=99999999&apikey=${apiKey}`;
    const txListResponse = await fetch(txListUrl);
    const txListJson = await txListResponse.json() as {
      status: string;
      result: Array<{ input: string; contractAddress: string }>;
    };

    const txList = Array.isArray(txListJson.result) ? txListJson.result : [];

    // Filter for contract creation transactions (bytecode starts with CREATE opcode prefix)
    const deploymentTxs = txList.filter(
      (tx) => tx.input && tx.input.startsWith("0x60")
    );
    const pastContracts = deploymentTxs.length;

    // Step 3: Collect deployed contract addresses and cross-reference against scan log
    const deployedAddresses = deploymentTxs
      .map((tx) => tx.contractAddress)
      .filter((addr): addr is string => !!addr && addr.length > 0)
      .map((addr) => addr.toLowerCase());

    let pastMaliciousContracts = 0;

    if (deployedAddresses.length > 0) {
      try {
        const maliciousMatches = await db
          .select()
          .from(contractScanLog)
          .where(
            inArray(contractScanLog.contractAddress, deployedAddresses)
          );

        // Filter in JS since Drizzle numeric comparison with gt on string field is tricky
        pastMaliciousContracts = maliciousMatches.filter(
          (row) => parseFloat(row.confidence) > 0.7
        ).length;
      } catch (dbErr) {
        logger.warn("[ResearchAgent] DB lookup for malicious history failed, assuming 0");
      }
    }

    // Step 4: Compute deployer risk
    let deployerRisk: "high" | "medium" | "low" = "low";
    if (pastMaliciousContracts > 0) {
      deployerRisk = "high";
    } else if (pastContracts > 10) {
      deployerRisk = "medium";
    }

    logger.info(
      `[ResearchAgent] ${contractAddress.slice(0, 8)} deployer ${deployerAddress.slice(0, 8)} risk=${deployerRisk} past=${pastContracts} malicious=${pastMaliciousContracts}`
    );

    return {
      agentId: "research",
      status: "success",
      output: {
        deployerRisk,
        pastContracts,
        pastMaliciousContracts,
        deployerAddress,
      },
      costUsdc: 0,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[ResearchAgent] Failed for ${contractAddress.slice(0, 8)}: ${message}`);
    return {
      agentId: "research",
      status: "error",
      output: null,
      costUsdc: 0,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}
