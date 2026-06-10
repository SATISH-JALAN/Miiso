// ===== FILE: src/agents/types.ts =====
// Shared type definitions for the multi-agent coordination system.

export type AgentId = "research" | "data" | "analysis" | "executor";
export type AgentStatus = "success" | "timeout" | "error";
export type TierLevel = 1 | 2 | 3;

export interface AgentResult<T = unknown> {
  agentId: AgentId;
  status: AgentStatus;
  output: T | null;
  costUsdc: number;
  durationMs: number;
  error?: string;
}

export interface ResearchOutput {
  deployerRisk: "high" | "medium" | "low";
  pastContracts: number;
  pastMaliciousContracts: number;
  deployerAddress: string;
}

export interface DataOutput {
  exposedWallets: string[];
  totalTVLAtRisk: number;
  contractAgeMs: number;
  hasLiquidity: boolean;
}

export interface AnalysisOutput {
  confidence: number;
  vulnerabilities: string[];
  staticRisk: "high" | "medium" | "low";
  staticFlags: string[];
  veniceRaw: unknown;
}

export interface ExecutorOutput {
  txHash: string;
  fee: number;
  relayStatus: "pending" | "confirmed" | "failed";
  executedAt: string;
}

export interface OrchestratorDecision {
  contractAddress: string;
  combinedConfidence: number;
  agentResults: AgentResult[];
  tier: TierLevel;
  totalCostUsdc: number;
  shouldExecute: boolean;
  triggeredAt: string;
}
