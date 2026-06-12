import { expect } from "chai";
import { ethers } from "hardhat";
import { ApprovalRevocationEnforcer } from "../typechain-types";

describe("ApprovalRevocationEnforcer", function () {
  let enforcer: ApprovalRevocationEnforcer;
  const APPROVE_SELECTOR = "0x095ea7b3";
  const ZERO_HASH = ethers.ZeroHash;
  const ZERO_ADDR = ethers.ZeroAddress;

  beforeEach(async function () {
    const Factory = await ethers.getContractFactory("ApprovalRevocationEnforcer");
    enforcer = await Factory.deploy();
    await enforcer.waitForDeployment();
  });

  // ═══════════════════════════════════════════════════════════════
  //  Helper: build approve(address, uint256) calldata
  // ═══════════════════════════════════════════════════════════════
  function encodeApprove(spender: string, amount: bigint): string {
    const iface = new ethers.Interface(["function approve(address,uint256)"]);
    return iface.encodeFunctionData("approve", [spender, amount]);
  }

  function encodeTransfer(to: string, amount: bigint): string {
    const iface = new ethers.Interface(["function transfer(address,uint256)"]);
    return iface.encodeFunctionData("transfer", [to, amount]);
  }

  function encodeTransferFrom(from: string, to: string, amount: bigint): string {
    const iface = new ethers.Interface(["function transferFrom(address,address,uint256)"]);
    return iface.encodeFunctionData("transferFrom", [from, to, amount]);
  }

  // ═══════════════════════════════════════════════════════════════
  //  VALID CASES — should pass
  // ═══════════════════════════════════════════════════════════════
  describe("Valid revocations", function () {
    it("allows approve(randomSpender, 0)", async function () {
      const [, spender] = await ethers.getSigners();
      const calldata = encodeApprove(spender.address, 0n);

      // Should not revert
      await expect(
        enforcer.beforeHook("0x", "0x", calldata, ZERO_HASH, ZERO_ADDR, ZERO_ADDR)
      ).to.not.be.reverted;
    });

    it("allows approve with any spender address as long as amount is 0", async function () {
      // Random addresses
      const addresses = [
        "0x0000000000000000000000000000000000000001",
        "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      ];

      for (const addr of addresses) {
        const calldata = encodeApprove(addr, 0n);
        await expect(
          enforcer.beforeHook("0x", "0x", calldata, ZERO_HASH, ZERO_ADDR, ZERO_ADDR)
        ).to.not.be.reverted;
      }
    });

    it("emits RevocationValidated event with correct parameters", async function () {
      const [delegator, redeemer, spender] = await ethers.getSigners();
      const calldata = encodeApprove(spender.address, 0n);
      const testHash = ethers.keccak256(ethers.toUtf8Bytes("test-delegation"));

      await expect(
        enforcer.beforeHook(
          "0x", "0x", calldata, testHash, delegator.address, redeemer.address
        )
      )
        .to.emit(enforcer, "RevocationValidated")
        .withArgs(delegator.address, redeemer.address, spender.address, testHash);
    });

    it("afterHook always succeeds (no-op)", async function () {
      const calldata = encodeApprove(ZERO_ADDR, 0n);
      await expect(
        enforcer.afterHook("0x", "0x", calldata, ZERO_HASH, ZERO_ADDR, ZERO_ADDR)
      ).to.not.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  INVALID CASES — must revert
  // ═══════════════════════════════════════════════════════════════
  describe("Blocked operations", function () {
    it("reverts on approve with non-zero amount", async function () {
      const [, spender] = await ethers.getSigners();
      const calldata = encodeApprove(spender.address, 1000n);

      await expect(
        enforcer.beforeHook("0x", "0x", calldata, ZERO_HASH, ZERO_ADDR, ZERO_ADDR)
      ).to.be.revertedWithCustomError(enforcer, "NonZeroApprovalAmount");
    });

    it("reverts on approve with max uint256 (unlimited approval)", async function () {
      const [, spender] = await ethers.getSigners();
      const maxUint = ethers.MaxUint256;
      const calldata = encodeApprove(spender.address, maxUint);

      await expect(
        enforcer.beforeHook("0x", "0x", calldata, ZERO_HASH, ZERO_ADDR, ZERO_ADDR)
      ).to.be.revertedWithCustomError(enforcer, "NonZeroApprovalAmount");
    });

    it("reverts on transfer() call", async function () {
      const [, to] = await ethers.getSigners();
      const calldata = encodeTransfer(to.address, 1000n);

      await expect(
        enforcer.beforeHook("0x", "0x", calldata, ZERO_HASH, ZERO_ADDR, ZERO_ADDR)
      ).to.be.revertedWithCustomError(enforcer, "InvalidSelector");
    });

    it("reverts on transferFrom() call", async function () {
      const [from, to] = await ethers.getSigners();
      const calldata = encodeTransferFrom(from.address, to.address, 1000n);

      await expect(
        enforcer.beforeHook("0x", "0x", calldata, ZERO_HASH, ZERO_ADDR, ZERO_ADDR)
      ).to.be.revertedWithCustomError(enforcer, "InvalidSelector");
    });

    it("reverts on arbitrary function selector", async function () {
      // selfDestruct() — 0xff
      const calldata = "0xff112233" + "00".repeat(64);

      await expect(
        enforcer.beforeHook("0x", "0x", calldata, ZERO_HASH, ZERO_ADDR, ZERO_ADDR)
      ).to.be.revertedWithCustomError(enforcer, "InvalidSelector");
    });

    it("reverts on calldata shorter than 68 bytes", async function () {
      // Just the selector — no arguments
      const calldata = APPROVE_SELECTOR;

      await expect(
        enforcer.beforeHook("0x", "0x", calldata, ZERO_HASH, ZERO_ADDR, ZERO_ADDR)
      ).to.be.revertedWithCustomError(enforcer, "CalldataTooShort");
    });

    it("reverts on empty calldata", async function () {
      await expect(
        enforcer.beforeHook("0x", "0x", "0x", ZERO_HASH, ZERO_ADDR, ZERO_ADDR)
      ).to.be.revertedWithCustomError(enforcer, "CalldataTooShort");
    });

    it("reverts on approve(spender, 1) — even amount=1 is blocked", async function () {
      const [, spender] = await ethers.getSigners();
      const calldata = encodeApprove(spender.address, 1n);

      await expect(
        enforcer.beforeHook("0x", "0x", calldata, ZERO_HASH, ZERO_ADDR, ZERO_ADDR)
      ).to.be.revertedWithCustomError(enforcer, "NonZeroApprovalAmount");
    });
  });
});
