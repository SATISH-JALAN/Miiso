/**
 * Sprint 1 — end-to-end demo pipeline test (Base Sepolia / local backend).
 *
 * Usage:
 *   npx tsx scripts/sprint1-e2e.ts
 *   npx tsx scripts/sprint1-e2e.ts --honeypot 0xYourDeployedHoneypot
 *   npx tsx scripts/sprint1-e2e.ts --user 0xYourWallet --simulate
 *
 * Requires backend running on PORT (default 3000).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.API_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;

// Base Sepolia USDC — whitelisted in seed
const SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function resolveHoneypot(): string | undefined {
  const cli = arg("--honeypot");
  if (cli) return cli;
  const env = process.env.HONEYPOT_ADDRESS;
  if (env) return env;
  const file = resolve(__dir, "../.honeypot-address");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  return undefined;
}

async function post(path: string, body: unknown) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json, ms: Date.now() - start };
}

async function get(path: string) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json, ms: Date.now() - start };
}

async function main() {
  console.log("🚀 Miiso Sprint 1 E2E —", BASE_URL);
  console.log("   Chain: Base Sepolia (84532)\n");

  // Reload whitelist cache if dev route available (after db-seed without restart)
  try {
    await post("/api/dev/reload-cache", {});
  } catch {
    /* dev routes may be disabled */
  }

  // 1. Health
  const health = await get("/api/health");
  if (!health.ok) {
    console.error("❌ Backend not reachable. Start with: pnpm dev:backend");
    process.exit(1);
  }
  console.log("✅ Health:", health.json);

  // 2. False positive — whitelisted USDC should skip Venice analysis
  console.log("\n── False positive test (whitelisted USDC) ──");
  const fp = await post("/api/analyze", { contractAddress: SEPOLIA_USDC });
  const fpData = fp.json as { data?: { skipped?: boolean; reason?: string }; success?: boolean };
  if (fp.ok && fpData?.data?.skipped) {
    console.log(`✅ USDC whitelisted — skipped analysis (${fp.ms}ms)`);
  } else if (fp.ok) {
    console.log(`⚠️  USDC analyze returned (not skipped) — check whitelist seed (${fp.ms}ms)`);
    console.log("   Run: cd backend && npx tsx scripts/db-seed.ts");
  } else {
    console.log(`❌ False positive test failed: ${fp.status}`, fp.json);
  }

  // 3. Honeypot analysis (Venice + Heimdall)
  const honeypot = resolveHoneypot();
  if (!honeypot) {
    console.log("\n⚠️  No honeypot address. Deploy first:");
    console.log("   cd contracts && npx hardhat run scripts/deploy-honeypot.ts --network baseSepolia");
    console.log("   Then re-run with --honeypot <address>\n");
  } else {
    console.log("\n── Honeypot analysis (Venice pipeline) ──");
    console.log("   Contract:", honeypot);
    const t0 = Date.now();
    const analysis = await post("/api/analyze", { contractAddress: honeypot });
    const elapsed = Date.now() - t0;

    if (analysis.ok) {
      const d = (analysis.json as { data?: Record<string, unknown> }).data;
      console.log(`✅ Analysis complete in ${elapsed}ms ${elapsed <= 10000 ? "(<10s ✓)" : "(>10s — slow RPC/Venice)"}`);
      console.log("   Confidence:", d?.combinedConfidence);
      console.log("   Static flags:", d?.staticRisks);
      console.log("   Venice verdict:", d?.veniceConfidenceVerdict);
      console.log("   Cost USDC:", d?.totalCostUsdc);
    } else {
      console.log(`❌ Analysis failed (${analysis.status}):`, analysis.json);
    }
  }

  // 4. Optional: simulate Tier 1 revoke for demo wallet
  const user = arg("--user") || process.env.DEMO_USER_ADDRESS;
  const simulate = process.argv.includes("--simulate");
  if (simulate && honeypot && user) {
    console.log("\n── Threat routing simulation (DEMO_MODE or dev route) ──");
    const sim = await post("/api/dev/simulate-threat", {
      spenderAddress: honeypot,
      veniceConfidence: 0.97,
      staticRisk: "high",
      staticFlags: ["CALL_BEFORE_SSTORE", "UNRESTRICTED_SELFDESTRUCT"],
    });
    if (sim.ok) {
      console.log("✅ routeThreatConfidence triggered for honeypot spender");
      console.log("   Check dashboard SSE for user:", user);
      console.log("   (User needs active permission + approval cache entry for this spender)");
    } else {
      console.log("❌ simulate-threat failed:", sim.status, sim.json);
      console.log("   Set ENABLE_DEV_ROUTES=true in backend .env");
    }
  } else if (simulate) {
    console.log("\n⚠️  --simulate requires --honeypot and --user <wallet>");
  }

  console.log("\n── Demo recording checklist ──");
  console.log("  [ ] MetaMask Flask connected on Base Sepolia");
  console.log("  [ ] Setup complete (upgrade → grant → fee approve)");
  console.log("  [ ] Approve USDC to honeypot spender from demo wallet");
  console.log("  [ ] POST /api/analyze honeypot (show Venice in terminal)");
  console.log("  [ ] Tier 1 revoke fires → webhook → dashboard updates");
  console.log("  [ ] Show 1Shot webhook log in backend console\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
