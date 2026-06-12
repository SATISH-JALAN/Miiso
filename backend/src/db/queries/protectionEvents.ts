import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../client.js";
import { protectionEvents, permissionsRegistry, contractScanLog, approvalCache } from "../schema.js";

export async function insertProtectionEvent(data: {
  userAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  exposedValue: string; // numeric string
  actionType: string; // 'revocation' | 'veto'
  relayTxHash?: string;
  relayStatus: string; // 'pending' | 'confirmed' | 'failed'
  severity: string; // 'high' | 'medium' | 'low'
  stagedUntil?: Date;
}) {
  const [inserted] = await db
    .insert(protectionEvents)
    .values({
      userAddress: data.userAddress.toLowerCase(),
      tokenAddress: data.tokenAddress.toLowerCase(),
      spenderAddress: data.spenderAddress.toLowerCase(),
      exposedValue: data.exposedValue,
      actionType: data.actionType,
      relayTxHash: data.relayTxHash,
      relayStatus: data.relayStatus,
      severity: data.severity,
      stagedUntil: data.stagedUntil,
      vetoCancelled: false,
      createdAt: new Date(),
    })
    .returning();
    
  return inserted;
}

export async function updateRelayStatus(relayTxHash: string, status: "confirmed" | "failed") {
  const [updated] = await db
    .update(protectionEvents)
    .set({ relayStatus: status })
    .where(eq(protectionEvents.relayTxHash, relayTxHash))
    .returning();
    
  return updated || null;
}

export async function getEventsByUser(userAddress: string, page = 1, limit = 20) {
  const normalizedUser = userAddress.toLowerCase();
  const offset = (page - 1) * limit;
  
  return await db
    .select({
      id: protectionEvents.id,
      userAddress: protectionEvents.userAddress,
      tokenAddress: protectionEvents.tokenAddress,
      spenderAddress: protectionEvents.spenderAddress,
      exposedValue: protectionEvents.exposedValue,
      actionType: protectionEvents.actionType,
      relayTxHash: protectionEvents.relayTxHash,
      relayStatus: protectionEvents.relayStatus,
      severity: protectionEvents.severity,
      vetoCancelled: protectionEvents.vetoCancelled,
      stagedUntil: protectionEvents.stagedUntil,
      createdAt: protectionEvents.createdAt,
      explainer: contractScanLog.explainer,
      confidence: contractScanLog.confidence,
      staticFlags: contractScanLog.staticFlags,
      staticRisk: contractScanLog.staticRisk
    })
    .from(protectionEvents)
    .leftJoin(contractScanLog, eq(contractScanLog.contractAddress, protectionEvents.spenderAddress))
    .where(eq(protectionEvents.userAddress, normalizedUser))
    .orderBy(desc(protectionEvents.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function cancelVeto(eventId: string) {
  const [updated] = await db
    .update(protectionEvents)
    .set({ vetoCancelled: true })
    .where(eq(protectionEvents.id, eventId))
    .returning();
    
  return updated || null;
}

export async function getDashboardStats(userAddress: string) {
  const normalizedUser = userAddress.toLowerCase();
  
  // 1. Aggregated protection event stats
  const [eventStats] = await db
    .select({
      threatsCount: sql<number>`count(*)::int`,
      totalSaved: sql<string>`coalesce(sum(${protectionEvents.exposedValue}), 0)::text`
    })
    .from(protectionEvents)
    .where(
      and(
        eq(protectionEvents.userAddress, normalizedUser),
        sql`${protectionEvents.relayStatus} != 'failed'`
      )
    );

  // 2. Budget information from permissions_registry
  const [permission] = await db
    .select({
      budgetCap: permissionsRegistry.budgetCap,
      budgetSpent: permissionsRegistry.budgetSpent
    })
    .from(permissionsRegistry)
    .where(
      and(
        eq(permissionsRegistry.userAddress, normalizedUser),
        sql`revoked_at IS NULL`
      )
    )
    .limit(1);

  // 3. Total active exposure = SUM of all current allowances in the approval cache.
  //    This is the real "Assets Protected" value — what Miiso is actively guarding.
  const [exposureStats] = await db
    .select({
      totalActiveExposure: sql<string>`coalesce(sum(${approvalCache.allowance}), 0)::text`
    })
    .from(approvalCache)
    .where(
      and(
        eq(approvalCache.userAddress, normalizedUser),
        sql`${approvalCache.allowance} > 0`
      )
    );

  return {
    threatsDetected: eventStats?.threatsCount || 0,
    totalSaved: eventStats?.totalSaved || "0",
    // Total value of active token approvals currently under Miiso's guard
    totalActiveExposure: exposureStats?.totalActiveExposure || "0",
    budgetCap: permission?.budgetCap || "0",
    budgetSpent: permission?.budgetSpent || "0",
    budgetRemaining: (
      BigInt(permission?.budgetCap || "0") - BigInt(permission?.budgetSpent || "0")
    ).toString()
  };
}
