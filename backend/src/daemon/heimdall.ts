import { workerPool } from "./workerPool.js";
import { logger } from "../utils/logger.js";

export type DecompileSource = "heimdall" | "fallback_mock";

export interface DecompileResult {
  decompiled: string;
  source: DecompileSource;
}

/**
 * Decompile EVM bytecode into pseudo-Solidity via the Heimdall worker pool.
 */
export async function decompileContract(
  contractAddress: string,
  bytecode: string
): Promise<DecompileResult> {
  logger.info(`⚙️ Decompiler: Scheduling decompilation for contract: ${contractAddress}`);

  const startTime = Date.now();
  try {
    const result = await workerPool.decompile(contractAddress, bytecode);
    const duration = Date.now() - startTime;

    logger.info(
      `✅ Decompiler: Completed decompilation for ${contractAddress} in ${duration}ms (source=${result.source}).`
    );
    return result;
  } catch (error: unknown) {
    logger.error(`❌ Decompiler: Failed to decompile contract ${contractAddress}:`, error);
    throw error;
  }
}

/** Whether Heimdall CLI produced the last decompilation (checked via worker health). */
export function getHeimdallWorkerStats() {
  return workerPool.getStats();
}
