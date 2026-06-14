import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

// Support SSL connections for cloud hosts (like Neon)
const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
const sslConfig = isLocal ? false : { rejectUnauthorized: false };

export const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: sslConfig,
  // Keep connections alive so Neon doesn't terminate them mid-query
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  // Drop idle connections before Neon's server-side timeout kicks in
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  max: 10,
});

// Prevent unhandled 'error' events from crashing the process.
// Neon terminates idle connections server-side; this catches those disconnects gracefully.
pool.on("error", (err) => {
  console.error("⚠️ [DB Pool] Unexpected connection error (will reconnect on next query):", err.message);
});

export const db = drizzle(pool);

// Returns a dedicated client connection for PostgreSQL LISTEN/NOTIFY
// because LISTEN requires a dedicated connection that is never returned to the pool
export async function getDedicatedPgClient(): Promise<pg.Client> {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: sslConfig,
  });
  await client.connect();
  return client;
}
