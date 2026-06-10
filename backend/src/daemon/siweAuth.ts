import { SiweMessage } from "siwe";
import crypto from "node:crypto";
import { agentAccount } from "../blockchain/walletClient.js";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const VENICE_API_URL = process.env.VENICE_API_URL || "https://api.venice.ai/api/v1";

// ── Cached bearer token (refreshed on 401 or expiry) ──────────────────────
let cachedBearerToken: string | null = null;
let bearerTokenExpiry = 0;

/**
 * Builds a fresh SIWE authentication header for Venice AI requests.
 * Uses EIP-4361 Sign-In With Ethereum — NOT bearer tokens or API keys.
 *
 * Flow:
 *   1. Generate a cryptographically secure single-use nonce
 *   2. Construct a SIWE message with 5-minute expiry
 *   3. Sign with the agent EOA via EIP-191 personal_sign
 *   4. Return the concatenated header: "{preparedMessage}:{signature}"
 *
 * If a cached bearer token from a previous Venice response exists and hasn't
 * expired, it is returned early to avoid re-signing on every call.
 */
export async function buildSiweHeader(
  domain = "api.venice.ai"
): Promise<{ header: string; nonce: string }> {
  // Check if we have a valid cached bearer token
  const now = Date.now();
  if (cachedBearerToken && now < bearerTokenExpiry) {
    logger.debug("[SiweAuth] Using cached bearer token");
    return { header: `Bearer ${cachedBearerToken}`, nonce: "" };
  }

  // Generate a fresh, cryptographically secure single-use nonce
  const nonce = crypto.randomBytes(32).toString("hex");

  const expirationTime = new Date(now + 5 * 60 * 1000); // 5 min expiry

  const siweMessage = new SiweMessage({
    domain,
    address: agentAccount.address,
    statement: "Miiso agent authentication for Venice AI inference",
    uri: `https://${domain}`,
    version: "1",
    chainId: 8453, // Base mainnet
    nonce,
    issuedAt: new Date().toISOString(),
    expirationTime: expirationTime.toISOString(),
  });

  const preparedMessage = siweMessage.prepareMessage();

  // Sign the message with the agent EOA private key (EIP-191 personal_sign)
  const signature = await agentAccount.signMessage({
    message: preparedMessage,
  });

  // Never log the full signature — truncate for debugging
  logger.info(
    `[SiweAuth] SIWE header built for ${agentAccount.address.slice(0, 8)}... nonce=${nonce.slice(0, 8)}... sig=${signature.slice(0, 10)}...`
  );

  const header = `${preparedMessage}:${signature}`;
  return { header, nonce };
}

/**
 * Caches a bearer token returned by Venice in response headers.
 * Call this after any successful Venice API response to store the session token.
 */
export function cacheBearerFromResponse(headers: Headers): void {
  const token =
    headers.get("X-Venice-Token") ||
    headers.get("Authorization")?.replace("Bearer ", "");

  if (token) {
    cachedBearerToken = token;
    // Cache for 50 minutes (typical SIWE session lasts 1 hour)
    bearerTokenExpiry = Date.now() + 50 * 60 * 1000;
    logger.info("[SiweAuth] Cached bearer token from Venice response");
  }
}

/**
 * Clears the cached bearer token. Called on 401 to force re-authentication.
 */
export function clearCachedBearer(): void {
  cachedBearerToken = null;
  bearerTokenExpiry = 0;
  logger.info("[SiweAuth] Cleared cached bearer token");
}

/**
 * Backward-compatible wrapper — used by the existing veniceAnalyzer.ts import.
 * Returns either a cached bearer header or a fresh SIWE header string.
 */
export async function getVeniceAuthHeader(): Promise<string> {
  const apiKey = process.env.VENICE_API_KEY;

  // If API key is provided and we are not explicitly forced to use SIWE,
  // return the API key directly (standard developer authentication)
  if (apiKey && !process.env.FORCE_SIWE) {
    return `Bearer ${apiKey}`;
  }

  const { header } = await buildSiweHeader();

  // If the header starts with "Bearer " it's a cached token — use as-is
  if (header.startsWith("Bearer ")) {
    return header;
  }

  // Otherwise it's a raw SIWE header — the caller must set it on X-Sign-In-With-Ethereum
  // For backward compatibility, wrap in Bearer if caller expects Authorization header
  return header;
}
