import crypto from "node:crypto";
import { logger } from "../utils/logger.js";

/**
 * Verifies an Ed25519 signature using ONLY node:crypto.
 *
 * CRITICAL: Do NOT replace with node-forge, tweetnacl, or any npm package.
 * CVE-2026-33895 makes node-forge unsafe for Ed25519 (non-canonical
 * signature bypass). node:crypto is the only safe option.
 */
export function verifyEd25519Signature(
  payload: Buffer,
  signature: Buffer,
  publicKey: Buffer
): boolean {
  try {
    // node:crypto Ed25519 verify — algorithm is inferred from key type
    // when using the 4-argument form with raw key buffers
    const isValid = crypto.verify(
      undefined, // Ed25519 does not use a separate digest algorithm
      payload,
      {
        key: publicKey,
        format: "der",
        type: "spki",
      },
      signature
    );

    logger.info(
      `[Ed25519] Verification result: ${isValid} (payload ${payload.length} bytes)`
    );

    return isValid;
  } catch (error: unknown) {
    // If the raw key buffer isn't DER/SPKI formatted, try the raw 32-byte approach
    try {
      const keyObject = crypto.createPublicKey({
        key: Buffer.concat([
          // Ed25519 SPKI prefix (12 bytes) + raw 32-byte public key
          Buffer.from("302a300506032b6570032100", "hex"),
          publicKey,
        ]),
        format: "der",
        type: "spki",
      });

      const isValid = crypto.verify(undefined, payload, keyObject, signature);

      logger.info(
        `[Ed25519] Verification result (raw key): ${isValid} (payload ${payload.length} bytes)`
      );

      return isValid;
    } catch (innerErr) {
      const message =
        innerErr instanceof Error ? innerErr.message : String(innerErr);
      logger.error(`[Ed25519] Verification failed: ${message}`);
      return false;
    }
  }
}

/**
 * Parses the 1Shot Ed25519 public key from env var ONESHOT_WEBHOOK_PUBLIC_KEY.
 * Accepts either hex (0x-prefixed or raw hex) or base64 format.
 */
export function parseWebhookPublicKey(hexOrBase64: string): Buffer {
  if (hexOrBase64.startsWith("0x")) {
    return Buffer.from(hexOrBase64.slice(2), "hex");
  }

  // Check if it looks like hex (all hex chars)
  if (/^[0-9a-fA-F]+$/.test(hexOrBase64)) {
    return Buffer.from(hexOrBase64, "hex");
  }

  // Otherwise treat as base64
  return Buffer.from(hexOrBase64, "base64");
}

/**
 * Backward-compatible wrapper used by the existing webhook.ts import.
 * Verifies the signature of a webhook request from 1Shot Relayer.
 */
export function verifyOneShotWebhook(
  rawBody: string,
  signatureHeaderHex: string
): boolean {
  const publicKeyEnv = process.env.ONESHOT_WEBHOOK_PUBLIC_KEY;

  if (!publicKeyEnv) {
    logger.error(
      "[Ed25519] ONESHOT_WEBHOOK_PUBLIC_KEY is not defined in environment"
    );
    return false;
  }

  try {
    const rawBodyBuffer = Buffer.from(rawBody, "utf8");
    const signatureBuffer = Buffer.from(
      signatureHeaderHex.replace("0x", ""),
      "hex"
    );
    const publicKeyBuffer = parseWebhookPublicKey(publicKeyEnv);

    return verifyEd25519Signature(
      rawBodyBuffer,
      signatureBuffer,
      publicKeyBuffer
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Ed25519] Webhook validation error: ${message}`);
    return false;
  }
}
