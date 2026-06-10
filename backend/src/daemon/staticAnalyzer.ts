/**
 * Static Bytecode Analyzer — lightweight pattern matcher on decompiled pseudo-Solidity.
 * Runs in parallel with Venice AI. Zero external calls, zero cost, pure computation.
 * Should complete in <5ms.
 */

export interface StaticAnalysisResult {
  staticRisk: "high" | "medium" | "low";
  staticFlags: string[];
}

// ── Detection flag constants ─────────────────────────────────────────────────

// HIGH risk flags (any one = staticRisk 'high')
const HIGH_FLAGS = [
  "CALL_BEFORE_SSTORE",
  "HARDCODED_TRANSFER",
  "UNRESTRICTED_SELFDESTRUCT",
  "DYNAMIC_DELEGATECALL",
] as const;

// MEDIUM risk flags
const MEDIUM_FLAGS = [
  "MISSING_REENTRANCY_GUARD",
  "UNCHECKED_RETURN",
  "SUSPICIOUS_MODIFIER",
] as const;

// LOW risk (informational)
const LOW_FLAGS = [
  "HAS_EXTERNAL_CALLS",
  "HAS_ASSEMBLY",
] as const;

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Performs lightweight static analysis on decompiled pseudo-Solidity to identify
 * security vulnerability patterns. Combines with Venice AI inference to form a
 * hybrid confidence routing strategy.
 */
