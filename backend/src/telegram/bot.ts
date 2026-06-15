import { Bot } from "grammy";
import { logger } from "../utils/logger.js";
import { startCommand } from "./commands/start.js";
import { linkCommand } from "./commands/link.js";
import { verifyCommand } from "./commands/verify.js";
import { unlinkCommand } from "./commands/unlink.js";
import { helpCommand } from "./commands/help.js";
import { handleVetoAction, handleWhitelistAction } from "./callbacks/index.js";
import dotenv from "dotenv";

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let botInstance: Bot | null = null;

export async function startTelegramBot() {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn("⚠️ TELEGRAM_BOT_TOKEN is not set. Telegram bot will not start.");
    return;
  }

  try {
    botInstance = new Bot(TELEGRAM_BOT_TOKEN);

    // Register Commands
    botInstance.command("start", startCommand);
    botInstance.command("link", linkCommand);
    botInstance.command("verify", verifyCommand);
    botInstance.command("unlink", unlinkCommand);
    botInstance.command("help", helpCommand);

    // Register Callback Queries (Inline buttons)
    botInstance.on("callback_query:data", async (ctx, next) => {
      const data = ctx.callbackQuery.data;
      if (data.startsWith("veto:")) {
        await handleVetoAction(ctx);
      } else if (data.startsWith("whitelist:")) {
        await handleWhitelistAction(ctx);
      } else {
        await next();
      }
    });

    // Start polling in the background
    botInstance.start({
      onStart: (botInfo) => {
        logger.info(`✅ Telegram Bot started (long-polling) as @${botInfo.username}`);
      }
    }).catch(err => {
      logger.error("❌ Telegram Bot failed during polling:", err);
    });

  } catch (error) {
    logger.error("❌ Failed to initialize Telegram Bot:", error);
  }
}

export function stopTelegramBot() {
  if (botInstance) {
    botInstance.stop();
    logger.info("🛑 Telegram Bot stopped.");
  }
}
