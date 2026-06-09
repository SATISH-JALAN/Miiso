import { workerPool } from "./workerPool.js";
import { logger } from "../utils/logger.js";

/**
 * High-level wrapper function to decompile EVM bytecode into pseudo-Solidity code.
 * Routes task to background CPU worker thread pool to keep Fastify main thread unblocked.
 * 
 * @param contractAddress - The address of the contract being analyzed.
 * @param bytecode - The raw runtime bytecode hex string.
 * @returns Promise resolving to decompiled Solidity code string.
 */
export async function decompileContract(contractAddress: string, bytecode: string): Promise<string> {
  logger.info(`⚙️ Decompiler: Scheduling decompilation for contract: ${contractAddress}`);
  
  const startTime = Date.now();
  try {
    const decompiled = await workerPool.decompile(contractAddress, bytecode);
    const duration = Date.now() - startTime;
    
    logger.info(`✅ Decompiler: Completed decompilation for ${contractAddress} in ${duration}ms.`);
    return decompiled;
  } catch (error: any) {
    logger.error(`❌ Decompiler: Failed to decompile contract ${contractAddress}:`, error);
    throw error;
  }
}
