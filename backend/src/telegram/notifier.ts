import { Bot, InlineKeyboard } from "grammy";
import { getAllVerifiedLinks } from "../db/queries/telegramLinks.js";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

class TelegramNotifier {
  private bot: Bot | null = null;
  // userAddress -> telegramId
  private linkCache = new Map<string, number | bigint>();

  constructor() {
    if (TELEGRAM_BOT_TOKEN) {
      this.bot = new Bot(TELEGRAM_BOT_TOKEN);
    }
  }

  async initialize() {
    if (!this.bot) return;
    
    try {
      const links = await getAllVerifiedLinks();
      for (const link of links) {
        this.linkCache.set(link.userAddress.toLowerCase(), link.telegramId);
      }
      logger.info(`✅ TelegramNotifier initialized with ${this.linkCache.size} verified links.`);
    } catch (error) {
      logger.error("❌ Failed to initialize TelegramNotifier:", error);
    }
  }

  public updateCache(userAddress: string, telegramId: number | bigint) {
    this.linkCache.set(userAddress.toLowerCase(), telegramId);
  }

  public removeFromCache(userAddress: string) {
    this.linkCache.delete(userAddress.toLowerCase());
  }

  /**
   * Sends an alert to the global admin channel.
   */
  async notifyAdmin(message: string) {
    if (!this.bot || !TELEGRAM_CHAT_ID) return;
    
    try {
      await this.bot.api.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: "HTML" });
    } catch (error) {
      logger.error("❌ TelegramNotifier failed to send admin alert:", error);
    }
  }

  /**
   * Sends a personalized alert to a specific user.
   */
  async notifyThreat(data: {
    tier: 1 | 2 | 3;
    user: string;
    token: string;
    spender: string;
    exposedValue: string;
    confidence: number;
    profile: string;
    eventId?: string;
  }) {
    if (!this.bot) return;

    const telegramId = this.linkCache.get(data.user.toLowerCase());
    
    let emoji = "⚠️";
    let statusText = "Manual Action Required (Monitoring Mode)";
    if (data.tier === 1) {
      emoji = "🚨";
      statusText = "Auto-Revocation Dispatched (1Shot)";
    } else if (data.tier === 2) {
      emoji = "⏰";
      statusText = "Pending (60s countdown)";
    }

    const message = `
${emoji} <b>MIISO — THREAT ${data.tier === 1 ? "BLOCKED" : data.tier === 2 ? "STAGED" : "ALERT"}</b>

User: <code>${data.user}</code>
Token: <code>${data.token}</code>
Spender: <code>${data.spender}</code>
Exposed Value: <code>${data.exposedValue}</code>

Status: <b>${statusText}</b>
Profile: <b>${data.profile.toUpperCase()}</b>
Combined Confidence: <b>${(data.confidence * 100).toFixed(1)}%</b>
`;

    // 1. Send to Global Admin Channel
    await this.notifyAdmin(message);

    // 2. Send to User with Inline Keyboard (if linked)
    if (telegramId) {
      try {
        let keyboard = new InlineKeyboard()
          .url("🔍 BaseScan", `https://sepolia.basescan.org/address/${data.spender}`)
          .url("📊 Dashboard", "https://miiso-ai.vercel.app");

        if (data.tier === 2 && data.eventId) {
          keyboard = new InlineKeyboard()
            .text("❌ Cancel Revocation", `veto:${data.eventId}`)
            .text("✅ Whitelist Spender", `whitelist:${data.eventId}`)
            .row()
            .url("🔍 BaseScan", `https://sepolia.basescan.org/address/${data.spender}`)
            .url("📊 Dashboard", "https://miiso-ai.vercel.app");
        }

        await this.bot.api.sendMessage(telegramId.toString(), message, {
          parse_mode: "HTML",
          reply_markup: keyboard
        });
        logger.info(`📡 Sent personalized Telegram alert to ${data.user} (Tier ${data.tier})`);
      } catch (error) {
        logger.error(`❌ Failed to send personalized alert to ${data.user}:`, error);
      }
    }
  }
}

export const telegramNotifier = new TelegramNotifier();