export function runStaticAnalysis(
  decompiledCode: string
): { staticRisk: "high" | "medium" | "low"; flags: string[] } {
  const flags: string[] = [];
  const code = decompiledCode;
  const codeLower = code.toLowerCase();

  // ── HIGH risk checks ───────────────────────────────────────────────────

  // 1. CALL_BEFORE_SSTORE: external call/send/transfer BEFORE storage write
  //    in the same function block (reentrancy pattern)
  if (detectCallBeforeSstore(code)) {
    flags.push("CALL_BEFORE_SSTORE");
  }

  // 2. HARDCODED_TRANSFER: transferFrom or transfer to a hardcoded hex address
  //    that is NOT the zero address and NOT msg.sender
  const hardcodedTransferPattern =
    /transfer(?:From)?\s*\(\s*(0x[0-9a-fA-F]{40})/g;
  let transferMatch: RegExpExecArray | null;
  while ((transferMatch = hardcodedTransferPattern.exec(code)) !== null) {
    const addr = transferMatch[1];
    if (
      addr !== "0x0000000000000000000000000000000000000000" &&
      !codeLower.includes("msg.sender")
    ) {
      flags.push("HARDCODED_TRANSFER");
      break;
    }
  }

  // 3. UNRESTRICTED_SELFDESTRUCT: selfdestruct without nearby owner check
  if (/selfdestruct\s*\(/i.test(code)) {
    const lines = code.split("\n");
    let foundRestricted = false;
    for (let i = 0; i < lines.length; i++) {
      if (/selfdestruct\s*\(/i.test(lines[i])) {
        // Check 5 lines above for owner guard
        const contextStart = Math.max(0, i - 5);
        const context = lines.slice(contextStart, i + 1).join("\n");
        if (/require\s*\(.*owner/i.test(context) || /onlyOwner/i.test(context)) {
          foundRestricted = true;
        }
      }
    }
    if (!foundRestricted) {
      flags.push("UNRESTRICTED_SELFDESTRUCT");
    }
  }

  // 4. DYNAMIC_DELEGATECALL: delegatecall to a variable address (not a constant)
  if (/\.delegatecall\s*\(/i.test(code)) {
    // If delegatecall target is not a hardcoded constant address, it's dynamic
    const delegateLines = code.split("\n").filter((l) =>
      /\.delegatecall\s*\(/i.test(l)
    );
    for (const line of delegateLines) {
      // If the line doesn't contain a hardcoded 0x address as target, flag it
      if (!/0x[0-9a-fA-F]{40}/.test(line)) {
        flags.push("DYNAMIC_DELEGATECALL");
        break;
      }
    }
  }

  // ── MEDIUM risk checks ─────────────────────────────────────────────────

  // 5. MISSING_REENTRANCY_GUARD: has external calls but no guard
  const hasExternalCalls = /(\.call|\.send)\s*\(/i.test(code);
  if (
    hasExternalCalls &&
    !/nonReentrant|ReentrancyGuard/i.test(code)
  ) {
    flags.push("MISSING_REENTRANCY_GUARD");
  }

  // 6. UNCHECKED_RETURN: .call{ without checking return value on same line
  if (/\.call\{/i.test(code)) {
    const callLines = code.split("\n").filter((l) => /\.call\{/i.test(l));
    for (const line of callLines) {
      if (!/\(bool\s+\w+/i.test(line) && !/success/i.test(line)) {
        flags.push("UNCHECKED_RETURN");
        break;
      }
    }
  }

  // 7. SUSPICIOUS_MODIFIER: onlyOwner on withdraw/drain functions but
  //    owner is set in constructor to a non-deployer address
  if (
    /onlyOwner/i.test(code) &&
    /(withdraw|drain)/i.test(code) &&
    /constructor/i.test(code)
  ) {
    // Check if owner is assigned to a hardcoded address in constructor
    const constructorMatch = code.match(
      /constructor[\s\S]*?\{([\s\S]*?)\}/i
    );
    if (constructorMatch?.[1]) {
      const constructorBody = constructorMatch[1];
      if (
        /owner\s*=\s*0x[0-9a-fA-F]{40}/i.test(constructorBody) &&
        !/msg\.sender/i.test(constructorBody)
      ) {
        flags.push("SUSPICIOUS_MODIFIER");
      }
    }
  }

  // ── LOW risk (informational) ───────────────────────────────────────────

  // 8. HAS_EXTERNAL_CALLS: any external calls present
  if (/(\.call|\.send|\.transfer)\s*\(/i.test(code)) {
    flags.push("HAS_EXTERNAL_CALLS");
  }

  // 9. HAS_ASSEMBLY: inline assembly present
  if (/assembly\s*\{/i.test(code)) {
    flags.push("HAS_ASSEMBLY");
  }

  // ── Compute staticRisk from highest severity flag ──────────────────────

  let staticRisk: "high" | "medium" | "low" = "low";

  if (flags.some((f) => (HIGH_FLAGS as readonly string[]).includes(f))) {
    staticRisk = "high";
  } else if (
    flags.some((f) => (MEDIUM_FLAGS as readonly string[]).includes(f))
  ) {
    staticRisk = "medium";
  }

  return { staticRisk, flags };
}

/**
 * Heuristic: detect function blocks where an external CALL appears
 * BEFORE a storage write (SSTORE) — classic reentrancy pattern.
 */
function detectCallBeforeSstore(code: string): boolean {
  // Split into rough function blocks
  const functionBlocks = code.split(/function\s+\w+/i);

  const callPattern = /(\.call|\.send|\.transfer)\s*\(/i;
  const sstorePattern = /(storage\[|mapping\[|= [A-Z_]+;|sstore)/i;

  for (const block of functionBlocks) {
    const lines = block.split("\n");
    let firstCallLine = -1;
    let firstSstoreLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (firstCallLine === -1 && callPattern.test(lines[i])) {
        firstCallLine = i;
      }
      if (firstSstoreLine === -1 && sstorePattern.test(lines[i])) {
        firstSstoreLine = i;
      }
    }

    // CALL found before SSTORE in the same function block
    if (
      firstCallLine !== -1 &&
      firstSstoreLine !== -1 &&
      firstCallLine < firstSstoreLine
    ) {
      return true;
    }
  }

  return false;
}

// ── Backward-compatible alias ────────────────────────────────────────────────
// blockWatcher.ts and analysisAgent.ts import this name and interface:

export function analyzeContractStatic(
  decompiledCode: string
): StaticAnalysisResult {
  const result = runStaticAnalysis(decompiledCode);
  return {
    staticRisk: result.staticRisk,
    staticFlags: result.flags,
  };
}
