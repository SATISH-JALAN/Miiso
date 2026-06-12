import { eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { threatIntelCatalog } from "../schema.js";
import { logger } from "../../utils/logger.js";

export async function insertThreatIntel(data: {
  bytecodeHash: string;
  bytecode: string;
  embedding: number[];
}) {
  const [inserted] = await db
    .insert(threatIntelCatalog)
    .values({
      bytecodeHash: data.bytecodeHash,
      bytecode: data.bytecode,
      // vector() customType toDriver() converts number[] → '[0.1,0.2,...]'
      embedding: data.embedding,
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
    
  return inserted || null;
}

/**
 * Finds the most similar threats using pgvector HNSW cosine similarity.
 *
 * Primary path: native `<=>` operator (requires pgvector extension + HNSW index).
 * Fallback path: JS-side cosine similarity (works without pgvector).
 *
 * SQL equivalent (primary):
 *   SELECT *, embedding <=> '[...]' AS distance
 *   FROM threat_intel_catalog
 *   ORDER BY distance ASC
 *   LIMIT $limit;
 */
export async function findSimilarThreats(embedding: number[], limit = 5) {
  // Format the vector literal for the <=> operator
  const vectorLiteral = `[${embedding.join(",")}]`;

  try {
    // ── Primary: native pgvector cosine distance operator ──────────────
    // `<=>` is cosine distance (0 = identical, 2 = opposite).
    // We sort ASC so smallest distance = most similar.
    const rows = await db.execute(
      sql`
        SELECT
          id,
          bytecode_hash AS "bytecodeHash",
          bytecode,
          embedding,
          (embedding <=> ${vectorLiteral}::vector) AS distance
        FROM threat_intel_catalog
        ORDER BY distance ASC
        LIMIT ${limit}
      `
    );

    return (rows.rows as Array<{
      id: string;
      bytecodeHash: string;
      bytecode: string;
      embedding: number[];
      distance: number;
    }>).map((r) => ({
      ...r,
      similarity: 1 - r.distance, // Convert cosine distance → similarity
    }));

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    // If pgvector extension is not installed the operator `<=>` won't exist.
    // Fall back to JS-side cosine similarity so the app stays functional.
    if (
      msg.includes("operator does not exist") ||
      msg.includes("function vector") ||
      msg.includes("type \"vector\"")
    ) {
      logger.warn(
        "[ThreatIntel] pgvector not available — falling back to JS cosine similarity. " +
          "Run: CREATE EXTENSION IF NOT EXISTS vector;"
      );
      return findSimilarThreatsJS(embedding, limit);
    }

    throw err;
  }
}

// ── JS-side fallback (no pgvector) ───────────────────────────────────────────

async function findSimilarThreatsJS(embedding: number[], limit: number) {
  // Load all rows — acceptable at hackathon catalog size (<10k rows)
  const allThreats = await db
    .select({
      id: threatIntelCatalog.id,
      bytecodeHash: threatIntelCatalog.bytecodeHash,
      bytecode: threatIntelCatalog.bytecode,
      embedding: threatIntelCatalog.embedding,
    })
    .from(threatIntelCatalog);

  const scored = allThreats.map((threat) => {
    // vector customType fromDriver() already returns number[]
    const storedEmbedding = threat.embedding as unknown as number[];
    const similarity = cosineSimilarity(embedding, storedEmbedding);
    return { ...threat, similarity, distance: 1 - similarity };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, limit);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
