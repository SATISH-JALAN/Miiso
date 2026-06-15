import { CommandContext, Context } from "grammy";
import { unlinkTelegram } from "../../db/queries/telegramLinks.js";
import { logger } from "../../utils/logger.js";

export async function unlinkCommand(ctx: CommandContext<Context>) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await unlinkTelegram({ telegramId });
    await ctx.reply("🔌 <b>Wallet Unlinked</b>\n\nYou will no longer receive threat alerts in this chat.", { parse_mode: "HTML" });
  } catch (error) {
    logger.error(`Error unlinking telegram for ${telegramId}:`, error);
    await ctx.reply("❌ An error occurred while unlinking. Please try again.");
  }
}
