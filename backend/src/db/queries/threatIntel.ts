import { eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { threatIntelCatalog } from "../schema.js";

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
      embedding: JSON.stringify(data.embedding), // Serialize as JSON text
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
    
  return inserted || null;
}

/**
 * Finds similar threats using cosine similarity computed in JS.
 * (pgvector not available — fallback to application-level similarity)
 */
export async function findSimilarThreats(embedding: number[], limit = 5) {
  // Fetch all stored embeddings (acceptable for hackathon-scale catalog)
  const allThreats = await db
    .select({
      id: threatIntelCatalog.id,
      bytecodeHash: threatIntelCatalog.bytecodeHash,
      bytecode: threatIntelCatalog.bytecode,
      embedding: threatIntelCatalog.embedding,
    })
    .from(threatIntelCatalog);

  // Compute cosine similarity in JS
  const scored = allThreats.map((threat) => {
    const storedEmbedding: number[] = JSON.parse(threat.embedding);
    const similarity = cosineSimilarity(embedding, storedEmbedding);
    return { ...threat, similarity };
  });

  // Sort by descending similarity and return top N
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, limit);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
