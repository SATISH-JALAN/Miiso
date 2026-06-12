import {
  buildSiweHeader,
  getVeniceAuthHeader,
  cacheBearerFromResponse,
  clearCachedBearer,
} from "./siweAuth.js";
import { payForInference } from "../payments/x402Client.js";
import { trackVeniceCost } from "../utils/cost.js";
import { retryWithBackoff } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const VENICE_API_URL =
  process.env.VENICE_API_URL || "https://api.venice.ai/api/v1";

// Update this if Venice releases a newer uncensored model
const VENICE_MODEL = process.env.VENICE_MODEL || "venice-uncensored";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VeniceAnalysisResult {
  vulnerable: boolean;
  confidence: number;
  vulnerabilities: Array<{
    type: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    description: string;
    opcodePattern: string;
  } | string>;
  recommendation: string;
  explanation?: string;
  costUsdc: number;
  inputTokens: number;
  outputTokens: number;
  rawResponse: unknown;
}

// ── System prompt (exact — do not change) ────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Solidity smart contract security auditor. You are analyzing decompiled bytecode that has been converted to pseudo-Solidity. Your job is to identify security vulnerabilities that could be exploited to drain user funds.
Analyze the code for:

Reentrancy vulnerabilities (external CALL before SSTORE)
Hidden drain functions (transferFrom or transfer to hardcoded attacker addresses)
Missing access controls on sensitive functions
Delegatecall to dynamic/untrusted addresses
Integer overflow/underflow in fund calculations
Selfdestruct with unrestricted access
Price oracle manipulation vectors
Flash loan attack surfaces

Respond ONLY with valid JSON. No explanation, no markdown, no code blocks. Exact format:
{"vulnerable":true,"confidence":0.97,"vulnerabilities":["reentrancy","drain_function"],"recommendation":"Revoke all approvals immediately. Contract contains reentrancy flaw at withdrawal function and a hardcoded transfer to external address."}`;

// ── Core analyzer function ───────────────────────────────────────────────────

/**
 * Submits decompiled pseudo-Solidity to Venice AI for vulnerability analysis.
 * Uses SIWE x402 authentication per request — no API key subscription needed.
 */
export async function analyzeWithVenice(
  contractAddress: string,
  decompiledCode: string
): Promise<VeniceAnalysisResult> {
  const startTime = Date.now();

  logger.info(
    `[VeniceAnalyzer] Dispatching analysis for contract ${contractAddress.slice(0, 8)}...`
  );

  const userPrompt = `Contract address: ${contractAddress}\nDecompiled pseudo-Solidity:\n${decompiledCode}\nAnalyze this contract for security vulnerabilities. If the code appears incomplete or obfuscated, assess based on available patterns. Return JSON only.`;

  try {
    const result = await retryWithBackoff(
      () => callVeniceAPI(contractAddress, userPrompt),
      {
        maxAttempts: 2,
        baseDelayMs: 1000,
        shouldRetry: (err: unknown) => {
          // Only retry on network errors, NOT on 4xx responses
          if (err instanceof Error && err.message.includes("HTTP 4")) {
            return false;
          }
          return true;
        },
        onRetry: (attempt, delayMs) => {
          logger.warn(
            `[VeniceAnalyzer] Retry #${attempt} for ${contractAddress.slice(0, 8)} after ${delayMs}ms`
          );
        },
      }
    );

    const duration = Date.now() - startTime;
    logger.info(
      `[VeniceAnalyzer] ${contractAddress.slice(0, 8)} confidence=${result.confidence.toFixed(2)} vulns=${result.vulnerabilities.length} cost=$${result.costUsdc.toFixed(6)} duration=${duration}ms`
    );

    return result;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      `[VeniceAnalyzer] Failed for ${contractAddress.slice(0, 8)} after ${duration}ms: ${message}`
    );

    return {
      vulnerable: false,
      confidence: 0,
      vulnerabilities: [],
      recommendation: `ANALYSIS_FAILED: ${message}`,
      explanation: `Analysis failed due to error: ${message}`,
      costUsdc: 0,
      inputTokens: 0,
      outputTokens: 0,
      rawResponse: null,
    };
  }
}

