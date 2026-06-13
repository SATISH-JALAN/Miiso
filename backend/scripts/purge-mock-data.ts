/**
 * One-shot script to purge seeded mock/demo data from the database.
 * Removes protection events, contract scans, and approval cache entries
 * that were inserted by the /dev/seed-wallet endpoint.
 */
import { db } from "../src/db/client.js";
import { protectionEvents, contractScanLog, approvalCache } from "../src/db/schema.js";
import { sql } from "drizzle-orm";

const MOCK_ADDRESSES = [
  "0x6666666666666666666666666666666666666666",
  "0x7777777777777777777777777777777777777777",
  "0x9488a0b0b0000000000000000000000000000099",
];

async function purgeMockData() {
  console.log("🧹 Purging seeded mock data from database...\n");

  // 1. Delete mock protection events (by spender address)
  for (const addr of MOCK_ADDRESSES) {
    const result = await db
      .delete(protectionEvents)
      .where(sql`lower(${protectionEvents.spenderAddress}) = ${addr.toLowerCase()}`);
    console.log(`  ✓ Deleted protection events for spender ${addr.slice(0, 10)}...`);
  }

  // 2. Delete mock contract scans
  for (const addr of MOCK_ADDRESSES) {
    await db
      .delete(contractScanLog)
      .where(sql`lower(${contractScanLog.contractAddress}) = ${addr.toLowerCase()}`);
    console.log(`  ✓ Deleted contract scan log for ${addr.slice(0, 10)}...`);
  }

  // 3. Delete mock approval cache entries (by spender)
  for (const addr of MOCK_ADDRESSES) {
    await db
      .delete(approvalCache)
      .where(sql`lower(${approvalCache.spenderAddress}) = ${addr.toLowerCase()}`);
    console.log(`  ✓ Deleted approval cache for spender ${addr.slice(0, 10)}...`);
  }

  console.log("\n✅ Mock data purge complete. Dashboard will now show only real data.");
  process.exit(0);
}

purgeMockData().catch((err) => {
  console.error("❌ Purge failed:", err);
  process.exit(1);
});
