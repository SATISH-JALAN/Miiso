import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getAddress } from "viem";

/**
 * Utility for generating temporary session keys.
 * Used when a user requests a new session key pair to sign delegations.
 */
export interface SessionKeyPair {
  privateKey: string;
  address: string;
}

/**
 * Generates a cryptographically secure random session private key and returns the keypair.
 */
export function generateSessionKeyPair(): SessionKeyPair {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    privateKey,
    address: getAddress(account.address)
  };
}

/**
 * Validates if an address matches the session key generated from a private key.
 */
export function validateSessionKey(privateKey: string, expectedAddress: string): boolean {
  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    return getAddress(account.address) === getAddress(expectedAddress);
  } catch (err) {
    return false;
  }
}
