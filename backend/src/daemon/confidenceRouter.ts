import { db } from "../db/client.js";
import { approvalCache, protectionEvents } from "../db/schema.js";
import { getActivePermission } from "../db/queries/permissions.js";
import { executeRevocation } from "./revocationExecutor.js";
import { sseManager } from "../server/sse/sseManager.js";
import { eq, and, gt, isNull } from "drizzle-orm";
import { logger } from "../utils/logger.js";
import { sendTelegramAlert } from "../utils/telegram.js";
import dotenv from "dotenv";

dotenv.config();

const TIER1_THRESHOLD = parseFloat(process.env.TIER1_THRESHOLD || "0.85");
const TIER2_THRESHOLD = parseFloat(process.env.TIER2_THRESHOLD || "0.70");
const VETO_SECONDS = parseInt(process.env.TIER2_VETO_SECONDS || "60", 10);

// In-memory registry to track active veto countdown timers
const activeStagedTimers = new Map<string, NodeJS.Timeout>();

export interface ConfidenceRoutingInput {
  contractAddress: string;
  bytecode: string;
  staticRisk: "high" | "medium" | "low";
  staticFlags: string[];
  veniceVulnerable: boolean;
  veniceConfidence: number;
}

/**
 * Handles security routing logic. Identifies affected users from the approval cache,
 * computes combined confidence, and fires immediate or staged revocations.
 */
