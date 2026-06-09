import { eq, and, gt } from "drizzle-orm";
import { db } from "../client.js";
import { approvalCache } from "../schema.js";

export async function upsertApproval(data: {
  userAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  allowance: string; // numeric string
  lastScannedBlock: bigint;
}) {
  const user = data.userAddress.toLowerCase();
  const token = data.tokenAddress.toLowerCase();
  const spender = data.spenderAddress.toLowerCase();

  return await db
    .insert(approvalCache)
    .values({
      userAddress: user,
      tokenAddress: token,
      spenderAddress: spender,
      allowance: data.allowance,
      lastScannedBlock: data.lastScannedBlock,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [approvalCache.userAddress, approvalCache.spenderAddress, approvalCache.tokenAddress],
      set: {
        allowance: data.allowance,
        lastScannedBlock: data.lastScannedBlock,
        updatedAt: new Date()
      }
    })
    .returning();
}

export async function getCachedApprovals(userAddress: string) {
  const user = userAddress.toLowerCase();
  
  return await db
    .select()
    .from(approvalCache)
    .where(
      and(
        eq(approvalCache.userAddress, user),
        gt(approvalCache.allowance, "0") // Only active approvals
      )
    );
}

export async function invalidateApproval(userAddress: string, spenderAddress: string, tokenAddress: string) {
  const user = userAddress.toLowerCase();
  const spender = spenderAddress.toLowerCase();
  const token = tokenAddress.toLowerCase();

  const [updated] = await db
    .update(approvalCache)
    .set({
      allowance: "0",
      updatedAt: new Date()
    })
    .where(
      and(
        eq(approvalCache.userAddress, user),
        eq(approvalCache.spenderAddress, spender),
        eq(approvalCache.tokenAddress, token)
      )
    )
    .returning();
    
  return updated || null;
}
