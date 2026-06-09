import { SiweMessage } from "siwe";
import { agentAccount } from "../blockchain/walletClient.js";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const VENICE_API_URL = process.env.VENICE_API_URL || "https://api.venice.ai/api/v1";

let cachedToken: string | null = null;
let tokenExpiryTime = 0;

/**
 * Gets a valid authorization header for Venice AI requests.
 * Uses cached SIWE/x402 bearer token if active, otherwise falls back to VENICE_API_KEY.
 */
export async function getVeniceAuthHeader(): Promise<string> {
  const apiKey = process.env.VENICE_API_KEY;
  
  // If API key is provided and we are not explicitly forced to use SIWE,
  // return the API key directly (standard developer authentication)
  if (apiKey && !process.env.FORCE_SIWE) {
    return `Bearer ${apiKey}`;
  }

  // Otherwise, use Venice's x402 SIWE flow
  const now = Date.now();
  if (cachedToken && now < tokenExpiryTime) {
    return `Bearer ${cachedToken}`;
  }

  logger.info("⚡ SIWE: Authenticating with Venice AI...");
  try {
    const token = await authenticateWithSIWE();
    cachedToken = token;
    // Cache token for 55 minutes (standard SIWE tokens last 1 hour)
    tokenExpiryTime = now + 55 * 60 * 1000;
    return `Bearer ${token}`;
  } catch (error) {
    logger.error("❌ SIWE: Authentication failed, attempting fallback to API key:", error);
    if (apiKey) {
      return `Bearer ${apiKey}`;
    }
    throw new Error("VeniceAuthenticationFailed: SIWE auth failed and no API key was provided.");
  }
}

/**
 * Executes the three-step Sign-In with Ethereum flow on Venice AI.
 */
async function authenticateWithSIWE(): Promise<string> {
  const agentAddress = agentAccount.address;

  // Step 1: Fetch random, single-use nonce from Venice
  const nonceResponse = await fetch(`${VENICE_API_URL}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: agentAddress })
  });

  if (!nonceResponse.ok) {
    throw new Error(`Failed to fetch nonce: ${nonceResponse.statusText}`);
  }

  const { nonce } = await nonceResponse.json();
  
  // Step 2: Build standard SIWE message
  const domain = new URL(VENICE_API_URL).hostname;
  const siweMessage = new SiweMessage({
    domain,
    address: agentAddress,
    statement: "Sign in to Venice AI for autonomous threat analysis",
    uri: VENICE_API_URL,
    version: "1",
    chainId: 8453, // Base Mainnet
    nonce
  });

  const messageToSign = siweMessage.prepareMessage();

  // Step 3: Sign message with the Agent EOA wallet client key
  const signature = await agentAccount.signMessage({
    message: messageToSign
  });

  // Step 4: Verify signature on Venice to retrieve JWT token
  const verifyResponse = await fetch(`${VENICE_API_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: messageToSign,
      signature
    })
  });

  if (!verifyResponse.ok) {
    throw new Error(`SIWE verify request failed: ${verifyResponse.statusText}`);
  }

  const { token } = await verifyResponse.json();
  logger.info("✅ SIWE: Successfully acquired new JWT session token.");
  return token;
}