export async function routeThreatConfidence(input: ConfidenceRoutingInput) {
  const spender = input.contractAddress.toLowerCase();
  
  // 1. Query approval cache to find users who have approved this spender
  const affectedApprovals = await db
    .select()
    .from(approvalCache)
    .where(
      and(
        eq(approvalCache.spenderAddress, spender),
        gt(approvalCache.allowance, "0")
      )
    );

  if (affectedApprovals.length === 0) {
    logger.debug(`ℹ️ Router: Scanned contract ${spender} has no active user approvals. Skipping routing.`);
    return;
  }

  logger.warn(`🚨 Router: Found ${affectedApprovals.length} users vulnerable to contract ${spender}! Routing threat...`);

  // 2. Compute hybrid confidence score
  let combinedConfidence = input.veniceConfidence;
  
  // Apply static analysis confidence boosts
  if (input.staticRisk === "high") {
    combinedConfidence += 0.10;
  } else if (input.staticRisk === "medium") {
    combinedConfidence += 0.05;
  }
  
  // Cap at 1.00 maximum
  combinedConfidence = Math.min(1.00, combinedConfidence);
  logger.info(`🤖 Router: Threat evaluation for spender ${spender}. Venice: ${input.veniceConfidence}, Combined Confidence: ${combinedConfidence}`);

  // 3. Route actions individually per affected user based on threshold & securityProfile settings
  for (const record of affectedApprovals) {
    const user = record.userAddress.toLowerCase();
    
    // Fetch active permission credentials for the user
    const permission = await getActivePermission(user);
    if (!permission) {
      logger.info(`ℹ️ Router: User ${user} has active approval but no active Miiso permission registry. Skipping.`);
      continue;
    }

    const profile = permission.securityProfile || "balanced";
    
    let actionTier: 1 | 2 | 3 = 3;
    if (profile === "safe") {
      if (combinedConfidence >= 0.40) {
        actionTier = 1;
      }
    } else if (profile === "balanced") {
      if (combinedConfidence >= TIER1_THRESHOLD) {
        actionTier = 1;
      } else if (combinedConfidence >= TIER2_THRESHOLD) {
        actionTier = 2;
      }
    } else if (profile === "manual") {
      actionTier = 3;
    }

    if (actionTier === 1) {
      // ──── TIER 1: IMMEDIATE AUTO-REVOCATION ────
      logger.warn(`🚨 Router: Tier 1 Immediate Revocation triggered for user ${user} (Confidence: ${combinedConfidence})`);
      
      try {
        await executeRevocation({
          userAddress: user,
          tokenAddress: record.tokenAddress,
          spenderAddress: spender,
          exposedValue: record.allowance,
          permissionContext: permission.permissionContext,
          delegationHash: permission.delegationHash,
          severity: "high"
        });

        await sendTelegramAlert(
          `🚨 <b>Miiso Sentinel Blocked Threat! (Immediate)</b>\n\n` +
          `User: <code>${user}</code>\n` +
          `Token: <code>${record.tokenAddress}</code>\n` +
          `Spender: <code>${spender}</code>\n` +
          `Exposed Value: <code>${record.allowance}</code>\n` +
          `Status: <b>Auto-Revocation Dispatched (1Shot)</b>\n` +
          `Profile: <b>${profile.toUpperCase()}</b>\n` +
          `Combined Confidence: <b>${(combinedConfidence * 100).toFixed(1)}%</b>`
        );
      } catch (err) {
        logger.error(`❌ Router: Failed to execute Tier 1 revocation for user ${user}:`, err);
      }

    } else if (actionTier === 2) {
      // ──── TIER 2: STAGED 60-SECOND VETO COUNTDOWN ────
      logger.warn(`⏰ Router: Tier 2 Staged Veto Triggered for user ${user} (Confidence: ${combinedConfidence}). Starting countdown...`);
      
      try {
        const now = new Date();
        const stagedUntil = new Date(now.getTime() + VETO_SECONDS * 1000);

        // Insert staged pending event in DB
        const stagedEvent = await db
          .insert(protectionEvents)
          .values({
            userAddress: user,
            tokenAddress: record.tokenAddress.toLowerCase(),
            spenderAddress: spender,
            exposedValue: record.allowance,
            actionType: "veto", // 'veto' action indicates staged delay
            relayStatus: "pending",
            severity: "medium",
            stagedUntil,
            createdAt: now
          })
          .returning()
          .then(([inserted]) => inserted);

        // Notify client via SSE of staged threat alert and start countdown in UI
        sseManager.sendEventToUser(user, "PROTECTION_STAGED", {
          eventId: stagedEvent.id,
          tokenAddress: record.tokenAddress,
          spenderAddress: spender,
          amount: record.allowance,
          stagedUntil: stagedUntil.toISOString(),
          vetoSeconds: VETO_SECONDS
        });

        // Set up in-memory veto timer
        setupStagedTimer(stagedEvent.id, user, record.tokenAddress, spender, record.allowance, VETO_SECONDS * 1000);

        await sendTelegramAlert(
          `⏰ <b>Miiso Sentinel Threat Staged! (Tier 2 Veto)</b>\n\n` +
          `User: <code>${user}</code>\n` +
          `Token: <code>${record.tokenAddress}</code>\n` +
          `Spender: <code>${spender}</code>\n` +
          `Veto Period: <b>${VETO_SECONDS}s</b>\n` +
          `Status: <b>Pending (60s countdown)</b>\n` +
          `Profile: <b>${profile.toUpperCase()}</b>\n` +
          `Combined Confidence: <b>${(combinedConfidence * 100).toFixed(1)}%</b>`
        );
      } catch (err) {
        logger.error(`❌ Router: Failed to staging Tier 2 veto countdown for user ${user}:`, err);
      }

    } else {
      // ──── TIER 3: INFORMATIONAL LOG ────
      logger.info(`ℹ️ Router: Tier 3 Informational Alert triggered for user ${user} (Confidence: ${combinedConfidence})`);
      
      // Dispatch SSE alert to dashboard
      sseManager.sendEventToUser(user, "THREAT_ALERT", {
        tokenAddress: record.tokenAddress,
        spenderAddress: spender,
        amount: record.allowance,
        confidence: combinedConfidence,
        severity: "low"
      });

      await sendTelegramAlert(
        `⚠️ <b>Miiso Sentinel Security Alert! (No Action)</b>\n\n` +
        `User: <code>${user}</code>\n` +
        `Token: <code>${record.tokenAddress}</code>\n` +
        `Spender: <code>${spender}</code>\n` +
        `Status: <b>Manual Action Required (Monitoring Mode)</b>\n` +
        `Profile: <b>${profile.toUpperCase()}</b>\n` +
        `Combined Confidence: <b>${(combinedConfidence * 100).toFixed(1)}%</b>`
      );
    }
  }
}

