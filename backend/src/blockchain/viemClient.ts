import { createPublicClient, fallback, http, webSocket } from "viem";
import { base } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

const isDemo = process.env.DEMO_MODE === "true";

// Log configuration status
if (isDemo) {
  console.log("ℹ️ Blockchain client initialized in DEMO_MODE. Watching local Anvil fork.");
} else {
  if (!process.env.QUICKNODE_WSS_URL || !process.env.ALCHEMY_WSS_URL) {
    console.warn("⚠️ RPC credentials missing. WebSocket failover might not function correctly.");
  }
}

// Fallback transport configuration
const transport = isDemo
  ? fallback([
      http("http://127.0.0.1:8545"),
      http("https://mainnet.base.org")
    ])
  : fallback([
      // Try QuickNode WebSocket first for low-latency Flashblocks
      process.env.QUICKNODE_WSS_URL ? webSocket(process.env.QUICKNODE_WSS_URL) : undefined,
      // Fallback to Alchemy WebSocket
      process.env.ALCHEMY_WSS_URL ? webSocket(process.env.ALCHEMY_WSS_URL) : undefined,
      // Last resort: Standard Base Mainnet HTTP RPC
      http(process.env.HTTP_RPC_URL || "https://mainnet.base.org")
    ].filter(Boolean) as any);

export const publicClient = createPublicClient({
  chain: base,
  transport,
  pollingInterval: isDemo ? 500 : 1000,
});
