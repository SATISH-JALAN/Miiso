import { eq, desc } from "drizzle-orm";
import { db } from "../client.js";
import { contractScanLog } from "../schema.js";

export async function insertScan(data: {
  contractAddress: string;
  bytecodeHash: string;
  blockNumber: bigint;
  vulnerable: boolean;
  confidence: string; // numeric string
  verdict: string; // serialized JSON
  staticRisk: string; // 'high' | 'medium' | 'low'
  staticFlags: string[];
  explainer?: string | null;
}) {
  const [inserted] = await db
    .insert(contractScanLog)
    .values({
      contractAddress: data.contractAddress.toLowerCase(),
      bytecodeHash: data.bytecodeHash,
      blockNumber: data.blockNumber,
      vulnerable: data.vulnerable,
      confidence: data.confidence,
      verdict: data.verdict,
      staticRisk: data.staticRisk,
      staticFlags: data.staticFlags,
      explainer: data.explainer,
      createdAt: new Date(),
    })
    .returning();
    
  return inserted;
}

export async function getScanByAddress(contractAddress: string) {
  const [scan] = await db
    .select()
    .from(contractScanLog)
    .where(eq(contractScanLog.contractAddress, contractAddress.toLowerCase()))
    .limit(1);
    
  return scan || null;
}

export async function getRecentScans(limit = 20) {
  return await db
    .select()
    .from(contractScanLog)
    .orderBy(desc(contractScanLog.createdAt))
    .limit(limit);
}
