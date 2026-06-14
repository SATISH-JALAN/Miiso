import { ethers } from "hardhat";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying HoneypotDrainer with:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  const Factory = await ethers.getContractFactory("HoneypotDrainer");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ HoneypotDrainer deployed to:", address);
  console.log("   Base Sepolia explorer: https://sepolia.basescan.org/address/" + address);

  const outPath = resolve(__dirname, "../../backend/.honeypot-address");
  writeFileSync(outPath, address, "utf8");
  console.log("   Saved to:", outPath);
  console.log("\nNext steps:");
  console.log("  1. Approve USDC to this spender from your demo wallet");
  console.log("  2. npx tsx scripts/sprint1-e2e.ts --honeypot", address);
  console.log("  3. Or POST /api/dev/simulate-threat with this spender + your wallet seeded");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
