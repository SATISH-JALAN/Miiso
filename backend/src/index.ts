import dotenv from "dotenv";
import { runMigrations } from "./db/migrate.js";
import { loadWhitelist } from "./security/whitelist.js";
import { loadUserWhitelists } from "./db/queries/userWhitelist.js";
import { sseManager } from "./server/sse/sseManager.js";
import { rescheduleStagedEvents, clearAllStagedTimers } from "./daemon/confidenceRouter.js";
import { startBlockWatcher, stopBlockWatcher } from "./daemon/blockWatcher.js";
import { buildApp } from "./server/app.js";
import { logger } from "./utils/logger.js";
import { startTelegramBot, stopTelegramBot } from "./telegram/bot.js";
import { telegramNotifier } from "./telegram/notifier.js";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  logger.info("🚀 Starting Miiso Backend Sentinel...");

  try {
    // 1. Run database migrations to ensure schema compliance
    await runMigrations();

    // 2. Load whitelist data into sub-microsecond in-memory lookup cache
    await loadWhitelist();
    await loadUserWhitelists();

    // 3. Start PostgreSQL LISTEN channel notification broker for SSE
    await sseManager.startListening();

    // 4. Recover and reschedule staged Tier 2 veto timers (Crash safety routine)
    await rescheduleStagedEvents();

    // 5. Start real-time block scanner daemon on Base
    await startBlockWatcher();

    // 6. Initialize Telegram bot + notifier
    await telegramNotifier.initialize();
    await startTelegramBot();

    // 7. Build and listen Fastify server
    const app = buildApp();
    
    await app.listen({ port: PORT, host: HOST });
    logger.info(`✨ Miiso Fastify API Server running on http://${HOST}:${PORT}`);

    // Graceful Shutdown hooks
    const shutdown = async (signal: string) => {
      logger.warn(`🛑 Received ${signal}. Initiating graceful shutdown...`);
      
      stopTelegramBot();

      // Stop new block listener
      stopBlockWatcher();
      
      // Stop staged veto timeout intervals
      clearAllStagedTimers();

      // Shut down SSE manager (close DB listener client)
      sseManager.shutdown();

      // Close fastify server connections
      await app.close();
      logger.info("👋 Miiso Backend terminated cleanly.");
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

  } catch (error) {
    logger.error("❌ Critical: Server bootstrap failed!", error);
    process.exit(1);
  }
}

main();
