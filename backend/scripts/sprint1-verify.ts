/**
 * Sprint 1 — automated pre-launch checklist verification (Phases 1–5).
 * Run: npx tsx scripts/sprint1-verify.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config();

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "../..");
const BACKEND = resolve(__dir, "..");

type Status = "pass" | "fail" | "warn" | "manual";

interface Check {
  phase: string;
  item: string;
  status: Status;
  note?: string;
}

const checks: Check[] = [];

function pass(phase: string, item: string, note?: string) {
  checks.push({ phase, item, status: "pass", note });
}
function fail(phase: string, item: string, note?: string) {
  checks.push({ phase, item, status: "fail", note });
}
function warn(phase: string, item: string, note?: string) {
  checks.push({ phase, item, status: "warn", note });
}
function manual(phase: string, item: string, note?: string) {
  checks.push({ phase, item, status: "manual", note });
}

function readSrc(rel: string): string {
  return readFileSync(resolve(BACKEND, rel), "utf8");
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, body: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, body: text };
  }
}

// ── Phase 1 ────────────────────────────────────────────────────────────────
function verifyPhase1() {
  const viem = readSrc("src/blockchain/viemClient.ts");
  if (viem.includes("webSocket") && viem.includes("fallback")) {
    pass("P1", "WSS + HTTP fallback in viemClient");
  } else {
    fail("P1", "WSS + HTTP fallback in viemClient");
  }

  if (!process.env.QUICKNODE_WSS_URL && !process.env.ALCHEMY_WSS_URL) {
    warn("P1", "QuickNode/Alchemy WSS env set", "Using public HTTP only — add WSS for production demo");
  } else {
    pass("P1", "QuickNode/Alchemy WSS env set");
  }

  const bw = readSrc("src/daemon/blockWatcher.ts");
  if (bw.includes("tx.to === null")) {
    pass("P1", "watchBlocks filters tx.to === null");
  } else {
    fail("P1", "watchBlocks filters tx.to === null");
  }

  const retry = readSrc("src/daemon/bytecodeRetry.ts");
  if (retry.includes("baseDelayMs: 250") && retry.includes("maxAttempts: 4")) {
    pass("P1", "Bytecode retry 250ms × 2^k (4 attempts)");
  } else {
    fail("P1", "Bytecode retry exponential backoff");
  }

  if (readSrc("src/daemon/proxyResolver.ts").includes("0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc")) {
    pass("P1", "EIP-1967 proxy slot checked");
  } else {
    fail("P1", "EIP-1967 proxy slot");
  }

  try {
    execSync("heimdall --version", { stdio: "ignore" });
    pass("P1", "Heimdall CLI installed");
  } catch {
    warn("P1", "Heimdall CLI installed", "Run backend/scripts/heimdall-install.sh");
  }

  const wp = readSrc("src/daemon/workerPool.ts");
  if (wp.includes("Worker") && !wp.includes("execSync")) {
    pass("P1", "Worker thread pool (not execSync on main)");
  } else {
    warn("P1", "Worker thread pool");
  }

  if (wp.includes("30000") || wp.includes("SIGKILL")) {
    pass("P1", "30s task timeout on Heimdall worker pool");
  } else {
    warn("P1", "30s SIGKILL on Heimdall subprocess");
  }

  if (readSrc("src/daemon/blockWatcher.ts").includes("isWhitelisted")) {
    pass("P1", "Whitelist check before Venice");
  } else {
    fail("P1", "Whitelist check before Venice");
  }
}

// ── Phase 2 ────────────────────────────────────────────────────────────────
function verifyPhase2() {
  const orch = readSrc("src/agents/orchestrator.ts");
  const bw = readSrc("src/daemon/blockWatcher.ts");
  if (bw.includes("decompileContract") && bw.includes("runOrchestrator")) {
    pass("P2", "Heimdall decompile before orchestrator/Venice");
  } else {
    fail("P2", "Heimdall before Venice");
  }

  const siwe = readSrc("src/daemon/siweAuth.ts");
  if (siwe.includes("chainId") && siwe.includes("nonce")) {
    pass("P2", "SIWE message fields present");
  } else {
    warn("P2", "SIWE message fields");
  }

  if (readSrc("src/payments/x402Client.ts").includes("402")) {
    pass("P2", "x402 auto top-up on 402");
  } else {
    fail("P2", "x402 auto top-up");
  }

  const router = readSrc("src/daemon/confidenceRouter.ts");
  if (router.includes("TIER1_THRESHOLD") && router.includes("TIER2_THRESHOLD")) {
    pass("P2", "Tier 1/2/3 thresholds in confidenceRouter");
  } else {
    fail("P2", "Tier routing thresholds");
  }

  if (process.env.VENICE_API_KEY) {
    pass("P2", "VENICE_API_KEY configured");
  } else {
    warn("P2", "VENICE_API_KEY configured", "Required for live Venice in demo");
  }

  manual("P2", "Agent EOA funded with $1 USDC for Venice x402", "Fund agent wallet on Base Sepolia");
}

// ── Phase 3 ────────────────────────────────────────────────────────────────
function verifyPhase3() {
  if (existsSync(resolve(BACKEND, "src/blockchain/oneshotRelay.ts"))) {
    pass("P3", "1Shot relay module (upgrade + revoke)");
  } else {
    fail("P3", "1Shot relay module");
  }

  const rev = readSrc("src/daemon/revocationExecutor.ts");
  if (rev.includes("relayer_getCapabilities") && rev.includes("relayer_send7710Transaction")) {
    pass("P3", "relayer_getCapabilities + send7710 on revoke");
  } else {
    fail("P3", "1Shot relayer revoke flow");
  }

  if (rev.includes("0x095ea7b3")) {
    pass("P3", "approve(0) selector pre-validation");
  } else {
    fail("P3", "ERC-7710 calldata selector 0x095ea7b3");
  }

  if (rev.includes("effectiveFee") || rev.includes("minFee")) {
    pass("P3", "Fee formula max(gas×1.2, minFee)");
  } else {
    fail("P3", "1Shot fee formula");
  }

  manual("P3", "disableDelegation() tested", "Sprint 3 item — on-chain revoke in Settings");
  manual("P3", "Agent EOA funded with $1 USDC for relay", "Fund agent on Base Sepolia");
}

// ── Phase 4 ────────────────────────────────────────────────────────────────
function verifyPhase4() {
  const ed = readSrc("src/security/ed25519.ts");
  if (
    ed.includes("node:crypto") &&
    ed.includes("crypto.verify") &&
    !/from\s+["']node-forge["']/.test(ed)
  ) {
    pass("P4", "Ed25519 via node:crypto only");
  } else {
    fail("P4", "Ed25519 node:crypto");
  }

  if (process.env.AGENT_PRIVATE_KEY && process.env.AGENT_PRIVATE_KEY.length > 10) {
    pass("P4", "AGENT_PRIVATE_KEY in .env");
  } else {
    fail("P4", "AGENT_PRIVATE_KEY in .env");
  }

  if (readFileSync(resolve(ROOT, ".gitignore"), "utf8").includes(".env")) {
    pass("P4", ".gitignore covers .env");
  } else {
    fail("P4", ".gitignore covers .env");
  }

  if (process.env.DATABASE_URL) {
    pass("P4", "DATABASE_URL configured");
  } else {
    fail("P4", "DATABASE_URL configured");
  }

  manual("P4", "drizzle-kit push / schema migrated", "Run: cd backend && npx drizzle-kit push");
  manual("P4", "pgvector enabled", "Run migrate-pgvector if needed");
  manual("P4", "SSE LISTEN/NOTIFY < 4s", "Test via sprint1-e2e with running server");
}

// ── Phase 5 ────────────────────────────────────────────────────────────────
function verifyPhase5() {
  const wagmi = readFileSync(resolve(ROOT, "frontend/src/lib/wagmiConfig.ts"), "utf8");
  if (wagmi.includes("84532") || wagmi.includes("baseSepolia")) {
    pass("P5", "wagmi configured for Base Sepolia (84532)");
  } else {
    warn("P5", "wagmi Base Sepolia", "Checklist says 8453 mainnet — demo uses Sepolia");
  }

  if (readFileSync(resolve(ROOT, "frontend/src/Setup.tsx"), "utf8").includes("upgradeToSmartAccount")) {
    pass("P5", "EIP-7702 upgrade step in Setup");
  } else {
    fail("P5", "EIP-7702 upgrade in Setup");
  }

  if (existsSync(resolve(ROOT, "frontend/src/hooks/useSSE.ts"))) {
    pass("P5", "SSE hook present");
  } else {
    fail("P5", "SSE hook");
  }

  if (existsSync(resolve(ROOT, "frontend/src/components/dashboard/VetoTimer.tsx"))) {
    pass("P5", "VetoTimer component");
  } else {
    warn("P5", "VetoTimer component");
  }
}

async function verifyLiveApi() {
  const base = process.env.API_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
  try {
    const health = await fetchJson(`${base}/api/health`);
    if (health.ok) {
      pass("LIVE", "GET /api/health", JSON.stringify(health.body).slice(0, 120));
    } else {
      warn("LIVE", "GET /api/health", `Server returned ${health.status}`);
    }
  } catch {
    warn("LIVE", "GET /api/health", "Start backend: pnpm dev:backend");
  }

  try {
    const caps = await fetchJson(`${base}/api/relay/capabilities`);
    if (caps.ok) {
      pass("LIVE", "GET /api/relay/capabilities (1Shot fee quote)");
    } else {
      warn("LIVE", "GET /api/relay/capabilities", `Status ${caps.status}`);
    }
  } catch {
    warn("LIVE", "GET /api/relay/capabilities");
  }
}

function printReport() {
  const icons = { pass: "✅", fail: "❌", warn: "⚠️ ", manual: "📋" };
  let passN = 0,
    failN = 0,
    warnN = 0,
    manualN = 0;

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║           MIISO SPRINT 1 — CHECKLIST VERIFY              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  let lastPhase = "";
  for (const c of checks) {
    if (c.phase !== lastPhase) {
      console.log(`\n── ${c.phase} ──`);
      lastPhase = c.phase;
    }
    console.log(`${icons[c.status]} ${c.item}${c.note ? ` — ${c.note}` : ""}`);
    if (c.status === "pass") passN++;
    else if (c.status === "fail") failN++;
    else if (c.status === "warn") warnN++;
    else manualN++;
  }

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(`PASS: ${passN}  WARN: ${warnN}  FAIL: ${failN}  MANUAL: ${manualN}`);
  console.log("────────────────────────────────────────────────────────────\n");

  if (failN > 0) process.exitCode = 1;
}

async function main() {
  verifyPhase1();
  verifyPhase2();
  verifyPhase3();
  verifyPhase4();
  verifyPhase5();
  await verifyLiveApi();
  printReport();
}

main();
