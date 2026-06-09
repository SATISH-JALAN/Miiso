import { db } from "../db/client.js";
import { whitelist } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getAddress } from "viem";

// In-memory cache set for sub-microsecond lookups
const whitelistCache = new Set<string>();

/**
 * Loads whitelist addresses from the database into the in-memory cache.
 */
export async function loadWhitelist(): Promise<void> {
  console.log("⚡ Whitelist: loading from database...");
  try {
    const records = await db.select().from(whitelist);
    whitelistCache.clear();
    
    for (const record of records) {
      whitelistCache.add(record.address.toLowerCase());
    }
    
    console.log(`✅ Whitelist: loaded ${whitelistCache.size} addresses into memory.`);
  } catch (error) {
    console.error("❌ Whitelist: failed to load whitelist from DB:", error);
    throw error;
  }
}

/**
 * Checks if a contract address is whitelisted (known-safe protocol).
 */
export function isWhitelisted(address: string): boolean {
  return whitelistCache.has(address.toLowerCase());
}

/**
 * Adds a new address to the whitelist in the database and reloads the cache.
 */
export async function addAddressToWhitelist(address: string, protocolName: string): Promise<void> {
  const normalizedAddress = getAddress(address).toLowerCase();
  
  await db
    .insert(whitelist)
    .values({
      address: normalizedAddress,
      protocolName,
      createdAt: new Date(),
    })
    .onConflictDoNothing();
    
  // Add to in-memory set directly to avoid full DB scan
  whitelistCache.add(normalizedAddress);
  console.log(`✅ Whitelist: Added ${address} (${protocolName})`);
}

/**
 * Removes an address from the whitelist in the database and reloads the cache.
 */
export async function removeAddressFromWhitelist(address: string): Promise<void> {
  const normalizedAddress = getAddress(address).toLowerCase();
  
  await db
    .delete(whitelist)
    .where(eq(whitelist.address, normalizedAddress));
    
  whitelistCache.delete(normalizedAddress);
  console.log(`✅ Whitelist: Removed ${address}`);
}
