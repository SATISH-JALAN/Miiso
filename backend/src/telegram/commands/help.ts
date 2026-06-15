import { CommandContext, Context } from "grammy";

export async function helpCommand(ctx: CommandContext<Context>) {
  const message = `
🛡️ <b>Miiso Commands</b>

🔗 <code>/link &lt;address&gt;</code> — Connect a wallet to this chat
✅ <code>/verify &lt;code&gt;</code> — Verify wallet connection
🔌 <code>/unlink</code> — Disconnect your wallet

<i>More commands coming soon in Tier 2!</i>
`;
  await ctx.reply(message, { parse_mode: "HTML" });
}
