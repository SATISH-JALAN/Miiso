import { publicClient } from "../blockchain/viemClient.js";
import { getAddress, hexToNumber } from "viem";
import { logger } from "../utils/logger.js";

// EIP-1967 Implementation Slot
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;

// EIP-1967 Beacon Slot
const BEACON_SLOT = "0xa3f0ad74a5890d8e115a428751361ff2b9de8507e4293c17e68545907268d65a" as const;

/**
 * Resolves the underlying implementation address if the given address is an EIP-1967 proxy.
 * If not a proxy, returns the input address.
 */
export async function resolveProxyImplementation(address: string): Promise<string> {
  const normalized = getAddress(address);
  
  try {
    // 1. Check EIP-1967 implementation slot
    const storage = await publicClient.getStorageAt({
      address: normalized,
      slot: IMPLEMENTATION_SLOT
    });

    if (storage && storage !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      // Extract address from 32-byte word (last 20 bytes)
      const implAddress = getAddress(`0x${storage.substring(26)}`);
      logger.info(`🔄 Proxy: Resolved EIP-1967 implementation for ${normalized} -> ${implAddress}`);
      return implAddress;
    }

    // 2. Check EIP-1967 beacon slot if implementation slot is empty
    const beaconStorage = await publicClient.getStorageAt({
      address: normalized,
      slot: BEACON_SLOT
    });

    if (beaconStorage && beaconStorage !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      // Extract beacon address
      const beaconAddress = getAddress(`0x${beaconStorage.substring(26)}`);
      logger.info(`🔄 Proxy: Resolved beacon proxy for ${normalized} (Beacon: ${beaconAddress})`);
      
      // Fetch implementation from beacon using readContract if possible,
      // but in most cases returning beaconAddress or fallback is safe for bytecode analysis.
      // Let's attempt to read beacon.implementation() on-chain:
      try {
        const implAddress = await publicClient.readContract({
          address: beaconAddress,
          abi: [{
            name: "implementation",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "address" }]
          }],
          functionName: "implementation"
        }) as string;
        
        return getAddress(implAddress);
      } catch (err) {
        logger.warn(`⚠️ Proxy: Could not read implementation() from beacon address ${beaconAddress}`);
      }
    }
  } catch (error) {
    logger.error(`⚠️ Proxy: Error checking proxy slots for ${normalized}:`, error);
  }

  // Fallback to original address (assumed direct deployment)
  return normalized;
}