/**
 * Makes the actual Venice API call with SIWE authentication,
 * 15-second timeout via AbortController, and 401 retry logic.
 */
async function callVeniceAPI(
  contractAddress: string,
  userPrompt: string
): Promise<VeniceAnalysisResult> {
  // Build SIWE or API key authentication header
  const siweHeader = await getVeniceAuthHeader();

  // Determine correct auth header format
  const isBearer = siweHeader.startsWith("Bearer ");

  // 15-second timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(isBearer
          ? { Authorization: siweHeader }
          : { "X-Sign-In-With-Ethereum": Buffer.from(siweHeader).toString("base64") }),
      },
      body: JSON.stringify({
        model: VENICE_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.1,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // ── Handle 402 Payment Required (x402 auto top-up) ──────────────────
    if (response.status === 402) {
      logger.warn(
        `[VeniceAnalyzer] Venice returned 402 Payment Required for ${contractAddress.slice(0, 8)} — triggering x402 USDC top-up...`
      );

      try {
        // Estimate ~2,500 tokens for a typical scan (2000 input + 500 output)
        const topUp = await payForInference(2500);
        logger.info(
          `[VeniceAnalyzer] x402 top-up sent: txHash=${topUp.txHash.slice(0, 10)}... amount=$${topUp.amountUsdc.toFixed(6)}`
        );
      } catch (payErr: unknown) {
        const msg = payErr instanceof Error ? payErr.message : String(payErr);
        logger.error(`[VeniceAnalyzer] x402 top-up failed: ${msg}`);
        throw new Error(`x402 payment failed — cannot proceed with Venice analysis: ${msg}`);
      }

      // Retry after top-up with a fresh SIWE header
      clearCachedBearer();
      const { header: freshHeader } = await buildSiweHeader();
      const freshIsBearer = freshHeader.startsWith("Bearer ");

      const retryAfterPayment = new AbortController();
      const retryPaymentTimeout = setTimeout(() => retryAfterPayment.abort(), 15_000);

      const paymentRetryResponse = await fetch(
        `${VENICE_API_URL}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(freshIsBearer
              ? { Authorization: freshHeader }
              : { "X-Sign-In-With-Ethereum": Buffer.from(freshHeader).toString("base64") }),
          },
          body: JSON.stringify({
            model: VENICE_MODEL,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 500,
            temperature: 0.1,
            stream: false,
          }),
          signal: retryAfterPayment.signal,
        }
      );

      clearTimeout(retryPaymentTimeout);

      if (!paymentRetryResponse.ok) {
        throw new Error(
          `HTTP ${paymentRetryResponse.status}: Venice API error after x402 top-up`
        );
      }

      cacheBearerFromResponse(paymentRetryResponse.headers);
      return parseVeniceResponse(await paymentRetryResponse.json());
    }

    // On 401 — clear cached bearer and retry with fresh SIWE
    if (response.status === 401) {
      clearCachedBearer();
      logger.warn(
        `[VeniceAnalyzer] Venice returned 401 for ${contractAddress.slice(0, 8)} — re-authenticating...`
      );

      const { header: freshHeader } = await buildSiweHeader();
      const freshIsBearer = freshHeader.startsWith("Bearer ");

      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 15_000);

      const retryResponse = await fetch(
        `${VENICE_API_URL}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(freshIsBearer
              ? { Authorization: freshHeader }
              : { "X-Sign-In-With-Ethereum": Buffer.from(freshHeader).toString("base64") }),
          },
          body: JSON.stringify({
            model: VENICE_MODEL,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 500,
            temperature: 0.1,
            stream: false,
          }),
          signal: retryController.signal,
        }
      );

      clearTimeout(retryTimeout);

      if (!retryResponse.ok) {
        throw new Error(
          `HTTP ${retryResponse.status}: Venice API error after re-auth`
        );
      }

      cacheBearerFromResponse(retryResponse.headers);
      return parseVeniceResponse(await retryResponse.json());
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP ${response.status}: ${errorText.slice(0, 200)}`
      );
    }

    // Cache any bearer token Venice returns for future requests
    cacheBearerFromResponse(response.headers);

    const responseJson = await response.json();
    return parseVeniceResponse(responseJson);
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === "AbortError") {
      logger.warn(
        `[VeniceAnalyzer] Timeout (15s) for ${contractAddress.slice(0, 8)}`
      );
      return {
        vulnerable: false,
        confidence: 0,
        vulnerabilities: [],
        recommendation: "TIMEOUT: Venice AI did not respond within 15 seconds",
        costUsdc: 0,
        inputTokens: 0,
        outputTokens: 0,
        rawResponse: null,
      };
    }

    throw err;
  }
}

// ── Response parser ──────────────────────────────────────────────────────────

/**
 * Parses the Venice AI chat completion response, extracting the JSON verdict
 * and computing inference costs. Handles malformed LLM output gracefully.
 */
function parseVeniceResponse(responseJson: unknown): VeniceAnalysisResult {
  const json = responseJson as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const rawText = json.choices?.[0]?.message?.content || "";
  const inputTokens = json.usage?.prompt_tokens ?? 0;
  const outputTokens = json.usage?.completion_tokens ?? 0;

  // Track cost via the central cost tracker
  if (inputTokens > 0 || outputTokens > 0) {
    trackVeniceCost(inputTokens, outputTokens);
  }

  // Calculate cost: Venice pricing per 1M tokens
  const costUsdc =
    (inputTokens / 1_000_000) * 0.18 + (outputTokens / 1_000_000) * 1.18;

  // Parse the JSON output from the LLM
  const parsed = cleanAndParseVeniceJSON(rawText);

  if (!parsed) {
    // Attempt regex extraction of confidence as last resort
    const confidenceMatch = rawText.match(/confidence["\s:]+(\d+\.?\d*)/i);
    const fallbackConfidence = confidenceMatch
      ? parseFloat(confidenceMatch[1])
      : 0;

    return {
      vulnerable: fallbackConfidence > 0.5,
      confidence: fallbackConfidence,
      vulnerabilities: [],
      recommendation: "Parse failed — raw response could not be decoded",
      explanation: "Venice returned unparseable output",
      costUsdc,
      inputTokens,
      outputTokens,
      rawResponse: rawText,
    };
  }

  return {
    vulnerable: !!parsed.vulnerable,
    confidence:
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0,
    vulnerabilities: Array.isArray(parsed.vulnerabilities)
      ? parsed.vulnerabilities
      : [],
    recommendation:
      typeof parsed.recommendation === "string"
        ? parsed.recommendation
        : "NONE",
    explanation:
      typeof parsed.explanation === "string"
        ? parsed.explanation
        : "No detailed explanation provided by threat intelligence engine.",
    costUsdc,
    inputTokens,
    outputTokens,
    rawResponse: responseJson,
  };
}

/**
 * Strips markdown code fences and extracts the JSON object from raw LLM text.
 */
function cleanAndParseVeniceJSON(
  text: string
): Record<string, unknown> | null {
  let cleaned = text.trim();

  // Strip markdown code blocks (```json ... ``` or ``` ... ```)
  if (cleaned.includes("```")) {
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch?.[1]) {
      cleaned = jsonMatch[1].trim();
    }
  }

  // Extract from the first '{' to the last '}'
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    cleaned = braceMatch[0];
  }

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    logger.error(
      "[VeniceAnalyzer] Failed to parse LLM output as JSON",
      { rawText: text.slice(0, 500) }
    );
    return null;
  }
}

// ── Backward-compatible alias ────────────────────────────────────────────────
// blockWatcher.ts and analysisAgent.ts import this name:
export { analyzeWithVenice as analyzeBytecodeWithVenice };
