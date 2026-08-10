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

  describe("deposit", () => {
    async function registerBooking() {
      const fixture = await loadFixture(deployEscrowFixture);
      const id = bookingId("deposit-booking");
      await fixture.escrow
        .connect(fixture.operator)
        .registerBooking(
          id,
          fixture.organizer.address,
          fixture.talent.address,
          await fixture.token.getAddress(),
          1_000_000n,
          500
        );
      await fixture.token.mint(fixture.organizer.address, 1_000_000n);
      return { ...fixture, id };
    }

    it("pulls the exact amount from the organizer and marks the escrow funded", async () => {
      const { escrow, token, organizer, id } = await registerBooking();

      await token.connect(organizer).approve(await escrow.getAddress(), 1_000_000n);
      await escrow.connect(organizer).deposit(id);

      expect(await token.balanceOf(await escrow.getAddress())).to.equal(1_000_000n);
      const record = await escrow.getEscrow(id);
      expect(record.state).to.equal(2n); // State.Funded
    });

    it("reverts when called by someone other than the registered organizer", async () => {
      const { escrow, token, organizer, stranger, id } = await registerBooking();

      await token.connect(organizer).approve(await escrow.getAddress(), 1_000_000n);

      await expect(
        escrow.connect(stranger).deposit(id)
      ).to.be.revertedWithCustomError(escrow, "NotAuthorizedForBooking");
    });

    it("reverts when the booking isn't in the Registered state", async () => {
      const { escrow, organizer } = await loadFixture(deployEscrowFixture);
      const id = bookingId("never-registered");

      await expect(
        escrow.connect(organizer).deposit(id)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("releaseToTalent", () => {
    async function fundedBooking(feeBps: number) {
      const fixture = await loadFixture(deployEscrowFixture);
      const id = bookingId("release-booking");
      await fixture.escrow
        .connect(fixture.operator)
        .registerBooking(
          id,
          fixture.organizer.address,
          fixture.talent.address,
          await fixture.token.getAddress(),
          1_000_000n,
          feeBps
        );
      await fixture.token.mint(fixture.organizer.address, 1_000_000n);
      await fixture.token.connect(fixture.organizer).approve(await fixture.escrow.getAddress(), 1_000_000n);
      await fixture.escrow.connect(fixture.organizer).deposit(id);
      return { ...fixture, id };
    }

    it("splits the deposit between talent and platform fee recipient when the organizer releases", async () => {
      const { escrow, token, organizer, talent, feeRecipient, id } = await fundedBooking(500);

      await escrow.connect(organizer).releaseToTalent(id);

      expect(await token.balanceOf(talent.address)).to.equal(950_000n);
      expect(await token.balanceOf(feeRecipient.address)).to.equal(50_000n);
      const record = await escrow.getEscrow(id);
      expect(record.state).to.equal(3n); // State.Released
    });

    it("sends the full amount to the talent when feeBps is zero", async () => {
      const { escrow, token, organizer, talent, id } = await fundedBooking(0);

      await escrow.connect(organizer).releaseToTalent(id);

      expect(await token.balanceOf(talent.address)).to.equal(1_000_000n);
    });

    it("allows the admin to release on the organizer's behalf", async () => {
      const { escrow, admin, talent, token, id } = await fundedBooking(500);

      await escrow.connect(admin).releaseToTalent(id);

      expect(await token.balanceOf(talent.address)).to.equal(950_000n);
    });

    it("reverts when called by neither the organizer nor an admin", async () => {
      const { escrow, stranger, id } = await fundedBooking(500);

      await expect(
        escrow.connect(stranger).releaseToTalent(id)
      ).to.be.revertedWithCustomError(escrow, "NotAuthorizedForBooking");
    });

    it("reverts when the booking isn't Funded", async () => {
      const { escrow, organizer } = await loadFixture(deployEscrowFixture);
      const id = bookingId("never-funded");

      await expect(
        escrow.connect(organizer).releaseToTalent(id)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("refundOrganizer", () => {
    async function fundedBooking() {
      const fixture = await loadFixture(deployEscrowFixture);
      const id = bookingId("refund-booking");
      await fixture.escrow
        .connect(fixture.operator)
        .registerBooking(
          id,
          fixture.organizer.address,
          fixture.talent.address,
          await fixture.token.getAddress(),
          1_000_000n,
          500
        );
      await fixture.token.mint(fixture.organizer.address, 1_000_000n);
      await fixture.token.connect(fixture.organizer).approve(await fixture.escrow.getAddress(), 1_000_000n);
      await fixture.escrow.connect(fixture.organizer).deposit(id);
      return { ...fixture, id };
    }

    it("returns the full deposit to the organizer when the admin refunds", async () => {
      const { escrow, token, organizer, admin, id } = await fundedBooking();

      await escrow.connect(admin).refundOrganizer(id);

      expect(await token.balanceOf(organizer.address)).to.equal(1_000_000n);
      const record = await escrow.getEscrow(id);
      expect(record.state).to.equal(4n); // State.Refunded
    });

    it("reverts when called by the organizer", async () => {
      const { escrow, organizer, id } = await fundedBooking();

      await expect(escrow.connect(organizer).refundOrganizer(id)).to.be.reverted;
    });

    it("reverts when the booking isn't Funded", async () => {
      const { escrow, admin } = await loadFixture(deployEscrowFixture);
      const id = bookingId("never-funded-refund");

      await expect(
        escrow.connect(admin).refundOrganizer(id)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("admin configuration", () => {
    it("lets the default admin update the platform fee recipient", async () => {
      const { escrow, admin, stranger } = await loadFixture(deployEscrowFixture);

      await escrow.connect(admin).setPlatformFeeRecipient(stranger.address);

      expect(await escrow.platformFeeRecipient()).to.equal(stranger.address);
    });

    it("reverts when a non-admin tries to update the fee recipient", async () => {
      const { escrow, stranger } = await loadFixture(deployEscrowFixture);

      await expect(escrow.connect(stranger).setPlatformFeeRecipient(stranger.address)).to.be.reverted;
    });
  });

  describe("pausing", () => {
    it("blocks registerBooking while paused", async () => {
      const { escrow, admin, operator, token, organizer, talent } = await loadFixture(deployEscrowFixture);
      await escrow.connect(admin).pause();

      await expect(
        escrow
          .connect(operator)
          .registerBooking(
            bookingId("paused-booking"),
            organizer.address,
            talent.address,
            await token.getAddress(),
            1_000_000n,
            500
          )
      ).to.be.reverted;
    });

    it("does not block refundOrganizer on an already-funded booking", async () => {
      const { escrow, admin, operator, token, organizer, talent } = await loadFixture(deployEscrowFixture);
      const id = bookingId("paused-but-funded");

      await escrow
        .connect(operator)
        .registerBooking(id, organizer.address, talent.address, await token.getAddress(), 1_000_000n, 500);
      await token.mint(organizer.address, 1_000_000n);
      await token.connect(organizer).approve(await escrow.getAddress(), 1_000_000n);
      await escrow.connect(organizer).deposit(id);

      await escrow.connect(admin).pause();
      await escrow.connect(admin).refundOrganizer(id);

      const record = await escrow.getEscrow(id);
      expect(record.state).to.equal(4n); // State.Refunded
    });
  });

  // --- later tasks append additional describe() blocks here ---
});
