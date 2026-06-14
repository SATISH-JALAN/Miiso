import { analyzeBytecodeWithVenice } from "../daemon/veniceAnalyzer.js";
import { analyzeContractStatic } from "../daemon/staticAnalyzer.js";
import { logger } from "../utils/logger.js";
import type { AgentResult, AnalysisOutput } from "./types.js";

/**
 * Analysis Agent: Wraps the existing Venice AI inference and static bytecode
 * analysis, running both in parallel and combining their outputs.
 */
export async function runAnalysisAgent(
  contractAddress: string,
  decompiled: string
): Promise<AgentResult<AnalysisOutput>> {
  const start = Date.now();

  try {
    // Run Venice AI and static analysis in parallel — static is sync but we wrap it
    const [veniceSettled, staticSettled] = await Promise.allSettled([
      analyzeBytecodeWithVenice(contractAddress, decompiled),
      Promise.resolve(analyzeContractStatic(decompiled)),
    ]);

    // Static analysis should always succeed (sync, pure computation)
    const staticOutput =
      staticSettled.status === "fulfilled"
        ? staticSettled.value
        : { staticRisk: "low" as const, staticFlags: [] as string[] };

    // Venice may fail (network, timeout, auth issues)
    const veniceOutput =
      veniceSettled.status === "fulfilled" ? veniceSettled.value : null;

    if (!veniceOutput) {
      logger.warn(
        `[AnalysisAgent] Venice failed for ${contractAddress.slice(0, 8)}, using static only`
      );
      return {
        agentId: "analysis",
        status: "error",
        output: {
          confidence: 0,
          vulnerabilities: [],
          staticRisk: staticOutput.staticRisk,
          staticFlags: staticOutput.staticFlags,
          veniceRaw: null,
        },
        costUsdc: 0,
        durationMs: Date.now() - start,
        error: "Venice AI inference failed",
      };
    }

    // Calculate inference cost from Venice token usage
    const costUsdc = veniceOutput.costUsdc;

    // Map Venice vulnerability objects to flat string array for agent output
    const vulnerabilityNames = Array.isArray(veniceOutput.vulnerabilities)
      ? veniceOutput.vulnerabilities.map((v: unknown) => {
          if (typeof v === "string") return v;
          if (typeof v === "object" && v !== null && "type" in v) {
            return String((v as { type: string }).type);
          }
          return String(v);
        })
      : [];

    logger.info(
      `[AnalysisAgent] ${contractAddress.slice(0, 8)} confidence=${veniceOutput.confidence.toFixed(2)} staticRisk=${staticOutput.staticRisk} vulnerabilities=${vulnerabilityNames.length} cost=$${costUsdc.toFixed(6)}`
    );

    return {
      agentId: "analysis",
      status: "success",
      output: {
        confidence: veniceOutput.confidence,
        vulnerabilities: vulnerabilityNames,
        staticRisk: staticOutput.staticRisk,
        staticFlags: staticOutput.staticFlags,
        veniceRaw: veniceOutput,
      },
      costUsdc,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      `[AnalysisAgent] Unexpected error for ${contractAddress.slice(0, 8)}: ${message}`
    );
    return {
      agentId: "analysis",
      status: "error",
      output: null,
      costUsdc: 0,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}
