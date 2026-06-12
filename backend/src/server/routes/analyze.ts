import { FastifyInstance } from "fastify";
import { getAddress } from "viem";
import { fetchBytecodeWithRetry } from "../../daemon/bytecodeRetry.js";
import { decompileContract } from "../../daemon/heimdall.js";
import { runOrchestrator } from "../../agents/orchestrator.js";
import { resolveProxyImplementation } from "../../daemon/proxyResolver.js";

export async function analyzeRoutes(fastify: FastifyInstance) {
  fastify.post("/analyze", async (request, reply) => {
    const { contractAddress } = request.body as { contractAddress: string };

    if (!contractAddress) {
      return reply.code(400).send({ success: false, error: "Contract address is required" });
    }

    let normalizedAddress: `0x${string}`;
    try {
      normalizedAddress = getAddress(contractAddress);
    } catch (err) {
      return reply.code(400).send({ success: false, error: "Invalid Ethereum address format" });
    }

    try {
      const targetAddress = await resolveProxyImplementation(normalizedAddress);
      
      const bytecode = await fetchBytecodeWithRetry(targetAddress);
      if (bytecode === "0x") {
        return reply.code(400).send({ success: false, error: "No bytecode found at address" });
      }

      const decompiledCode = await decompileContract(normalizedAddress, bytecode);
      
      const decision = await runOrchestrator(normalizedAddress, decompiledCode);

      const analysisAgent = decision.agentResults.find((r) => r.agentId === "analysis");
      const analysisOutput = analysisAgent?.output as { confidence: number; vulnerabilities: string[]; staticRisk: string; staticFlags: string[]; veniceRaw: unknown } | null;

      return reply.send({
        success: true,
        data: {
          contractAddress: normalizedAddress,
          combinedConfidence: decision.combinedConfidence, // This is 0.0 to 1.0
          staticRisks: analysisOutput?.staticFlags ?? [],
          veniceConfidenceVerdict: decision.combinedConfidence < 0.5 ? `${((1 - decision.combinedConfidence) * 100).toFixed(1)}% Safe` : `${(decision.combinedConfidence * 100).toFixed(1)}% Vulnerable`,
          score: Math.round((1 - decision.combinedConfidence) * 100), // 100 is perfectly safe, 0 is perfectly vulnerable
          totalCostUsdc: decision.totalCostUsdc
        }
      });
    } catch (error: any) {
      request.log.error("Analysis error:", error);
      return reply.code(500).send({ success: false, error: error.message || "Failed to analyze contract" });
    }
  });
}
