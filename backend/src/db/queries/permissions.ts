import { eq, and, gt, isNull } from "drizzle-orm";
import { db } from "../client.js";
import { permissionsRegistry } from "../schema.js";

export async function createPermission(data: {
  userAddress: string;
  permissionContext: string;
  delegationHash: string;
  sessionSignerAddress: string;
  budgetCap: string; // numeric string
  expiry: Date;
  grantMethod?: string;
  feeAllowanceApproved?: boolean;
}) {
  const normalizedUser = data.userAddress.toLowerCase();
  const sessionSigner = data.sessionSignerAddress.toLowerCase();
  const now = new Date();

  // One row per user (unique on user_address). Upsert re-activates revoked rows
  // instead of inserting a duplicate.
  const [permission] = await db
    .insert(permissionsRegistry)
    .values({
      userAddress: normalizedUser,
      permissionContext: data.permissionContext,
      delegationHash: data.delegationHash,
      sessionSignerAddress: sessionSigner,
      budgetCap: data.budgetCap,
      budgetSpent: "0",
      grantMethod: data.grantMethod ?? null,
      feeAllowanceApproved: data.feeAllowanceApproved ?? false,
      expiry: data.expiry,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: permissionsRegistry.userAddress,
      set: {
        permissionContext: data.permissionContext,
        delegationHash: data.delegationHash,
        sessionSignerAddress: sessionSigner,
        budgetCap: data.budgetCap,
        budgetSpent: "0",
        grantMethod: data.grantMethod ?? null,
        feeAllowanceApproved: data.feeAllowanceApproved ?? false,
        expiry: data.expiry,
        revokedAt: null,
        createdAt: now,
      },
    })
    .returning();

  return permission;
}

export async function getActivePermission(userAddress: string) {
  const normalizedUser = userAddress.toLowerCase();
  const now = new Date();
  
  const [permission] = await db
    .select()
    .from(permissionsRegistry)
    .where(
      and(
        eq(permissionsRegistry.userAddress, normalizedUser),
        isNull(permissionsRegistry.revokedAt),
        gt(permissionsRegistry.expiry, now)
      )
    )
    .limit(1);
    
  return permission || null;
}

export async function revokePermission(userAddress: string) {
  const normalizedUser = userAddress.toLowerCase();
  
  const [updated] = await db
    .update(permissionsRegistry)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(permissionsRegistry.userAddress, normalizedUser),
        isNull(permissionsRegistry.revokedAt)
      )
    )
    .returning();
    
  return updated || null;
}

export async function getAllActivePermissions() {
  const now = new Date();
  return await db
    .select()
    .from(permissionsRegistry)
    .where(
      and(
        isNull(permissionsRegistry.revokedAt),
        gt(permissionsRegistry.expiry, now)
      )
    );
}

export async function updateFeeAllowance(
  userAddress: string,
  approved: boolean
): Promise<typeof permissionsRegistry.$inferSelect | null> {
  const normalizedUser = userAddress.toLowerCase();

  const [updated] = await db
    .update(permissionsRegistry)
    .set({ feeAllowanceApproved: approved })
    .where(
      and(
        eq(permissionsRegistry.userAddress, normalizedUser),
        isNull(permissionsRegistry.revokedAt)
      )
    )
    .returning();

  return updated || null;
}

export async function updateSecurityProfile(userAddress: string, securityProfile: string) {
  const normalizedUser = userAddress.toLowerCase();
  
  const [updated] = await db
    .update(permissionsRegistry)
    .set({ securityProfile })
    .where(
      and(
        eq(permissionsRegistry.userAddress, normalizedUser),
        isNull(permissionsRegistry.revokedAt)
      )
    )
    .returning();
    
  return updated || null;
}
