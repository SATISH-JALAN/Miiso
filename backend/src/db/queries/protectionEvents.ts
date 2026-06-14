import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../client.js";
import { protectionEvents, permissionsRegistry, contractScanLog, approvalCache } from "../schema.js";
import { USDC_ADDRESS } from "../../blockchain/contracts.js";

const SEPOLIA_USDC = USDC_ADDRESS.toLowerCase();
const MAINNET_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

function isUsdcToken(tokenAddress: string): boolean {
  const addr = tokenAddress.toLowerCase();
  return addr === SEPOLIA_USDC || addr === MAINNET_USDC;
}

function rawToUsd(tokenAddress: string, rawVal: bigint): number {
  if (isUsdcToken(tokenAddress)) {
    return Number(rawVal) / 1e6;
  }
  return (Number(rawVal) / 1e18) * 3000;
}

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
  
  // 1. Fetch all protection events to count and calculate total saved
  const events = await db
    .select({
      tokenAddress: protectionEvents.tokenAddress,
      exposedValue: protectionEvents.exposedValue
    })
    .from(protectionEvents)
    .where(
      and(
        eq(protectionEvents.userAddress, normalizedUser),
        sql`${protectionEvents.relayStatus} != 'failed'`
      )
    );

  let totalSavedUsd = 0;
  for (const event of events) {
    totalSavedUsd += rawToUsd(event.tokenAddress, BigInt(event.exposedValue));
  }

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

  // 3. Total active exposure from approval cache
  const cachedApprovals = await db
    .select({
      tokenAddress: approvalCache.tokenAddress,
      allowance: approvalCache.allowance
    })
    .from(approvalCache)
    .where(
      and(
        eq(approvalCache.userAddress, normalizedUser),
        sql`${approvalCache.allowance} > 0`
      )
    );

  let totalActiveExposureUsd = 0;
  for (const app of cachedApprovals) {
    totalActiveExposureUsd += rawToUsd(app.tokenAddress, BigInt(app.allowance));
  }

  const budgetCap = permission?.budgetCap || "0";
  const budgetSpent = permission?.budgetSpent || "0";

  return {
    threatsDetected: events.length,
    totalSaved: `$${totalSavedUsd.toFixed(2)}`,
    totalActiveExposure: `$${totalActiveExposureUsd.toFixed(2)}`,
    budgetCap,
    budgetSpent,
    budgetRemaining: (BigInt(budgetCap) - BigInt(budgetSpent)).toString(),
  };
}
