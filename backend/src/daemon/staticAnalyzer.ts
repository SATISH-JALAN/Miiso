export interface StaticAnalysisResult {
  staticRisk: "high" | "medium" | "low";
  staticFlags: string[];
}

/**
 * Performs lightweight static analysis on decompiled solidity code to identify obvious vulnerabilities.
 * Combines with Venice AI reasoning to run a hybrid confidence routing strategy.
 */
export function analyzeContractStatic(decompiledCode: string): StaticAnalysisResult {
  const flags: string[] = [];
  const code = decompiledCode.toLowerCase();

  // 1. Check for selfdestruct instruction (allows contract destruction and draining)
  if (code.includes("selfdestruct") || code.includes("suicide") || code.includes("0xff")) {
    flags.push("SELFDESTRUCT_FOUND");
  }

  // 2. Check for delegatecall (allows arbitrary code execution on contract storage)
  if (code.includes("delegatecall") || code.includes("0xf4")) {
    flags.push("DELEGATECALL_FOUND");
  }

  // 3. Check for external CALL prior to SSTORE (classical reentrancy / state update delay vulnerability)
  const firstCall = code.indexOf(".call") !== -1 ? code.indexOf(".call") : code.indexOf("call(");
  const firstSstore = code.indexOf("sstore") !== -1 ? code.indexOf("sstore") : code.indexOf("sstore(");
  
  if (firstCall !== -1 && firstSstore !== -1 && firstCall < firstSstore) {
    flags.push("CALL_BEFORE_SSTORE");
  }

  // 4. Check for arbitrary transferFrom pattern (allows draining other users' approved allowances)
  if (code.includes("transferfrom") || code.includes("23b872dd")) {
    // If it also contains call or arbitrary spender approval patterns
    if (code.includes("approve") || code.includes("095ea7b3")) {
      flags.push("TRANSFERFROM_HIJACK_RISK");
    }
  }

  // Determine static risk level
  let staticRisk: "high" | "medium" | "low" = "low";
  
  if (
    flags.includes("SELFDESTRUCT_FOUND") || 
    flags.includes("DELEGATECALL_FOUND") || 
    flags.includes("TRANSFERFROM_HIJACK_RISK")
  ) {
    staticRisk = "high";
  } else if (flags.includes("CALL_BEFORE_SSTORE")) {
    staticRisk = "medium";
  }

  return {
    staticRisk,
    staticFlags: flags
  };
}
