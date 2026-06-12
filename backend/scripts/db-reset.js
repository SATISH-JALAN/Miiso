import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

async function main() {
  console.log("Connecting to database to drop tables...");
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("Dropping all project tables with CASCADE...");
    
    const tables = [
      "permissions_registry",
      "contract_scan_log",
      "protection_events",
      "threat_intel_catalog",
      "whitelist",
      "approval_cache"
    ];

    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
      console.log(`Dropped table: ${table}`);
    }

    console.log("✅ All tables dropped successfully!");
  } catch (error) {
    console.error("❌ Failed to drop tables:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
