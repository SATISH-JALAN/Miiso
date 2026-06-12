import { expect } from "chai";
import { ethers } from "hardhat";
import { MiisoSuccessFeeHook } from "../typechain-types";

describe("MiisoSuccessFeeHook", function () {
  let feeHook: MiisoSuccessFeeHook;
  let mockUsdc: any;
  let owner: any, treasury: any, user: any, attacker: any;

  const USDC_DECIMALS = 6;
  const toUsdc = (amount: number) => BigInt(amount) * 10n ** BigInt(USDC_DECIMALS);

  beforeEach(async function () {
    [owner, treasury, user, attacker] = await ethers.getSigners();

    // Deploy a mock ERC-20 to act as USDC
    const MockERC20 = await ethers.getContractFactory("MockUSDC");
    mockUsdc = await MockERC20.deploy();
    await mockUsdc.waitForDeployment();

    // Deploy the fee hook
    const Factory = await ethers.getContractFactory("MiisoSuccessFeeHook");
    feeHook = await Factory.deploy(
      await mockUsdc.getAddress(),
      treasury.address
    );
    await feeHook.waitForDeployment();

    // Mint USDC to user and approve the fee hook
    await mockUsdc.mint(user.address, toUsdc(10_000)); // $10,000 USDC
    await mockUsdc.connect(user).approve(await feeHook.getAddress(), toUsdc(500)); // $500 budget
  });

  describe("Fee collection", function () {
    it("collects 1.5% of protected value", async function () {
      const protectedValue = toUsdc(7_000); // $7,000
      const expectedFee = (protectedValue * 150n) / 10_000n; // $105
      const eventId = ethers.keccak256(ethers.toUtf8Bytes("event-1"));

      await feeHook.collectFee(user.address, protectedValue, eventId);

      expect(await mockUsdc.balanceOf(treasury.address)).to.equal(expectedFee);
      expect(expectedFee).to.equal(toUsdc(105)); // $105 USDC
    });

    it("emits SuccessFeeCollected event", async function () {
      const protectedValue = toUsdc(2_000);
      const expectedFee = (protectedValue * 150n) / 10_000n; // $30
      const eventId = ethers.keccak256(ethers.toUtf8Bytes("event-2"));

      await expect(feeHook.collectFee(user.address, protectedValue, eventId))
        .to.emit(feeHook, "SuccessFeeCollected")
        .withArgs(user.address, protectedValue, expectedFee, eventId);
    });

    it("tracks total fees collected", async function () {
      const eventId1 = ethers.keccak256(ethers.toUtf8Bytes("event-a"));
      const eventId2 = ethers.keccak256(ethers.toUtf8Bytes("event-b"));

      await feeHook.collectFee(user.address, toUsdc(1_000), eventId1);
      await feeHook.collectFee(user.address, toUsdc(2_000), eventId2);

      const expected = toUsdc(15) + toUsdc(30); // $15 + $30 = $45
      expect(await feeHook.totalFeesCollected()).to.equal(expected);
    });
  });

  describe("Deduplication", function () {
    it("reverts if same event ID is charged twice", async function () {
      const eventId = ethers.keccak256(ethers.toUtf8Bytes("event-dup"));

      await feeHook.collectFee(user.address, toUsdc(1_000), eventId);

      await expect(
        feeHook.collectFee(user.address, toUsdc(1_000), eventId)
      ).to.be.revertedWithCustomError(feeHook, "FeeAlreadyCollected");
    });
  });

  describe("Safety checks", function () {
    it("reverts on zero protected value", async function () {
      const eventId = ethers.keccak256(ethers.toUtf8Bytes("event-zero"));
      await expect(
        feeHook.collectFee(user.address, 0n, eventId)
      ).to.be.revertedWithCustomError(feeHook, "ZeroProtectedValue");
    });

    it("reverts on zero address user", async function () {
      const eventId = ethers.keccak256(ethers.toUtf8Bytes("event-zaddr"));
      await expect(
        feeHook.collectFee(ethers.ZeroAddress, toUsdc(1_000), eventId)
      ).to.be.revertedWithCustomError(feeHook, "ZeroAddress");
    });

    it("reverts if fee exceeds maximum (500 USDC)", async function () {
      // Protected value that would produce >500 USDC fee
      // Fee = value * 150 / 10000 = 500 USDC → value = 500 * 10000 / 150 = ~33,333 USDC
      const tooMuch = toUsdc(34_000); // Fee = $510, exceeds $500 cap
      const eventId = ethers.keccak256(ethers.toUtf8Bytes("event-max"));

      await expect(
        feeHook.collectFee(user.address, tooMuch, eventId)
      ).to.be.revertedWithCustomError(feeHook, "FeeExceedsMaximum");
    });

    it("only owner can collect fees", async function () {
      const eventId = ethers.keccak256(ethers.toUtf8Bytes("event-auth"));

      await expect(
        feeHook.connect(attacker).collectFee(user.address, toUsdc(1_000), eventId)
      ).to.be.revertedWithCustomError(feeHook, "OwnableUnauthorizedAccount");
    });
  });

  describe("Admin", function () {
    it("allows owner to update treasury", async function () {
      const [, , , , newTreasury] = await ethers.getSigners();
      await feeHook.setTreasury(newTreasury.address);
      expect(await feeHook.treasury()).to.equal(newTreasury.address);
    });

    it("emits TreasuryUpdated event", async function () {
      const [, , , , newTreasury] = await ethers.getSigners();
      await expect(feeHook.setTreasury(newTreasury.address))
        .to.emit(feeHook, "TreasuryUpdated")
        .withArgs(treasury.address, newTreasury.address);
    });

    it("reverts on zero address treasury", async function () {
      await expect(
        feeHook.setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(feeHook, "ZeroAddress");
    });
  });
});
