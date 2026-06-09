import { logger } from "./logger.js";

// Costs in USD per 1M tokens for Venice Qwen 72B/35B uncensored model
const INPUT_COST_PER_1M = 0.18;
const OUTPUT_COST_PER_1M = 1.18;

let totalInferenceSpendUSD = 0;
let totalScansCount = 0;

export function trackVeniceCost(inputTokens: number, outputTokens: number) {
  const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;
  const totalCost = inputCost + outputCost;

  totalInferenceSpendUSD += totalCost;
  totalScansCount += 1;

  logger.info("💸 Venice Inference Cost Tracked", {
    scanIndex: totalScansCount,
    inputTokens,
    outputTokens,
    scanCostUSD: totalCost.toFixed(6),
    runningTotalUSD: totalInferenceSpendUSD.toFixed(6)
  });

  return {
    scanCost: totalCost,
    runningTotal: totalInferenceSpendUSD
  };
}

export function getInferenceCostStats() {
  return {
    totalSpendUSD: totalInferenceSpendUSD,
    totalScans: totalScansCount,
    averageScanCostUSD: totalScansCount > 0 ? totalInferenceSpendUSD / totalScansCount : 0
  };
}
