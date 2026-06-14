import { runResearchAgent } from "./researchAgent.js";
import { runDataAgent } from "./dataAgent.js";
import { runAnalysisAgent } from "./analysisAgent.js";
import { logger } from "../utils/logger.js";
import type { OrchestratorDecision, AgentResult, AnalysisOutput } from "./types.js";
import type { VeniceAnalysisResult } from "../daemon/veniceAnalyzer.js";

/**
 * Master Orchestrator Agent — coordinates analysis sub-agents only:
 *   1. Research Agent (deployer history via Basescan)
 *   2. Data Agent (on-chain exposure and TVL)
 *   3. Analysis Agent (Venice AI + static bytecode analysis)
 *
 * Execution (Tier 1/2/3 routing + 1Shot revocation) is handled by
 * routeThreatConfidence() in blockWatcher after analysis completes.
 */
export async function runOrchestrator(
  contractAddress: string,
  decompiled: string
): Promise<OrchestratorDecision> {
  const start = Date.now();

  logger.info(`[Orchestrator] Contract ${contractAddress.slice(0, 8)} received`);

  try {
    const [researchResult, dataResult, analysisResult] = await Promise.all([
      runResearchAgent(contractAddress),
      runDataAgent(contractAddress),
      runAnalysisAgent(contractAddress, decompiled),
    ]);

    if (analysisResult.status === "error" && analysisResult.output === null) {
      logger.warn(
        `[Orchestrator] Analysis agent returned null output for ${contractAddress.slice(0, 8)} — returning Tier 3`
      );
      return {
        contractAddress,
        combinedConfidence: 0,
        veniceConfidence: 0,
        veniceVulnerable: false,
        staticRisk: "low",
        staticFlags: [],
        recommendation: null,
        agentResults: [researchResult, dataResult, analysisResult],
        tier: 3,
        totalCostUsdc: researchResult.costUsdc + dataResult.costUsdc,
        shouldExecute: false,
        triggeredAt: new Date().toISOString(),
      };
    }

    const analysisOutput = analysisResult.output as AnalysisOutput;
    const veniceRaw = analysisOutput.veniceRaw as VeniceAnalysisResult | null;

    let veniceConfidence = analysisOutput.confidence;
    let combinedConfidence = veniceConfidence;

    const researchOutput = researchResult.output;
    if (researchOutput) {
      if (researchOutput.deployerRisk === "high") {
        combinedConfidence = Math.min(1, combinedConfidence + 0.08);
      } else if (researchOutput.deployerRisk === "medium") {
        combinedConfidence = Math.min(1, combinedConfidence + 0.03);
      }
    }

    const totalCostUsdc =
      researchResult.costUsdc + dataResult.costUsdc + analysisResult.costUsdc;

    const veniceVulnerable = veniceRaw?.vulnerable ?? combinedConfidence >= 0.5;
    const recommendation = veniceRaw?.recommendation ?? null;

    let tier: 1 | 2 | 3 = 3;
    const TIER1 = parseFloat(process.env.TIER1_THRESHOLD || "0.85");
    const TIER2 = parseFloat(process.env.TIER2_THRESHOLD || "0.70");
    if (combinedConfidence >= TIER1) tier = 1;
    else if (combinedConfidence >= TIER2) tier = 2;

    const decision: OrchestratorDecision = {
      contractAddress,
      combinedConfidence,
      veniceConfidence,
      veniceVulnerable,
      staticRisk: analysisOutput.staticRisk,
      staticFlags: analysisOutput.staticFlags,
      recommendation,
      agentResults: [researchResult, dataResult, analysisResult],
      tier,
      totalCostUsdc,
      shouldExecute: false,
      triggeredAt: new Date().toISOString(),
    };

    logger.info(
      `[Orchestrator] Analysis complete: Tier ${tier} | confidence=${combinedConfidence.toFixed(2)} | cost=$${totalCostUsdc.toFixed(4)} | duration=${Date.now() - start}ms`
    );

    return decision;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      `[Orchestrator] Fatal error for ${contractAddress.slice(0, 8)}: ${message}`
    );

    return {
      contractAddress,
      combinedConfidence: 0,
      veniceConfidence: 0,
      veniceVulnerable: false,
      staticRisk: "low",
      staticFlags: [],
      recommendation: null,
      agentResults: [],
      tier: 3,
      totalCostUsdc: 0,
      shouldExecute: false,
      triggeredAt: new Date().toISOString(),
    };
  }
}