/**
 * Registers an in-memory veto timeout timer.
 */
function setupStagedTimer(eventId: string, user: string, token: string, spender: string, allowance: string, delayMs: number) {
  // Clear any existing timer for this event ID
  if (activeStagedTimers.has(eventId)) {
    clearTimeout(activeStagedTimers.get(eventId));
  }

  const timer = setTimeout(async () => {
    activeStagedTimers.delete(eventId);
    logger.info(`⏰ Router: Veto window closed for event ${eventId}. Checking status for execution...`);

    try {
      // Fetch fresh status from DB to check if user canceled the veto
      const [event] = await db
        .select()
        .from(protectionEvents)
        .where(eq(protectionEvents.id, eventId))
        .limit(1);

      if (event && !event.vetoCancelled && event.relayStatus === "pending") {
        logger.warn(`🚨 Router: Veto countdown expired for event ${eventId}. Executing revocation transaction...`);
        
        // Fetch active user delegation permissions
        const permission = await getActivePermission(user);
        if (!permission) {
          logger.error(`❌ Router: Cannot execute staged revocation. User ${user} revoked Miiso delegation permissions during window.`);
          return;
        }

        // Trigger EIP-7710 transaction
        await executeRevocation({
          userAddress: user,
          tokenAddress: token,
          spenderAddress: spender,
          exposedValue: allowance,
          permissionContext: permission.permissionContext,
          delegationHash: permission.delegationHash,
          severity: "medium"
        });
      } else {
        logger.info(`ℹ️ Router: Staged revocation for event ${eventId} was bypassed (vetoCancelled: ${event?.vetoCancelled}, status: ${event?.relayStatus})`);
      }
    } catch (err) {
      logger.error(`❌ Router: Error executing timer-triggered staged revocation for event ${eventId}:`, err);
    }
  }, delayMs);

  activeStagedTimers.set(eventId, timer);
}

/**
 * Recovery Routine: Reschedules staged events on startup (e.g. following process crash recovery).
 */
export async function rescheduleStagedEvents() {
  logger.info("⚡ Router Recovery: Checking for interrupted staged veto events in database...");
  const now = new Date();
  
  try {
    const stagedEvents = await db
      .select()
      .from(protectionEvents)
      .where(
        and(
          eq(protectionEvents.actionType, "veto"),
          eq(protectionEvents.relayStatus, "pending"),
          eq(protectionEvents.vetoCancelled, false),
          gt(protectionEvents.stagedUntil, now)
        )
      );

    if (stagedEvents.length === 0) {
      logger.info("✅ Router Recovery: No interrupted staged veto events found.");
      return;
    }

    logger.warn(`⚡ Router Recovery: Found ${stagedEvents.length} interrupted veto events. Rescheduling countdowns...`);
    
    for (const event of stagedEvents) {
      const remainingMs = new Date(event.stagedUntil!).getTime() - now.getTime();
      
      logger.info(`⏰ Router Recovery: Rescheduling event ${event.id} for user ${event.userAddress} (remaining: ${Math.round(remainingMs / 1000)}s)`);
      
      setupStagedTimer(
        event.id,
        event.userAddress,
        event.tokenAddress,
        event.spenderAddress,
        event.exposedValue,
        remainingMs
      );
    }
  } catch (error) {
    logger.error("❌ Router Recovery: Failed to query database for crash recovery reschedule check:", error);
  }
}

/**
 * Cleanup method to clear active timers.
 */
export function clearAllStagedTimers() {
  for (const timer of activeStagedTimers.values()) {
    clearTimeout(timer);
  }
  activeStagedTimers.clear();
}
