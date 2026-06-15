import { Context } from "grammy";
import { cancelVeto } from "../../db/queries/protectionEvents.js";
import { stagedTimers } from "../../daemon/confidenceRouter.js";
import { setUserWhitelist } from "../../db/queries/userWhitelist.js";
import { db } from "../../db/client.js";
import { protectionEvents } from "../../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { sseManager } from "../../server/sse/sseManager.js";

/**
 * Handles the "Cancel Revocation" inline button (Tier 2 veto)
 */
export async function handleVetoAction(ctx: Context) {
  const callbackData = ctx.callbackQuery?.data;
  if (!callbackData || !callbackData.startsWith("veto:")) return;

  const eventId = callbackData.split(":")[1];

  try {
    const [event] = await db.select().from(protectionEvents).where(eq(protectionEvents.id, eventId)).limit(1);

    if (!event || (event.relayStatus !== "staged" && event.relayStatus !== "pending")) {
      await ctx.answerCallbackQuery({ text: "❌ Event not found or already executed", show_alert: true });
      return;
    }

    if (event.stagedUntil) {
      const now = new Date();
      if (now > new Date(event.stagedUntil)) {
        await ctx.answerCallbackQuery({ text: "❌ Veto window expired — revocation already fired", show_alert: true });
        return;
      }
    }

    // Cancel in DB
    await db.update(protectionEvents).set({ vetoCancelled: true, relayStatus: "failed" }).where(eq(protectionEvents.id, eventId));
    await cancelVeto(eventId);

    // Clear in-memory timer
    if (stagedTimers.has(eventId)) {
      clearTimeout(stagedTimers.get(eventId));
      stagedTimers.delete(eventId);
    }

    // Emit events
    await db.execute(sql`NOTIFY miiso_events, ${JSON.stringify({ type: "VETO_CONFIRMED", userAddress: event.userAddress, eventId })}`);
    sseManager.sendEventToUser(event.userAddress, "VETO_CONFIRMED", { eventId, message: "Auto-revocation cancelled by user veto" });

    // Update message
    await ctx.editMessageText(
      ctx.callbackQuery?.message?.text?.replace("⏰ THREAT STAGED", "❌ REVOCATION CANCELLED") || "❌ Revocation Cancelled", 
      { reply_markup: undefined }
    );
    await ctx.answerCallbackQuery("✅ Revocation cancelled successfully.");
    logger.info(`🚫 [Telegram] Veto confirmed via inline button for event ${eventId}`);
  } catch (err) {
    logger.error("Error handling veto callback:", err);
    await ctx.answerCallbackQuery({ text: "❌ Error processing request", show_alert: true });
  }
}

/**
 * Handles the "Whitelist Spender" inline button
 */
export async function handleWhitelistAction(ctx: Context) {
  const callbackData = ctx.callbackQuery?.data;
  if (!callbackData || !callbackData.startsWith("whitelist:")) return;

  const eventId = callbackData.split(":")[1];

  try {
    const [event] = await db.select().from(protectionEvents).where(eq(protectionEvents.id, eventId)).limit(1);

    if (!event) {
      await ctx.answerCallbackQuery({ text: "❌ Event not found", show_alert: true });
      return;
    }

    // Add to whitelist
    await setUserWhitelist(event.userAddress, [event.spenderAddress]);

    // Also cancel the veto if it's pending
    if ((event.relayStatus === "staged" || event.relayStatus === "pending") && !event.vetoCancelled) {
      if (!event.stagedUntil || new Date() <= new Date(event.stagedUntil)) {
        await db.update(protectionEvents).set({ vetoCancelled: true, relayStatus: "failed" }).where(eq(protectionEvents.id, eventId));
        await cancelVeto(eventId);
        if (stagedTimers.has(eventId)) {
          clearTimeout(stagedTimers.get(eventId));
          stagedTimers.delete(eventId);
        }
      }
    }

    // Update message
    await ctx.editMessageText(
      ctx.callbackQuery?.message?.text?.replace("⏰ THREAT STAGED", "✅ SPENDER WHITELISTED") || "✅ Spender Whitelisted", 
      { reply_markup: undefined }
    );
    await ctx.answerCallbackQuery("✅ Spender added to your whitelist.");
    logger.info(`✅ [Telegram] Spender ${event.spenderAddress} whitelisted via inline button for user ${event.userAddress}`);
  } catch (err) {
    logger.error("Error handling whitelist callback:", err);
    await ctx.answerCallbackQuery({ text: "❌ Error processing request", show_alert: true });
  }
}
