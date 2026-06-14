import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN } from "../config/chain.js";
import dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.AGENT_PRIVATE_KEY;

if (!privateKey) {
  throw new Error("AGENT_PRIVATE_KEY is not defined in environment variables");
}

export const agentAccount = privateKeyToAccount(privateKey as `0x${string}`);

const isDemo = process.env.DEMO_MODE === "true";
const rpcUrl = isDemo 
  ? "http://127.0.0.1:8545" 
  : (process.env.HTTP_RPC_URL?.trim() || "https://sepolia.base.org");

export const walletClient = createWalletClient({
  account: agentAccount,
  chain: isDemo ? CHAIN : CHAIN,
  transport: http(rpcUrl)
});

console.log(`🔑 Wallet client initialized for Agent Address: ${agentAccount.address}`);
