import { db } from "../src/db/client.js";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Checking pgvector extension status in database...");
    
    // Check if vector extension is available/installed
    const extensionsResult = await db.execute(sql`
      SELECT * FROM pg_extension WHERE extname = 'vector';
    `);
    
    console.log("pg_extension query result:", extensionsResult.rows);
    
    if (extensionsResult.rows.length === 0) {
      console.log("pgvector extension is not installed. Trying to create extension...");
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
      console.log("Successfully created vector extension!");
    } else {
      console.log("pgvector extension is already installed.");
    }
  } catch (error: any) {
    console.error("Error checking or creating pgvector extension:", error.message || error);
  } finally {
    process.exit(0);
  }
}

main();
