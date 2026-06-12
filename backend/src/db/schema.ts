import { pgTable, text, timestamp, boolean, numeric, uuid, integer, bigint, unique, customType } from "drizzle-orm/pg-core";

// ── pgvector custom type ──────────────────────────────────────────────────────
// Uses Neon/Postgres pgvector extension for native vector(1536) column type.
// Required SQL (run once on DB):
//   CREATE EXTENSION IF NOT EXISTS vector;
//   CREATE INDEX idx_threat_embedding ON threat_intel_catalog
//     USING hnsw (embedding vector_cosine_ops);
//
// If pgvector is not available (local dev without extension), the column
// falls back to a text column and the JS cosine-similarity fallback in
// db/queries/threatIntel.ts is used automatically.

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    // Postgres vector literal: '[0.1, 0.2, ...]'
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // Strip brackets and parse
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
});

// 1. Permissions Registry (ERC-7715 Permissions)
export const permissionsRegistry = pgTable("permissions_registry", {
  id: uuid("id").defaultRandom().primaryKey(),
  userAddress: text("user_address").notNull().unique(),
  permissionContext: text("permission_context").notNull(), // Serialized JSON permissions
  delegationHash: text("delegation_hash").notNull(),
  sessionSignerAddress: text("session_signer_address").notNull(),
  budgetCap: numeric("budget_cap", { precision: 78, scale: 0 }).notNull(), // Wei scale
  budgetSpent: numeric("budget_spent", { precision: 78, scale: 0 }).default("0").notNull(),
  securityProfile: text("security_profile").default("balanced").notNull(), // 'safe' | 'balanced' | 'manual'
  expiry: timestamp("expiry").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 2. Contract Scan Log
export const contractScanLog = pgTable("contract_scan_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractAddress: text("contract_address").notNull().unique(),
  bytecodeHash: text("bytecode_hash").notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  vulnerable: boolean("vulnerable").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
  verdict: text("verdict").notNull(), // Serialized JSON vulnerabilities & recommendation
  staticRisk: text("static_risk").notNull(), // 'high' | 'medium' | 'low'
  staticFlags: text("static_flags").array().notNull(), // Array of matched static threat flags
  explainer: text("explainer"), // Venice AI natural language explanation
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 3. Protection Events
export const protectionEvents = pgTable("protection_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userAddress: text("user_address").notNull(),
  tokenAddress: text("token_address").notNull(),
  spenderAddress: text("spender_address").notNull(),
  exposedValue: numeric("exposed_value", { precision: 78, scale: 0 }).notNull(), // Value in token decimals
  actionType: text("action_type").notNull(), // 'revocation' | 'veto'
  relayTxHash: text("relay_tx_hash"),
  relayStatus: text("relay_status").notNull(), // 'pending' | 'confirmed' | 'failed'
  severity: text("severity").notNull(), // 'high' | 'medium' | 'low'
  vetoCancelled: boolean("veto_cancelled").default(false).notNull(),
  stagedUntil: timestamp("staged_until"), // Null for Tier 1, populated for Tier 2
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 4. Threat Intel Catalog — uses native pgvector vector(1536) column.
//    Requires: CREATE EXTENSION IF NOT EXISTS vector; (see above)
//    Fallback: if pgvector is unavailable, db/queries/threatIntel.ts
//    automatically falls back to JS-side cosine similarity over all rows.
export const threatIntelCatalog = pgTable("threat_intel_catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  bytecodeHash: text("bytecode_hash").notNull().unique(),
  bytecode: text("bytecode").notNull(),
  // Native vector(1536) column — enables HNSW cosine similarity via pgvector
  embedding: vector("embedding").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 5. Whitelist
export const whitelist = pgTable("whitelist", {
  id: uuid("id").defaultRandom().primaryKey(),
  address: text("address").notNull().unique(),
  protocolName: text("protocol_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 6. Token Approval Cache (to scale dashboard spender loading)
//    The SUM(allowance) over this table gives "Assets Protected" —
//    the total token value currently under Miiso's guard.
export const approvalCache = pgTable("approval_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  userAddress: text("user_address").notNull(),
  tokenAddress: text("token_address").notNull(),
  spenderAddress: text("spender_address").notNull(),
  allowance: numeric("allowance", { precision: 78, scale: 0 }).notNull(),
  lastScannedBlock: bigint("last_scanned_block", { mode: "bigint" }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => ({
  userSpenderTokenUnique: unique("user_spender_token_unique").on(t.userAddress, t.spenderAddress, t.tokenAddress)
}));
