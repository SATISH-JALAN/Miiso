import { CommandContext, Context } from "grammy";
import { getAddress } from "viem";
import { upsertTelegramLink } from "../../db/queries/telegramLinks.js";
import { logger } from "../../utils/logger.js";

export async function linkCommand(ctx: CommandContext<Context>) {
  const args = ctx.match;
  if (!args) {
    return ctx.reply("❌ Please provide your wallet address.\n\nUsage: <code>/link 0xYourAddress...</code>", { parse_mode: "HTML" });
  }

  let userAddress: string;
  try {
    userAddress = getAddress(args);
  } catch (err) {
    return ctx.reply("❌ Invalid Ethereum address format. Please check and try again.");
  }

  const from = ctx.from;
  if (!from) return;

  const telegramId = from.id;
  const username = from.username ? `@${from.username}` : null;
  
  // Generate a random 6-digit code
  const nonce = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await upsertTelegramLink(userAddress, telegramId, username, nonce);
    
    await ctx.reply(
      `🔗 Linking wallet: <code>${userAddress}</code>\n\n` +
      `Your verification code is: <b>${nonce}</b>\n\n` +
      `Reply with <code>/verify ${nonce}</code> to confirm this connection.`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error(`Error linking telegram for ${userAddress}:`, error);
    await ctx.reply("❌ An error occurred while generating the link code. Please try again.");
  }
}
