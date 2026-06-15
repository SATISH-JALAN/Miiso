import { CommandContext, Context } from "grammy";
import { verifyTelegramLink, getTelegramIdForUser } from "../../db/queries/telegramLinks.js";
import { telegramNotifier } from "../notifier.js";
import { logger } from "../../utils/logger.js";
import { db } from "../../db/client.js";
import { telegramLinks } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export async function verifyCommand(ctx: CommandContext<Context>) {
  const args = ctx.match;
  if (!args) {
    return ctx.reply("❌ Please provide the verification code.\n\nUsage: <code>/verify 123456</code>", { parse_mode: "HTML" });
  }

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    const success = await verifyTelegramLink(telegramId, args.trim());
    
    if (success) {
      // Find the user address that was just verified to update the cache
      const [link] = await db.select().from(telegramLinks).where(eq(telegramLinks.telegramId, BigInt(telegramId))).limit(1);
      if (link) {
        telegramNotifier.updateCache(link.userAddress, telegramId);
      }

      await ctx.reply(
        "✅ <b>Wallet Successfully Linked!</b>\n\n" +
        "You will now receive Miiso threat alerts directly in this chat.\n\n" +
        "Use <code>/help</code> to see available commands.",
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.reply("❌ Invalid verification code or no pending link request found.\n\nPlease run <code>/link &lt;address&gt;</code> again.", { parse_mode: "HTML" });
    }
  } catch (error) {
    logger.error(`Error verifying telegram link for ${telegramId}:`, error);
    await ctx.reply("❌ An error occurred during verification. Please try again.");
  }
}
