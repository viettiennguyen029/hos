import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

async function deployEscrowFixture() {
  const [deployer, admin, operator, feeRecipient, organizer, talent, stranger] =
    await ethers.getSigners();

  const Forwarder = await ethers.getContractFactory("ERC2771Forwarder");
  const forwarder = await Forwarder.deploy("HosEscrowForwarder");
  await forwarder.waitForDeployment();

  const EscrowManager = await ethers.getContractFactory("EscrowManager");
  const escrow = await upgrades.deployProxy(
    EscrowManager,
    [admin.address, operator.address, feeRecipient.address],
    {
      kind: "uups",
      constructorArgs: [await forwarder.getAddress()],
      unsafeAllow: ["constructor", "state-variable-immutable"],
    }
  );
  await escrow.waitForDeployment();

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy("Mock USD", "mUSD");
  await token.waitForDeployment();

  return {
    escrow,
    forwarder,
    token,
    deployer,
    admin,
    operator,
    feeRecipient,
    organizer,
    talent,
    stranger,
  };
}

function bookingId(seed: string): string {
  return ethers.encodeBytes32String(seed);
}

describe("EscrowManager", () => {
  describe("initialize", () => {
    it("grants admin, admin-role, and operator-role, and sets the fee recipient", async () => {
      const { escrow, admin, operator, feeRecipient } = await loadFixture(deployEscrowFixture);

      const DEFAULT_ADMIN_ROLE = await escrow.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await escrow.ADMIN_ROLE();
      const OPERATOR_ROLE = await escrow.OPERATOR_ROLE();

      expect(await escrow.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
      expect(await escrow.hasRole(ADMIN_ROLE, admin.address)).to.equal(true);
      expect(await escrow.hasRole(OPERATOR_ROLE, operator.address)).to.equal(true);
      expect(await escrow.platformFeeRecipient()).to.equal(feeRecipient.address);
    });

    it("reverts when initialized with a zero address", async () => {
      const { forwarder, admin, operator } = await loadFixture(deployEscrowFixture);
      const EscrowManager = await ethers.getContractFactory("EscrowManager");

      await expect(
        upgrades.deployProxy(
          EscrowManager,
          [admin.address, operator.address, ethers.ZeroAddress],
          {
            kind: "uups",
            constructorArgs: [await forwarder.getAddress()],
            unsafeAllow: ["constructor", "state-variable-immutable"],
          }
        )
      ).to.be.reverted;
    });
  });

  describe("registerBooking", () => {
    it("locks in the booking's parties, token, amount, and fee", async () => {
      const { escrow, operator, token, organizer, talent } = await loadFixture(deployEscrowFixture);
      const id = bookingId("booking-1");

      await escrow
        .connect(operator)
        .registerBooking(id, organizer.address, talent.address, await token.getAddress(), 1_000_000n, 500);

      const record = await escrow.getEscrow(id);
      expect(record.organizer).to.equal(organizer.address);
      expect(record.talent).to.equal(talent.address);
      expect(record.token).to.equal(await token.getAddress());
      expect(record.amount).to.equal(1_000_000n);
      expect(record.feeBps).to.equal(500);
      expect(record.state).to.equal(1n); // State.Registered
    });

    it("reverts when called by a non-operator", async () => {
      const { escrow, stranger, token, organizer, talent } = await loadFixture(deployEscrowFixture);
      const id = bookingId("booking-2");

      await expect(
        escrow
          .connect(stranger)
          .registerBooking(id, organizer.address, talent.address, await token.getAddress(), 1_000_000n, 500)
      ).to.be.reverted;
    });

    it("reverts when the booking is already registered", async () => {
      const { escrow, operator, token, organizer, talent } = await loadFixture(deployEscrowFixture);
      const id = bookingId("booking-3");

      await escrow
        .connect(operator)
        .registerBooking(id, organizer.address, talent.address, await token.getAddress(), 1_000_000n, 500);

      await expect(
        escrow
          .connect(operator)
          .registerBooking(id, organizer.address, talent.address, await token.getAddress(), 1_000_000n, 500)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("reverts when feeBps exceeds MAX_BPS", async () => {
      const { escrow, operator, token, organizer, talent } = await loadFixture(deployEscrowFixture);
      const id = bookingId("booking-4");

      await expect(
        escrow
          .connect(operator)
          .registerBooking(id, organizer.address, talent.address, await token.getAddress(), 1_000_000n, 10_001)
      ).to.be.revertedWithCustomError(escrow, "FeeTooHigh");
    });

    it("reverts when amount is zero", async () => {
      const { escrow, operator, token, organizer, talent } = await loadFixture(deployEscrowFixture);
      const id = bookingId("booking-5");

      await expect(
        escrow
          .connect(operator)
          .registerBooking(id, organizer.address, talent.address, await token.getAddress(), 0n, 500)
      ).to.be.revertedWithCustomError(escrow, "ZeroAmount");
    });
  });

  // --- later tasks append additional describe() blocks here ---
});
