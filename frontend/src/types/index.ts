// ===== Shared TypeScript types for the Miiso frontend =====

export interface ApprovalInfo {
  token: string;
  spender: string;
  spenderName?: string;
  amount: string;
  rawAllowance: string;
  date: string;
  riskLevel: "high" | "medium" | "low" | "none";
}

export interface ProtectionEvent {
  id: string;
  userAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  exposedValue: string;
  actionType: "revocation" | "veto" | "clean";
  relayTxHash?: string | null;
  relayStatus?: "pending" | "confirmed" | "failed" | null;
  severity: "high" | "medium" | "low";
  vetoCancelled: boolean;
  stagedUntil: string | null;
  createdAt: string;
  explainer?: string | null;
  confidence?: string | null;
  staticFlags?: string[] | null;
  staticRisk?: string | null;
}

export interface DashboardStats {
  threatsDetected: number;
  totalSaved: string;
  /** Sum of all active token allowances in approval_cache — the real "Assets Protected" value */
  totalActiveExposure: string;
  budgetCap: string;
  budgetSpent: string;
  budgetRemaining: string;
}


export type SecurityProfile = "safe" | "balanced" | "manual";

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}
