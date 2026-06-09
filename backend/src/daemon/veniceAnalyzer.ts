import { getVeniceAuthHeader } from "./siweAuth.js";
import { trackVeniceCost } from "../utils/cost.js";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const VENICE_API_URL = process.env.VENICE_API_URL || "https://api.venice.ai/api/v1";
const VENICE_MODEL = process.env.VENICE_MODEL || "e2ee-qwen3-6-35b-a3b-uncensored-p";

export interface VeniceAnalysisResult {
  vulnerable: boolean;
  confidence: number;
  vulnerabilities: Array<{
    type: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    description: string;
    opcodePattern: string;
  }>;
  recommendation: string;
}

const SYSTEM_PROMPT = `You are a strict, automated smart contract security auditor. Your job is to analyze decompiled Solidity source code and determine if it represents a malicious contract (e.g. honeypot, approval drainer, backdoor, reentrancy exploit, or malicious proxy).
Analyze the code carefully. You must output ONLY a valid JSON object matching this exact schema:
{
  "vulnerable": boolean,
  "confidence": number (floating point value between 0.00 and 1.00),
  "vulnerabilities": [
    {
      "type": "string (e.g., REENTRANCY, APPROVAL_DRAINER, BACKDOOR, HONEYPOT)",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "description": "string describing the vulnerability",
      "opcodePattern": "string pattern or name of functions causing it"
    }
  ],
  "recommendation": "string recommending the action (e.g. REVOKE_IMMEDIATELY or STAGE_DELAY or whitelist)"
}
Return ONLY the raw JSON string. Do not include markdown codeblocks (such as \`\`\`json), do not include any introductions, notes, or concluding text.`;

/**
 * Submits decompiled solidity code to Venice AI for vulnerability analysis.
 */
export async function analyzeBytecodeWithVenice(
  contractAddress: string,
  decompiledCode: string
): Promise<VeniceAnalysisResult> {
  logger.info(`🤖 Venice: Dispatching analysis request for contract ${contractAddress}...`);

  try {
    const authHeader = await getVeniceAuthHeader();
    
    const startTime = Date.now();
    const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader
      },
      body: JSON.stringify({
        model: VENICE_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyze the following decompiled contract code for address ${contractAddress}:\n\n${decompiledCode}` }
        ],
        temperature: 0.1, // Low temperature for deterministic analysis
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Venice API returned error ${response.status}: ${errorText}`);
    }

    const duration = Date.now() - startTime;
    const responseJson = await response.json();
    const content = responseJson.choices?.[0]?.message?.content || "";
    
    // Track cost based on usage tokens returned by Venice
    const usage = responseJson.usage || { prompt_tokens: 2000, completion_tokens: 500 };
    trackVeniceCost(usage.prompt_tokens, usage.completion_tokens);

    logger.info(`✅ Venice: Received analysis response for ${contractAddress} in ${duration}ms.`);

    const parsedResult = cleanAndParseVeniceResponse(content);
    return parsedResult;
  } catch (error: any) {
    logger.error(`❌ Venice: Inference failed for contract ${contractAddress}:`, error);
    
    // Safe fallback in case of rate-limiting or API outage
    return {
      vulnerable: false,
      confidence: 0,
      vulnerabilities: [],
      recommendation: `ANALYSIS_FAILED: ${error.message}`
    };
  }
}

/**
 * Extracts and parses a JSON object from LLM response text, handling formatting deviations.
 */
function cleanAndParseVeniceResponse(text: string): VeniceAnalysisResult {
  let cleaned = text.trim();
  
  // Strip out markdown code blocks if the model failed to follow system rules
  if (cleaned.includes("```")) {
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      cleaned = jsonMatch[1].trim();
    }
  }

  // Extract from the first '{' to the last '}'
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    cleaned = braceMatch[0];
  }

  try {
    const parsed = JSON.parse(cleaned);
    
    // Enforce default properties and type casting
    return {
      vulnerable: !!parsed.vulnerable,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      vulnerabilities: Array.isArray(parsed.vulnerabilities) ? parsed.vulnerabilities : [],
      recommendation: parsed.recommendation || "NONE"
    };
  } catch (err) {
    logger.error("⚠️ Venice: Failed to parse raw model content as JSON. Raw response content:", { rawText: text });
    throw new Error("InvalidJsonResponse: Model output could not be parsed as structured JSON");
  }
}
