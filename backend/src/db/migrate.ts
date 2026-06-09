import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log("⚡ Database migrations: starting...");
  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, "migrations"),
    });
    console.log("✅ Database migrations: completed successfully.");
  } catch (error) {
    console.error("❌ Database migrations: failed to run:", error);
    throw error;
  }
}

// Allow direct execution if run via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
