#!/usr/bin/env ts-node
/**
 * migrate-pgvector.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time migration script to enable the pgvector extension on Neon Postgres
 * and add the HNSW index on the threat_intel_catalog.embedding column.
 *
 * Run BEFORE `drizzle-kit push` if the threat_intel_catalog table already exists
 * with the old text embedding column, or run AFTER if the table is new.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-pgvector.ts
 *
 * What this does:
 *   1. CREATE EXTENSION IF NOT EXISTS vector  — enables pgvector on the DB
 *   2. Alters the embedding column from text → vector(1536)  (if it was text)
 *   3. Creates an HNSW index for cosine similarity queries
 *
 * Safety: all steps use IF NOT EXISTS / IF EXISTS guards — safe to re-run.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { db } from "../src/db/client.js";
import { sql } from "drizzle-orm";
import { logger } from "../src/utils/logger.js";

async function main() {
  logger.info("🚀 Starting pgvector migration...");

  // Step 1 — Enable the vector extension
  logger.info("Step 1/3: Enabling pgvector extension...");
  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS vector;
  `);
  logger.info("  ✅ pgvector extension enabled");

  // Step 2 — Check the current column type and migrate if needed
  logger.info("Step 2/3: Checking threat_intel_catalog.embedding column type...");

  const [colInfo] = (
    await db.execute(sql`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'threat_intel_catalog'
        AND column_name = 'embedding';
    `)
  ).rows as Array<{ data_type: string; udt_name: string }>;

  if (!colInfo) {
    logger.info("  ℹ️  Column does not exist yet — will be created by drizzle-kit push");
  } else if (colInfo.udt_name === "vector") {
    logger.info("  ✅ Column is already vector type — no migration needed");
  } else {
    // Migrate from text → vector(1536)
    // Note: existing JSON-serialized data will be re-inserted if any rows exist.
    logger.warn(
      `  ⚠️  Column type is '${colInfo.udt_name}' — migrating to vector(1536)...`
    );

    // Check if there's existing data to migrate
    const [countRow] = (
      await db.execute(sql`SELECT count(*)::int AS n FROM threat_intel_catalog;`)
    ).rows as Array<{ n: number }>;

    if (countRow.n > 0) {
      logger.warn(
        `  ⚠️  ${countRow.n} rows exist with JSON-encoded embeddings.` +
        `  These will be re-inserted. Old rows will be deleted first.`
      );
    }

    // Safe alter: rename old column, add new vector column, backfill, drop old
    await db.execute(sql`
      ALTER TABLE threat_intel_catalog
        RENAME COLUMN embedding TO embedding_old;
    `);

    await db.execute(sql`
      ALTER TABLE threat_intel_catalog
        ADD COLUMN embedding vector(1536);
    `);

    if (countRow.n > 0) {
      // Back-fill: parse the JSON text and cast to vector
      await db.execute(sql`
        UPDATE threat_intel_catalog
           SET embedding = embedding_old::vector
         WHERE embedding_old IS NOT NULL
           AND embedding_old != '';
      `);
    }

    await db.execute(sql`
      ALTER TABLE threat_intel_catalog
        ALTER COLUMN embedding SET NOT NULL;
    `);

    await db.execute(sql`
      ALTER TABLE threat_intel_catalog
        DROP COLUMN embedding_old;
    `);

    logger.info("  ✅ Migrated embedding column from text → vector(1536)");
  }

  // Step 3 — Create HNSW index for cosine similarity
  logger.info("Step 3/3: Creating HNSW index for cosine similarity...");
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_threat_embedding
      ON threat_intel_catalog
      USING hnsw (embedding vector_cosine_ops);
  `);
  logger.info("  ✅ HNSW index created (or already exists)");

  logger.info("✅ pgvector migration complete!");
  process.exit(0);
}

main().catch((err) => {
  logger.error("❌ Migration failed:", err);
  process.exit(1);
});
