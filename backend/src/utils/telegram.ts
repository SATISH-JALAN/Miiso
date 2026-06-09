import { logger } from "./logger.js";
import dotenv from "dotenv";

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Sends a notification message to Telegram.
 * If credentials are missing, falls back to logging the message.
 */
export async function sendTelegramAlert(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    logger.info(`📢 [Telegram Fallback Log] ${message}`);
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML"
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`❌ Failed to send Telegram message: ${errText}`);
      return false;
    }

    logger.info("📡 Telegram alert notification dispatched successfully.");
    return true;
  } catch (err) {
    logger.error("❌ Exception occurred during sending Telegram alert:", err);
    return false;
  }
}
