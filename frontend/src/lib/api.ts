// ===== Typed API client for the Miiso backend =====

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    body = { error: text || res.statusText };
  }
  if (!res.ok) {
    throw new Error(body.message || body.error || `API ${res.status}`);
  }
  return body as T;
}

// ── Permissions ──────────────────────────────────────────────────
export function postPermissions(body: {
  userAddress: string;
  permissionContext: string;
  delegationHash: string;
  sessionSignerAddress: string;
  budgetCap: string;
  expiry: number;
}) {
  return request<{ success: boolean; permission: Record<string, unknown> }>("/api/permissions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getPermissions(address: string) {
  return request<{ success: boolean; permission: Record<string, unknown> }>(`/api/permissions/${address}`);
}

export function deletePermissions(address: string) {
  return request<{ success: boolean; message: string }>(`/api/permissions/${address}`, { method: "DELETE" });
}

export function updateProfile(userAddress: string, securityProfile: string) {
  return request<{ success: boolean; permission: Record<string, unknown> }>("/api/permissions/profile", {
    method: "POST",
    body: JSON.stringify({ userAddress, securityProfile }),
  });
}

// ── Dashboard ────────────────────────────────────────────────────
export function getDashboard(address: string) {
  return request<{ stats: Record<string, unknown> }>(`/api/dashboard/${address}`);
}

// ── Approvals ────────────────────────────────────────────────────
export function getApprovals(address: string) {
  return request<{ approvals: Record<string, unknown>[] }>(`/api/approvals/${address}`);
}

// ── History ──────────────────────────────────────────────────────
export function getHistory(address: string) {
  return request<{ events: Record<string, unknown>[] }>(`/api/history/${address}`);
}

// ── Veto ─────────────────────────────────────────────────────────
export function postVeto(eventId: string) {
  return request<{ cancelled: boolean; eventId: string }>(`/api/veto/${eventId}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function postExecuteVeto(eventId: string) {
  return request<{ executed: boolean; eventId: string }>(`/api/veto/execute/${eventId}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// ── Manual Revoke ────────────────────────────────────────────────
export function postRevoke(body: {
  userAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  rawAllowance: string;
}) {
  return request<{ success: boolean }>("/api/revoke/manual", {
    method: "POST",
    body: JSON.stringify({
      userAddress: body.userAddress,
      tokenAddress: body.tokenAddress,
      spenderAddress: body.spenderAddress,
      exposedValue: body.rawAllowance
    }),
  });
}

export function postBatchRevoke(body: {
  userAddress: string;
  approvals: { tokenAddress: string; spenderAddress: string; rawAllowance: string }[];
}) {
  return request<{ success: boolean }>("/api/revoke/batch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Seed Wallet (dev/demo) ───────────────────────────────────────
export function seedWallet(body: {
  userAddress: string;
  budgetCap: number;
  whitelistAddresses: string[];
}) {
  return request<{ success: boolean }>("/api/dev/seed-wallet", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Agents Analysis ────────────────────────────────────────────────
export function postAnalyzeContract(contractAddress: string) {
  return request<{
    success: boolean;
    data: {
      contractAddress: string;
      combinedConfidence: number;
      staticRisks: string[];
      veniceConfidenceVerdict: string;
      score: number;
      totalCostUsdc: number;
    }
  }>("/api/analyze", {
    method: "POST",
    body: JSON.stringify({ contractAddress }),
  });
}

// ── SSE URL ──────────────────────────────────────────────────────
export function getSSEUrl(address: string) {
  return `${BACKEND_URL}/api/events/${address}`;
}

export function getPublicSSEUrl() {
  return `${BACKEND_URL}/api/events/public`;
}
