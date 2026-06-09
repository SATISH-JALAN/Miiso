import { publicClient } from "./viemClient.js";
import { erc20Abi, APPROVAL_EVENT_TOPIC } from "./contracts.js";
import { upsertApproval, getCachedApprovals } from "../db/queries/approvalCache.js";
import { getScanByAddress } from "../db/queries/scanLog.js";
import { formatUnits, getAddress } from "viem";
import { db } from "../db/client.js";
import { approvalCache } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const CHUNK_SIZE = 2000n;
const MAX_HISTORY_BLOCKS = 3880000n; // Approx 90 days on Base (2s block time)
const DUMMY_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface ApprovalInfo {
  token: string;
  spender: string;
  amount: string; // formatted decimal string or raw wei string
  rawAllowance: string;
  date: string;
  riskLevel: "high" | "medium" | "low" | "none";
}

/**
 * Scans on-chain log history for a user's token approvals, caching results in DB.
 */
export async function scanUserApprovals(userAddress: string): Promise<ApprovalInfo[]> {
  const normalizedUser = getAddress(userAddress);
  
  // 1. Get current block height
  const currentBlock = await publicClient.getBlockNumber();
  
  // 2. Determine scan starting block (check cache)
  let lastScannedBlock = 0n;
  const userCache = await getCachedApprovals(normalizedUser);
  
  if (userCache.length > 0) {
    // Find the highest block scanned so far
    lastScannedBlock = userCache.reduce((max, item) => 
      BigInt(item.lastScannedBlock) > max ? BigInt(item.lastScannedBlock) : max, 0n);
  } else {
    // Check if there is a dummy tracker record in DB
    const [dummy] = await db
      .select()
      .from(approvalCache)
      .where(
        and(
          eq(approvalCache.userAddress, normalizedUser.toLowerCase()),
          eq(approvalCache.spenderAddress, DUMMY_ADDRESS),
          eq(approvalCache.tokenAddress, DUMMY_ADDRESS)
        )
      )
      .limit(1);
    if (dummy) {
      lastScannedBlock = BigInt(dummy.lastScannedBlock);
    }
  }

  // Calculate starting block, enforcing the 90-day time cap
  const maxLookbackBlock = currentBlock - MAX_HISTORY_BLOCKS;
  let startBlock = lastScannedBlock > 0n ? lastScannedBlock + 1n : maxLookbackBlock;
  if (startBlock < maxLookbackBlock) {
    startBlock = maxLookbackBlock;
  }

  console.log(`🔍 Scanner: User ${normalizedUser} scanning from ${startBlock} to ${currentBlock} (Delta: ${currentBlock - startBlock} blocks)`);

  // 3. Paginated block scanning
  let tempStart = startBlock;
  while (tempStart <= currentBlock) {
    const tempEnd = tempStart + CHUNK_SIZE - 1n > currentBlock ? currentBlock : tempStart + CHUNK_SIZE - 1n;
    
    try {
      const logs = await publicClient.getLogs({
        event: {
          type: "event",
          name: "Approval",
          inputs: [
            { indexed: true, name: "owner", type: "address" },
            { indexed: true, name: "spender", type: "address" },
            { name: "value", type: "uint256" }
          ]
        },
        args: {
          owner: normalizedUser
        },
        fromBlock: tempStart,
        toBlock: tempEnd
      });

      for (const log of logs) {
        if (!log.args.spender || !log.address) continue;
        const spender = getAddress(log.args.spender);
        const token = getAddress(log.address);
        const allowance = log.args.value?.toString() || "0";

        // Write directly to DB cache
        await upsertApproval({
          userAddress: normalizedUser,
          tokenAddress: token,
          spenderAddress: spender,
          allowance,
          lastScannedBlock: tempEnd
        });
      }
    } catch (error) {
      console.error(`⚠️ Scanner: Error scanning logs in range ${tempStart}-${tempEnd}:`, error);
    }

    tempStart = tempEnd + 1n;
  }

  // 4. Update dummy tracker entry to current block if no approvals exist
  await upsertApproval({
    userAddress: normalizedUser,
    tokenAddress: DUMMY_ADDRESS,
    spenderAddress: DUMMY_ADDRESS,
    allowance: "0",
    lastScannedBlock: currentBlock
  });

  // 5. Fetch all cached approvals from database
  const cachedRecords = await getCachedApprovals(normalizedUser);
  const activeApprovals: ApprovalInfo[] = [];

  // 6. Verify allowances on-chain & assign risk levels
  for (const record of cachedRecords) {
    // Ignore the dummy tracker
    if (record.spenderAddress === DUMMY_ADDRESS && record.tokenAddress === DUMMY_ADDRESS) {
      continue;
    }

    const tokenAddress = getAddress(record.tokenAddress);
    const spenderAddress = getAddress(record.spenderAddress);

    try {
      // Direct RPC query to check current actual allowance
      const currentAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [normalizedUser, spenderAddress]
      });

      if (currentAllowance === 0n) {
        // If revoked or fully spent, update cache and skip
        await upsertApproval({
          userAddress: normalizedUser,
          tokenAddress: tokenAddress,
          spenderAddress: spenderAddress,
          allowance: "0",
          lastScannedBlock: currentBlock
        });
        continue;
      }

      // Fetch decimals & metadata to present formatted values
      let decimals = 18;
      let symbol = "TOKEN";
      try {
        decimals = await publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "decimals"
        });
        symbol = await publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "symbol"
        });
      } catch (err) {
        // Fallback for non-standard ERC-20s
      }

      // Fetch risk level from contract scan logs
      let riskLevel: "high" | "medium" | "low" | "none" = "low";
      const scan = await getScanByAddress(spenderAddress);
      
      if (scan) {
        if (scan.vulnerable) {
          riskLevel = scan.staticRisk === "high" ? "high" : "medium";
        } else {
          riskLevel = "none"; // Scanned and clean
        }
      }

      activeApprovals.push({
        token: `${symbol} (${tokenAddress})`,
        spender: spenderAddress,
        amount: parseFloat(formatUnits(currentAllowance, decimals)).toFixed(4),
        rawAllowance: currentAllowance.toString(),
        date: record.updatedAt.toISOString(),
        riskLevel
      });
    } catch (err) {
      console.error(`⚠️ Scanner: Failed on-chain allowance check for user ${normalizedUser}, spender ${spenderAddress}, token ${tokenAddress}:`, err);
      // Keep cached record as is if RPC fails temporarily
    }
  }

  return activeApprovals;
}
