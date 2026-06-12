import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set in environment.");
  process.exit(1);
}

async function main() {
  console.log("Connecting to database to enable pgvector...");
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("Connected! Running: CREATE EXTENSION IF NOT EXISTS vector;");
    await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
    console.log("✅ Extension 'vector' created/verified successfully!");
  } catch (error) {
    console.error("❌ Failed to enable extension:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
