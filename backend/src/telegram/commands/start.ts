import { CommandContext, Context } from "grammy";

export async function startCommand(ctx: CommandContext<Context>) {
  const message = `
🛡️ <b>Miiso Bot</b>

I'm your autonomous DeFi security agent on Base.
I monitor the blockchain 24/7 and alert you the moment a threat targets your wallet.

━━━━━━━━━━━━━━━━━━━━━━━━

🔗 <code>/link &lt;address&gt;</code> — Connect your wallet
📊 <code>/status</code> — View your protection status
❓ <code>/help</code> — See all commands

🌐 <b>Dashboard:</b> <a href="https://miiso-ai.vercel.app">miiso-ai.vercel.app</a>
`;

  await ctx.reply(message, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
}
