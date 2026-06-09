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
      embedding: data.embedding,
      createdAt: new Date(),
    })
    .returning();
    
  return inserted;
}

export async function findSimilarThreats(embedding: number[], limit = 5) {
  // Convert embedding array to string format "[x,y,z...]" for pgvector input
  const embeddingString = `[${embedding.join(",")}]`;
  
  return await db
    .select({
      id: threatIntelCatalog.id,
      bytecodeHash: threatIntelCatalog.bytecodeHash,
      bytecode: threatIntelCatalog.bytecode,
      similarity: sql<number>`1 - (${threatIntelCatalog.embedding} <=> ${embeddingString}::vector)`
    })
    .from(threatIntelCatalog)
    .orderBy(sql`${threatIntelCatalog.embedding} <=> ${embeddingString}::vector`)
    .limit(limit);
}
