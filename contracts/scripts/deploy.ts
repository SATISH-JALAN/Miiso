import { ethers, run, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("═══════════════════════════════════════════════════");
  console.log("  Miiso Smart Contract Deployment — Base Sepolia");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Network:  ${network.name}`);
  console.log(`  Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(balance)} ETH`);
  console.log("═══════════════════════════════════════════════════\n");

  // ── 1. Deploy ApprovalRevocationEnforcer ────────────────────────
  console.log("📦 Deploying ApprovalRevocationEnforcer...");
  const EnforcerFactory = await ethers.getContractFactory("ApprovalRevocationEnforcer");
  const enforcer = await EnforcerFactory.deploy();
  await enforcer.waitForDeployment();
  const enforcerAddress = await enforcer.getAddress();
  console.log(`   ✅ ApprovalRevocationEnforcer deployed at: ${enforcerAddress}`);

  // ── 2. Deploy MiisoSuccessFeeHook ──────────────────────────────
  // USDC on Base Sepolia — use a known test USDC or deploy mock
  // Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const TREASURY = deployer.address; // Treasury = deployer for now

  console.log("\n📦 Deploying MiisoSuccessFeeHook...");
  console.log(`   USDC address: ${USDC_BASE_SEPOLIA}`);
  console.log(`   Treasury:     ${TREASURY}`);

  const FeeHookFactory = await ethers.getContractFactory("MiisoSuccessFeeHook");
  const feeHook = await FeeHookFactory.deploy(USDC_BASE_SEPOLIA, TREASURY);
  await feeHook.waitForDeployment();
  const feeHookAddress = await feeHook.getAddress();
  console.log(`   ✅ MiisoSuccessFeeHook deployed at: ${feeHookAddress}`);

  // ── 3. Summary ─────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  ApprovalRevocationEnforcer: ${enforcerAddress}`);
  console.log(`  MiisoSuccessFeeHook:        ${feeHookAddress}`);
  console.log("═══════════════════════════════════════════════════");

  // ── 4. Update .env instructions ────────────────────────────────
  console.log("\n📝 Add these to your backend/.env:\n");
  console.log(`  APPROVAL_REVOCATION_ENFORCER=${enforcerAddress}`);
  console.log(`  SUCCESS_FEE_HOOK=${feeHookAddress}`);

  // ── 5. Verify on BaseScan (if not localhost) ───────────────────
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n🔍 Verifying contracts on BaseScan...\n");

    try {
      console.log("   Verifying ApprovalRevocationEnforcer...");
      await run("verify:verify", {
        address: enforcerAddress,
        constructorArguments: [],
      });
      console.log("   ✅ ApprovalRevocationEnforcer verified!");
    } catch (err: any) {
      if (err.message.includes("Already Verified")) {
        console.log("   ℹ️  ApprovalRevocationEnforcer already verified");
      } else {
        console.log(`   ⚠️  Verification failed: ${err.message}`);
      }
    }

    try {
      console.log("   Verifying MiisoSuccessFeeHook...");
      await run("verify:verify", {
        address: feeHookAddress,
        constructorArguments: [USDC_BASE_SEPOLIA, TREASURY],
      });
      console.log("   ✅ MiisoSuccessFeeHook verified!");
    } catch (err: any) {
      if (err.message.includes("Already Verified")) {
        console.log("   ℹ️  MiisoSuccessFeeHook already verified");
      } else {
        console.log(`   ⚠️  Verification failed: ${err.message}`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
