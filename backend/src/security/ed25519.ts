import { verify } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * Verifies the signature of a webhook request from 1Shot Relayer.
 * Uses native node:crypto verify for Ed25519.
 * 
 * @param rawBody - The raw, unmodified string body of the incoming HTTP request.
 * @param signatureHeaderHex - The signature header value in hex format.
 * @returns boolean indicating if the signature is valid.
 */
export function verifyOneShotWebhook(rawBody: string, signatureHeaderHex: string): boolean {
  const publicKeyHex = process.env.ONESHOT_WEBHOOK_PUBLIC_KEY;

  if (!publicKeyHex) {
    console.error("❌ Webhook validation failed: ONESHOT_WEBHOOK_PUBLIC_KEY is not defined in environment");
    return false;
  }

  try {
    const rawBodyBuffer = Buffer.from(rawBody, "utf8");
    const signatureBuffer = Buffer.from(signatureHeaderHex, "hex");
    const publicKeyBuffer = Buffer.from(publicKeyHex, "hex");

    // Standard 4-argument verify call is fully type-safe and supports Ed25519
    return verify(
      undefined,
      rawBodyBuffer,
      publicKeyBuffer,
      signatureBuffer
    );
  } catch (error) {
    console.error("❌ Webhook validation error during cryptographic check:", error);
    return false;
  }
}
