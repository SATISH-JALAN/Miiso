import { createPublicClient, fallback, http, webSocket } from "viem";
import { CHAIN } from "../config/chain.js";
import dotenv from "dotenv";

dotenv.config();

const isDemo = process.env.DEMO_MODE === "true";

// Log configuration status
if (isDemo) {
  console.log("ℹ️ Blockchain client initialized in DEMO_MODE. Watching local Anvil fork.");
} else {
  if (!process.env.QUICKNODE_WSS_URL && !process.env.ALCHEMY_WSS_URL) {
    console.warn("⚠️ RPC credentials missing. WebSocket failover might not function correctly.");
  }
}

const quicknodeWss = process.env.QUICKNODE_WSS_URL?.trim();
const alchemyWss = process.env.ALCHEMY_WSS_URL?.trim();
const httpRpc = process.env.HTTP_RPC_URL?.trim();

// Fallback transport configuration
const transport = isDemo
  ? http(process.env.ANVIL_RPC_URL?.trim() || "http://127.0.0.1:8545")
  : fallback([
      // Try QuickNode WebSocket first for low-latency Flashblocks
      quicknodeWss ? webSocket(quicknodeWss) : undefined,
      // Fallback to Alchemy WebSocket
      alchemyWss ? webSocket(alchemyWss) : undefined,
      // Last resort: Standard Base Sepolia HTTP RPC
      http(httpRpc || "https://sepolia.base.org")
    ].filter(Boolean) as any);

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport,
  pollingInterval: isDemo ? 500 : 1000,
});
