import { eq, and } from "drizzle-orm";
import { getAddress } from "viem";
import { db } from "../client.js";
import { userWhitelist } from "../schema.js";

const userWhitelistCache = new Map<string, Set<string>>();

function cacheKey(user: string) {
  return user.toLowerCase();
}

/**
 * Loads all user whitelist entries into the in-memory cache.
 */
export async function loadUserWhitelists(): Promise<void> {
  const records = await db.select().from(userWhitelist);
  userWhitelistCache.clear();

  for (const record of records) {
    const key = cacheKey(record.userAddress);
    if (!userWhitelistCache.has(key)) {
      userWhitelistCache.set(key, new Set());
    }
    userWhitelistCache.get(key)!.add(record.address.toLowerCase());
  }

  console.log(
    `✅ UserWhitelist: loaded entries for ${userWhitelistCache.size} users.`
  );
}

export function isUserWhitelisted(
  userAddress: string,
  contractAddress: string
): boolean {
  const set = userWhitelistCache.get(cacheKey(userAddress));
  return set?.has(contractAddress.toLowerCase()) ?? false;
}

/**
 * Replaces a user's custom whitelist with the provided addresses.
 */
export async function setUserWhitelist(
  userAddress: string,
  addresses: string[]
): Promise<void> {
  const normalizedUser = userAddress.toLowerCase();

  await db
    .delete(userWhitelist)
    .where(eq(userWhitelist.userAddress, normalizedUser));

  const unique = [
    ...new Set(
      addresses.map((a) => {
        try {
          return getAddress(a).toLowerCase();
        } catch {
          return a.toLowerCase();
        }
      })
    ),
  ];

  if (unique.length > 0) {
    await db.insert(userWhitelist).values(
      unique.map((address) => ({
        userAddress: normalizedUser,
        address,
        protocolName: "Custom",
      }))
    );
  }

  userWhitelistCache.set(normalizedUser, new Set(unique));
}

export async function getUserWhitelist(
  userAddress: string
): Promise<string[]> {
  const normalizedUser = userAddress.toLowerCase();
  const records = await db
    .select()
    .from(userWhitelist)
    .where(eq(userWhitelist.userAddress, normalizedUser));

  return records.map((r) => r.address);
}
