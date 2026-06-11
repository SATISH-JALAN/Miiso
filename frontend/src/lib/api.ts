// ===== Typed API client for the Miiso backend =====

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.message || body.error || `API ${res.status}`);
  }
  return res.json();
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
  return request<{ cancelled: boolean; eventId: string }>(`/api/veto/${eventId}`, { method: "POST" });
}

// ── Manual Revoke ────────────────────────────────────────────────
export function postRevoke(body: {
  userAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  rawAllowance: string;
}) {
  return request<{ success: boolean }>("/api/revoke-manual", {
    method: "POST",
    body: JSON.stringify(body),
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

// ── SSE URL ──────────────────────────────────────────────────────
export function getSSEUrl(address: string) {
  return `${BACKEND_URL}/api/events/${address}`;
}
