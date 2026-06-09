import { publicClient } from "../blockchain/viemClient.js";
import { retryWithBackoff } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import { getAddress } from "viem";

/**
 * Fetches contract bytecode from RPC node.
 * Implements exponential backoff retry to handle RPC synchronization/sequencer race conditions.
 */
export async function fetchBytecodeWithRetry(address: string): Promise<string> {
  const normalized = getAddress(address);
  
  try {
    const bytecode = await retryWithBackoff(
      async () => {
        const code = await publicClient.getBytecode({
          address: normalized
        });
        
        if (!code || code === "0x") {
          throw new Error("Bytecode is empty (0x) - not propagated yet");
        }
        
        return code;
      },
      {
        baseDelayMs: 250,
        maxAttempts: 4,
        shouldRetry: () => true, // Retry on any error or empty check
        onRetry: (attempt, delayMs) => {
          logger.debug(`⏳ Bytecode: Empty code for ${normalized}. Attempt ${attempt} failed. Retrying in ${delayMs}ms...`);
        }
      }
    );
    
    return bytecode;
  } catch (error: any) {
    logger.warn(`⚠️ Bytecode: Failed to fetch bytecode for contract ${normalized} after 4 attempts.`, {
      message: error.message
    });
    return "0x";
  }
}
