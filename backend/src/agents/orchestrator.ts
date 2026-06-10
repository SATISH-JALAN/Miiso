// INTEGRATION NOTE for blockWatcher.ts:
// Replace the direct veniceAnalyzer call with:
//   import { runOrchestrator } from "../agents/orchestrator.js"
//   await runOrchestrator(contractAddress, decompiled)

import { runResearchAgent } from "./researchAgent.js";
import { runDataAgent } from "./dataAgent.js";
import { runAnalysisAgent } from "./analysisAgent.js";
import { runExecutorAgent } from "./executorAgent.js";
import { routeByConfidence } from "../daemon/confidenceRouter.js";
import { getActivePermission } from "../db/queries/permissions.js";
import { logger } from "../utils/logger.js";
import type { OrchestratorDecision, AgentResult, ExecutorOutput } from "./types.js";

/**
 * Master Orchestrator Agent — coordinates the 4 specialized sub-agents:
 *   1. Research Agent (deployer history via Basescan)
 *   2. Data Agent (on-chain exposure and TVL)
 *   3. Analysis Agent (Venice AI + static bytecode analysis)
 *   4. Executor Agent (revocation via 1Shot relay — triggered conditionally)
 *
 * Replaces the direct veniceAnalyzer → confidenceRouter pipeline in blockWatcher.ts.
 */
export async function runOrchestrator(
  contractAddress: string,
  decompiled: string
): Promise<OrchestratorDecision> {
  const start = Date.now();

  logger.info(`[Orchestrator] Contract ${contractAddress.slice(0, 8)} received`);

  try {
    // ── Phase 1: Run 3 agents in parallel ──────────────────────────────
    const [researchResult, dataResult, analysisResult] = await Promise.all([
      runResearchAgent(contractAddress),
      runDataAgent(contractAddress),
      runAnalysisAgent(contractAddress, decompiled),
    ]);

    // ── Phase 2: Check if analysis agent returned usable output ────────
    if (analysisResult.status === "error" && analysisResult.output === null) {
      logger.warn(
        `[Orchestrator] Analysis agent returned null output for ${contractAddress.slice(0, 8)} — returning Tier 3`
      );
      return {
        contractAddress,
        combinedConfidence: 0,
        agentResults: [researchResult, dataResult, analysisResult],
        tier: 3,
        totalCostUsdc: 0,
        shouldExecute: false,
        triggeredAt: new Date().toISOString(),
      };
    }

    // ── Phase 3: Compute combined confidence with research modifier ────
    let combinedConfidence = analysisResult.output?.confidence ?? 0;

    const researchOutput = researchResult.output;
    if (researchOutput) {
      if (researchOutput.deployerRisk === "high") {
        combinedConfidence = Math.min(1, combinedConfidence + 0.08);
        logger.info(
          `[Orchestrator] High deployer risk — confidence boosted to ${combinedConfidence.toFixed(2)}`
        );
      } else if (researchOutput.deployerRisk === "medium") {
        combinedConfidence = Math.min(1, combinedConfidence + 0.03);
      }
    }

    // ── Phase 4: Route threat by confidence tier ───────────────────────
    const { tier, affectedUsers } = await routeByConfidence(
      contractAddress,
      combinedConfidence,
      analysisResult.output?.staticRisk ?? "low",
      analysisResult.output?.vulnerabilities ?? []
    );

    // ── Phase 5: Sum up costs so far ──────────────────────────────────
    let totalCostUsdc =
      researchResult.costUsdc + dataResult.costUsdc + analysisResult.costUsdc;

    // ── Phase 6: Execute revocations for Tier 1/2 affected users ──────
    const executorResults: AgentResult<ExecutorOutput>[] = [];
    const shouldExecute =
      (tier === 1 || tier === 2) && affectedUsers.length > 0;

    if (shouldExecute) {
      const exposedValue = dataResult.output?.totalTVLAtRisk ?? 0;

      for (const userAddress of affectedUsers) {
        const permission = await getActivePermission(userAddress);
        if (!permission) {
          logger.warn(
            `[Orchestrator] No active permission for ${userAddress.slice(0, 8)} — skipping`
          );
          continue;
        }

        const executorResult = await runExecutorAgent(
          userAddress,
          // Use the token from the user's permission or default to the contract itself
          contractAddress,
          contractAddress,
          exposedValue
        );

        executorResults.push(executorResult);
        totalCostUsdc += executorResult.costUsdc;
      }
    }

    // ── Phase 7: Build and return decision ─────────────────────────────
    const decision: OrchestratorDecision = {
      contractAddress,
      combinedConfidence,
      agentResults: [
        researchResult,
        dataResult,
        analysisResult,
        ...executorResults,
      ],
      tier,
      totalCostUsdc,
      shouldExecute,
      triggeredAt: new Date().toISOString(),
    };

    logger.info(
      `[Orchestrator] Decision: Tier ${tier} | confidence=${combinedConfidence.toFixed(2)} | users=${affectedUsers.length} | cost=$${totalCostUsdc.toFixed(4)} | duration=${Date.now() - start}ms`
    );

    return decision;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      `[Orchestrator] Fatal error for ${contractAddress.slice(0, 8)}: ${message}`
    );

    // Return a safe Tier 3 decision on catastrophic failure
    return {
      contractAddress,
      combinedConfidence: 0,
      agentResults: [],
      tier: 3,
      totalCostUsdc: 0,
      shouldExecute: false,
      triggeredAt: new Date().toISOString(),
    };
  }
}
