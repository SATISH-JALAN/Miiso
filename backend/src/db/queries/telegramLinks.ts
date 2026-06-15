import { eq, and } from "drizzle-orm";
import { db } from "../client.js";
import { telegramLinks } from "../schema.js";

/**
 * Upserts a Telegram link for a user address.
 * If unverified, it generates a new nonce.
 */
export async function upsertTelegramLink(
  userAddress: string,
  telegramId: bigint | number,
  username: string | null,
  nonce: string
) {
  const normalizedUser = userAddress.toLowerCase();
  
  // Use insert with onConflictDoUpdate since userAddress is UNIQUE
  const [result] = await db.insert(telegramLinks)
    .values({
      userAddress: normalizedUser,
      telegramId: BigInt(telegramId),
      username,
      nonce,
      verified: false
    })
    .onConflictDoUpdate({
      target: telegramLinks.userAddress,
      set: {
        telegramId: BigInt(telegramId),
        username,
        nonce,
        verified: false
      }
    })
    .returning();
    
  return result;
}

/**
 * Verifies a Telegram link using the 6-digit nonce.
 */
export async function verifyTelegramLink(telegramId: bigint | number, nonce: string) {
  const [pending] = await db.select()
    .from(telegramLinks)
    .where(
      and(
        eq(telegramLinks.telegramId, BigInt(telegramId)),
        eq(telegramLinks.verified, false)
      )
    )
    .limit(1);

  if (!pending) return false;
  if (pending.nonce !== nonce) return false;

  const [updated] = await db.update(telegramLinks)
    .set({ verified: true, nonce: null })
    .where(eq(telegramLinks.id, pending.id))
    .returning();

  return updated != null;
}

/**
 * Gets the verified Telegram ID for a given user address.
 */
export async function getTelegramIdForUser(userAddress: string) {
  const normalizedUser = userAddress.toLowerCase();
  const [link] = await db.select()
    .from(telegramLinks)
    .where(
      and(
        eq(telegramLinks.userAddress, normalizedUser),
        eq(telegramLinks.verified, true),
        eq(telegramLinks.alertsEnabled, true)
      )
    )
    .limit(1);

  return link ? link.telegramId : null;
}

/**
 * Gets all verified links (useful for hydrating the cache on startup).
 */
export async function getAllVerifiedLinks() {
  return await db.select()
    .from(telegramLinks)
    .where(eq(telegramLinks.verified, true));
}

/**
 * Removes a Telegram link for a user address or telegram ID.
 */
export async function unlinkTelegram(identifier: { userAddress?: string, telegramId?: bigint | number }) {
  if (identifier.userAddress) {
    await db.delete(telegramLinks).where(eq(telegramLinks.userAddress, identifier.userAddress.toLowerCase()));
  } else if (identifier.telegramId) {
    await db.delete(telegramLinks).where(eq(telegramLinks.telegramId, BigInt(identifier.telegramId)));
  }
}
