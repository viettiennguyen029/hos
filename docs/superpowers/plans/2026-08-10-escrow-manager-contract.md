# EscrowManager Smart Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and test the `EscrowManager` UUPS-upgradeable Solidity contract — the on-chain piece of the blockchain escrow payment feature — as a self-contained Hardhat subproject at `contracts/`.

**Architecture:** A single upgradeable proxy contract holds a `mapping(bytes32 => Escrow)` keyed by booking ID. An `OPERATOR_ROLE` locks in a booking's parties/amount/fee before any money moves; the organizer (via `_msgSender()`, meta-tx-compatible) funds it; either the organizer or `ADMIN_ROLE` releases it to the talent (contract computes the fee split); only `ADMIN_ROLE` can refund it. Gas-sponsorship compatibility comes from inheriting `ERC2771ContextUpgradeable` pointed at a standard OpenZeppelin `ERC2771Forwarder`.

**Tech Stack:** Solidity 0.8.24, Hardhat + `@nomicfoundation/hardhat-toolbox` (ethers v6), `@openzeppelin/contracts` + `@openzeppelin/contracts-upgradeable` v5.x, `@openzeppelin/hardhat-upgrades` for proxy deploy/upgrade + storage-layout safety checks. Package manager: `bun` (per this repo's convention), but the Solidity test suite runs via Hardhat's own runner (`bunx hardhat test`), not `bun:test` — Solidity/EVM tests cannot run under Bun's test runner.

## Global Constraints

- Chain: Avalanche C-Chain (mainnet `43114`) / Fuji testnet (`43113`).
- Settlement token: USDT/USDC (standard ERC20; `SafeERC20` used for transfers to tolerate non-standard-return tokens like USDT).
- Contract must be UUPS-upgradeable (`UUPSUpgradeable`, `_authorizeUpgrade` gated to `DEFAULT_ADMIN_ROLE`).
- `feeBps` is per-booking, locked in at `registerBooking` time, and the contract (not the caller) computes the release split from it — max `10_000` (100%).
- `pause()` must never block `releaseToTalent`/`refundOrganizer` on an already-`Funded` escrow — only `registerBooking`/`deposit`.
- No token-sweep/rescue function — the contract must never expose a way to move funds outside the `Escrow` state machine.
- `nonReentrant` on every function that moves tokens (`deposit`, `releaseToTalent`, `refundOrganizer`).
- TDD: every task starts with a failing test (RED) before implementation (GREEN), per this repo's `.claude/rules/tdd.md`.
- Full design context: `docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md`.

---

### Task 1: Hardhat project scaffold + contract skeleton (roles, storage, initialize)

**Files:**
- Create: `contracts/package.json`
- Create: `contracts/hardhat.config.ts`
- Create: `contracts/tsconfig.json`
- Create: `contracts/.gitignore`
- Create: `contracts/.env.example`
- Create: `contracts/contracts/EscrowManager.sol`
- Create: `contracts/contracts/Imports.sol`
- Create: `contracts/contracts/mocks/MockERC20.sol`
- Test: `contracts/test/EscrowManager.test.ts`

**Interfaces:**
- Produces: `EscrowManager` contract with `ADMIN_ROLE`, `OPERATOR_ROLE`, `MAX_BPS` constants; `Escrow` struct (`organizer, talent, token, amount, feeBps, state`); `State` enum (`None, Registered, Funded, Released, Refunded`); `escrows(bytes32) → Escrow` public mapping; `platformFeeRecipient() → address`; `getEscrow(bytes32) → Escrow`; `initialize(address admin, address operator, address feeRecipient)`; errors `InvalidState(bytes32,State,State)`, `NotAuthorizedForBooking(bytes32,address)`, `FeeTooHigh(uint16)`, `ZeroAmount()`, `ZeroAddress()`; events `BookingRegistered`, `Deposited`, `Released`, `Refunded`, `PlatformFeeRecipientUpdated` (declared now, emitted by later tasks). Test file exports `deployEscrowFixture()` and `bookingId(seed: string)` helpers that every later task's tests reuse.
- Consumes: nothing (first task).

- [ ] **Step 1: Scaffold the Hardhat subproject**

Create `contracts/package.json`:

```json
{
  "name": "hos-contracts",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "deploy:fuji": "hardhat run scripts/deploy.ts --network avalancheFuji",
    "deploy:mainnet": "hardhat run scripts/deploy.ts --network avalanche"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@openzeppelin/contracts": "^5.1.0",
    "@openzeppelin/contracts-upgradeable": "^5.1.0",
    "@openzeppelin/hardhat-upgrades": "^3.5.0",
    "dotenv": "^16.4.0",
    "hardhat": "^2.22.0",
    "typescript": "^5.6.0"
  }
}
```

Create `contracts/hardhat.config.ts`:

```typescript
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    avalancheFuji: {
      url: process.env.AVALANCHE_FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 43113,
    },
    avalanche: {
      url: process.env.AVALANCHE_MAINNET_RPC_URL ?? "https://api.avax.network/ext/bc/C/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 43114,
    },
  },
};

export default config;
```

Create `contracts/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist"
  },
  "include": ["./scripts", "./test", "./hardhat.config.ts"]
}
```

Create `contracts/.gitignore`:

```
node_modules
artifacts
cache
dist
.env
typechain-types
```

Create `contracts/.env.example`:

```
# RPC endpoints
AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_MAINNET_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Deployer key — pays gas for the deployment transaction itself.
# NOT the same key as the app's sponsored-gas relayer wallet.
DEPLOYER_PRIVATE_KEY=

# Roles granted at initialize() — see
# docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md
ESCROW_ADMIN_ADDRESS=
ESCROW_OPERATOR_ADDRESS=
ESCROW_FEE_RECIPIENT_ADDRESS=

# Optional: reuse an already-deployed ERC2771Forwarder instead of
# deploying a new one.
TRUSTED_FORWARDER_ADDRESS=
```

Run: `cd contracts && bun install`
Expected: installs without error, creates `contracts/node_modules` and `contracts/bun.lock`.

- [ ] **Step 2: Write the contract skeleton**

Create `contracts/contracts/EscrowManager.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC2771ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title EscrowManager
/// @notice Holds USDT/USDC deposited by an organizer for a booking until
/// the booking resolves: released to the talent (fee deducted) or
/// refunded to the organizer.
contract EscrowManager is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    ERC2771ContextUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    uint16 public constant MAX_BPS = 10_000;

    enum State {
        None,
        Registered,
        Funded,
        Released,
        Refunded
    }

    struct Escrow {
        address organizer;
        address talent;
        address token;
        uint256 amount;
        uint16 feeBps;
        State state;
    }

    mapping(bytes32 => Escrow) public escrows;
    address public platformFeeRecipient;

    event BookingRegistered(
        bytes32 indexed bookingId,
        address indexed organizer,
        address indexed talent,
        address token,
        uint256 amount,
        uint16 feeBps
    );
    event Deposited(bytes32 indexed bookingId);
    event Released(bytes32 indexed bookingId, uint256 talentAmount, uint256 feeAmount);
    event Refunded(bytes32 indexed bookingId, uint256 amount);
    event PlatformFeeRecipientUpdated(address indexed recipient);

    error InvalidState(bytes32 bookingId, State expected, State actual);
    error NotAuthorizedForBooking(bytes32 bookingId, address caller);
    error FeeTooHigh(uint16 feeBps);
    error ZeroAmount();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {
        _disableInitializers();
    }

    function initialize(address admin, address operator, address feeRecipient) public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        if (admin == address(0) || operator == address(0) || feeRecipient == address(0)) {
            revert ZeroAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
        platformFeeRecipient = feeRecipient;
    }

    function getEscrow(bytes32 bookingId) external view returns (Escrow memory) {
        return escrows[bookingId];
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address) {
        return ERC2771ContextUpgradeable._msgSender();
    }

    function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
        return ERC2771ContextUpgradeable._msgData();
    }

    function _contextSuffixLength() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (uint256) {
        return ERC2771ContextUpgradeable._contextSuffixLength();
    }
}
```

Create `contracts/contracts/Imports.sol` (forces Hardhat to compile OpenZeppelin's `ERC2771Forwarder`, which nothing else in this project imports directly but tests deploy):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
```

Create `contracts/contracts/mocks/MockERC20.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

Run: `bunx hardhat compile`
Expected: `Compiled N Solidity files successfully`, no errors.

- [ ] **Step 3: Write the failing initialize tests**

Create `contracts/test/EscrowManager.test.ts`:

```typescript
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

  // --- later tasks append additional describe() blocks here ---
});
```

Run: `bunx hardhat test`
Expected: both `initialize` tests PASS immediately (this task's "RED" step is steps 1–2: before the skeleton existed, `bunx hardhat compile` would have failed with "file not found" — the skeleton and its tests are written together here because there is no meaningful partial state between "no contract" and "a compiling, initializable contract"). Confirm no other failures.

- [ ] **Step 4: Commit**

```bash
cd contracts
git add package.json hardhat.config.ts tsconfig.json .gitignore .env.example contracts/EscrowManager.sol contracts/Imports.sol contracts/mocks/MockERC20.sol test/EscrowManager.test.ts
git commit -m "feat(contracts): scaffold EscrowManager with roles and initialize"
```

---

### Task 2: `registerBooking`

**Files:**
- Modify: `contracts/contracts/EscrowManager.sol` (add function, insert immediately above `function _authorizeUpgrade`)
- Modify: `contracts/test/EscrowManager.test.ts` (add `describe("registerBooking", ...)`, insert immediately before the `// --- later tasks append additional describe() blocks here ---` marker)

**Interfaces:**
- Consumes: `OPERATOR_ROLE`, `State`, `Escrow`, `escrows`, errors `InvalidState/ZeroAddress/ZeroAmount/FeeTooHigh`, event `BookingRegistered` (all from Task 1).
- Produces: `registerBooking(bytes32 bookingId, address organizer, address talent, address token, uint256 amount, uint16 feeBps) external` — transitions a booking `None → Registered`.

- [ ] **Step 1: Write the failing tests**

In `contracts/test/EscrowManager.test.ts`, insert before the marker comment:

```typescript
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
```

Run: `bunx hardhat test`
Expected: FAIL — `TypeError: escrow.registerBooking is not a function`.

- [ ] **Step 2: Implement `registerBooking`**

In `contracts/contracts/EscrowManager.sol`, insert immediately above `function _authorizeUpgrade`:

```solidity
    function registerBooking(
        bytes32 bookingId,
        address organizer,
        address talent,
        address token,
        uint256 amount,
        uint16 feeBps
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Escrow storage escrow = escrows[bookingId];
        if (escrow.state != State.None) {
            revert InvalidState(bookingId, State.None, escrow.state);
        }
        if (organizer == address(0) || talent == address(0) || token == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (feeBps > MAX_BPS) {
            revert FeeTooHigh(feeBps);
        }

        escrow.organizer = organizer;
        escrow.talent = talent;
        escrow.token = token;
        escrow.amount = amount;
        escrow.feeBps = feeBps;
        escrow.state = State.Registered;

        emit BookingRegistered(bookingId, organizer, talent, token, amount, feeBps);
    }
```

Run: `bunx hardhat test`
Expected: PASS — all 7 tests (2 from Task 1, 5 new).

- [ ] **Step 3: Commit**

```bash
cd contracts
git add contracts/EscrowManager.sol test/EscrowManager.test.ts
git commit -m "feat(contracts): add registerBooking"
```

---

### Task 3: `deposit`

**Files:**
- Modify: `contracts/contracts/EscrowManager.sol` (add function, insert immediately above `function _authorizeUpgrade`)
- Modify: `contracts/test/EscrowManager.test.ts` (add `describe("deposit", ...)`, insert before the marker comment)

**Interfaces:**
- Consumes: `registerBooking` (Task 2), `nonReentrant`/`whenNotPaused` modifiers, `_msgSender()` (Task 1), `SafeERC20`.
- Produces: `deposit(bytes32 bookingId) external` — transitions `Registered → Funded`, pulls `escrow.amount` of `escrow.token` from `escrow.organizer`.

- [ ] **Step 1: Write the failing tests**

In `contracts/test/EscrowManager.test.ts`, insert before the marker comment:

```typescript
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
```

Run: `bunx hardhat test`
Expected: FAIL — `TypeError: escrow.deposit is not a function`.

- [ ] **Step 2: Implement `deposit`**

In `contracts/contracts/EscrowManager.sol`, insert immediately above `function _authorizeUpgrade`:

```solidity
    function deposit(bytes32 bookingId) external nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[bookingId];
        if (escrow.state != State.Registered) {
            revert InvalidState(bookingId, State.Registered, escrow.state);
        }
        if (_msgSender() != escrow.organizer) {
            revert NotAuthorizedForBooking(bookingId, _msgSender());
        }

        escrow.state = State.Funded;
        IERC20(escrow.token).safeTransferFrom(escrow.organizer, address(this), escrow.amount);

        emit Deposited(bookingId);
    }
```

Run: `bunx hardhat test`
Expected: PASS — all 10 tests.

- [ ] **Step 3: Commit**

```bash
cd contracts
git add contracts/EscrowManager.sol test/EscrowManager.test.ts
git commit -m "feat(contracts): add deposit"
```

---

### Task 4: `releaseToTalent`

**Files:**
- Modify: `contracts/contracts/EscrowManager.sol` (add function, insert immediately above `function _authorizeUpgrade`)
- Modify: `contracts/test/EscrowManager.test.ts` (add `describe("releaseToTalent", ...)`, insert before the marker comment)

**Interfaces:**
- Consumes: `deposit` (Task 3), `MAX_BPS`, `platformFeeRecipient`.
- Produces: `releaseToTalent(bytes32 bookingId) external` — transitions `Funded → Released`, splits `escrow.amount` between talent and `platformFeeRecipient` per `escrow.feeBps`.

- [ ] **Step 1: Write the failing tests**

In `contracts/test/EscrowManager.test.ts`, insert before the marker comment:

```typescript
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
```

Run: `bunx hardhat test`
Expected: FAIL — `TypeError: escrow.releaseToTalent is not a function`.

- [ ] **Step 2: Implement `releaseToTalent`**

In `contracts/contracts/EscrowManager.sol`, insert immediately above `function _authorizeUpgrade`:

```solidity
    function releaseToTalent(bytes32 bookingId) external nonReentrant {
        Escrow storage escrow = escrows[bookingId];
        if (escrow.state != State.Funded) {
            revert InvalidState(bookingId, State.Funded, escrow.state);
        }

        address caller = _msgSender();
        if (caller != escrow.organizer && !hasRole(ADMIN_ROLE, caller)) {
            revert NotAuthorizedForBooking(bookingId, caller);
        }

        escrow.state = State.Released;

        uint256 fee = (escrow.amount * escrow.feeBps) / MAX_BPS;
        uint256 talentAmount = escrow.amount - fee;

        IERC20(escrow.token).safeTransfer(escrow.talent, talentAmount);
        if (fee > 0) {
            IERC20(escrow.token).safeTransfer(platformFeeRecipient, fee);
        }

        emit Released(bookingId, talentAmount, fee);
    }
```

Run: `bunx hardhat test`
Expected: PASS — all 15 tests.

- [ ] **Step 3: Commit**

```bash
cd contracts
git add contracts/EscrowManager.sol test/EscrowManager.test.ts
git commit -m "feat(contracts): add releaseToTalent"
```

---

### Task 5: `refundOrganizer`

**Files:**
- Modify: `contracts/contracts/EscrowManager.sol` (add function, insert immediately above `function _authorizeUpgrade`)
- Modify: `contracts/test/EscrowManager.test.ts` (add `describe("refundOrganizer", ...)`, insert before the marker comment)

**Interfaces:**
- Consumes: `ADMIN_ROLE`, `State.Funded` (Tasks 1, 3).
- Produces: `refundOrganizer(bytes32 bookingId) external` — `ADMIN_ROLE`-only, transitions `Funded → Refunded`, returns full `escrow.amount` to `escrow.organizer`.

- [ ] **Step 1: Write the failing tests**

In `contracts/test/EscrowManager.test.ts`, insert before the marker comment:

```typescript
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
```

Run: `bunx hardhat test`
Expected: FAIL — `TypeError: escrow.refundOrganizer is not a function`.

- [ ] **Step 2: Implement `refundOrganizer`**

In `contracts/contracts/EscrowManager.sol`, insert immediately above `function _authorizeUpgrade`:

```solidity
    function refundOrganizer(bytes32 bookingId) external onlyRole(ADMIN_ROLE) nonReentrant {
        Escrow storage escrow = escrows[bookingId];
        if (escrow.state != State.Funded) {
            revert InvalidState(bookingId, State.Funded, escrow.state);
        }

        escrow.state = State.Refunded;

        IERC20(escrow.token).safeTransfer(escrow.organizer, escrow.amount);

        emit Refunded(bookingId, escrow.amount);
    }
```

Run: `bunx hardhat test`
Expected: PASS — all 18 tests.

- [ ] **Step 3: Commit**

```bash
cd contracts
git add contracts/EscrowManager.sol test/EscrowManager.test.ts
git commit -m "feat(contracts): add refundOrganizer"
```

---

### Task 6: Admin configuration (`setPlatformFeeRecipient`, `pause`/`unpause`)

**Files:**
- Modify: `contracts/contracts/EscrowManager.sol` (add functions, insert immediately above `function _authorizeUpgrade`)
- Modify: `contracts/test/EscrowManager.test.ts` (add `describe("admin configuration", ...)` and `describe("pausing", ...)`, insert before the marker comment)

**Interfaces:**
- Consumes: `registerBooking` (Task 2), `refundOrganizer` (Task 5), `DEFAULT_ADMIN_ROLE`.
- Produces: `setPlatformFeeRecipient(address) external`; `pause() external`; `unpause() external`.

- [ ] **Step 1: Write the failing tests**

In `contracts/test/EscrowManager.test.ts`, insert before the marker comment:

```typescript
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
```

Run: `bunx hardhat test`
Expected: FAIL — `TypeError: escrow.setPlatformFeeRecipient is not a function` (and `escrow.pause is not a function`).

- [ ] **Step 2: Implement admin configuration functions**

In `contracts/contracts/EscrowManager.sol`, insert immediately above `function _authorizeUpgrade`:

```solidity
    function setPlatformFeeRecipient(address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (recipient == address(0)) {
            revert ZeroAddress();
        }
        platformFeeRecipient = recipient;
        emit PlatformFeeRecipientUpdated(recipient);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
```

Run: `bunx hardhat test`
Expected: PASS — all 22 tests.

- [ ] **Step 3: Commit**

```bash
cd contracts
git add contracts/EscrowManager.sol test/EscrowManager.test.ts
git commit -m "feat(contracts): add setPlatformFeeRecipient and pause/unpause"
```

---

### Task 7: Reentrancy protection test

**Files:**
- Create: `contracts/contracts/mocks/MaliciousReentrantERC20.sol`
- Modify: `contracts/test/EscrowManager.test.ts` (add `describe("reentrancy protection", ...)`, insert before the marker comment)

**Interfaces:**
- Consumes: `releaseToTalent` (Task 4).
- Produces: nothing new on `EscrowManager` — this task only proves the `nonReentrant` guard (and the checks-effects-interactions ordering already in `releaseToTalent`) rejects a reentrant call.

- [ ] **Step 1: Write the malicious token and the failing test**

Create `contracts/contracts/mocks/MaliciousReentrantERC20.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IReentrancyTarget {
    function releaseToTalent(bytes32 bookingId) external;
}

/// @notice Test-only ERC20 whose transfer hook re-enters
/// EscrowManager.releaseToTalent, used to prove the reentrancy guard works.
contract MaliciousReentrantERC20 is ERC20 {
    address public target;
    bytes32 public bookingId;
    bool public armed;

    constructor() ERC20("Malicious", "EVIL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address target_, bytes32 bookingId_) external {
        target = target_;
        bookingId = bookingId_;
        armed = true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (armed) {
            armed = false;
            IReentrancyTarget(target).releaseToTalent(bookingId);
        }
        return super.transfer(to, amount);
    }
}
```

In `contracts/test/EscrowManager.test.ts`, insert before the marker comment:

```typescript
  describe("reentrancy protection", () => {
    it("reverts a reentrant call into releaseToTalent triggered from the token's transfer hook", async () => {
      const { escrow, operator, organizer, talent } = await loadFixture(deployEscrowFixture);
      const id = bookingId("reentrancy-booking");

      const MaliciousToken = await ethers.getContractFactory("MaliciousReentrantERC20");
      const maliciousToken = await MaliciousToken.deploy();
      await maliciousToken.waitForDeployment();

      await escrow
        .connect(operator)
        .registerBooking(id, organizer.address, talent.address, await maliciousToken.getAddress(), 1_000_000n, 0);
      await maliciousToken.mint(organizer.address, 1_000_000n);
      await maliciousToken.connect(organizer).approve(await escrow.getAddress(), 1_000_000n);
      await escrow.connect(organizer).deposit(id);

      await maliciousToken.arm(await escrow.getAddress(), id);

      await expect(escrow.connect(organizer).releaseToTalent(id)).to.be.reverted;
    });
  });
```

Run: `bunx hardhat test`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'getContractFactory')` is not expected; instead expect a compile error until the mock file exists, then once it compiles, this specific test should already PASS (the guard was implemented in Task 4). This step's "RED" is the missing mock contract, not missing production code — run `bunx hardhat compile` first if the test run fails to find the contract factory.

- [ ] **Step 2: Compile and run**

Run: `bunx hardhat compile && bunx hardhat test`
Expected: PASS — all 23 tests. No production code changes needed; this task only adds test infrastructure that proves existing behavior.

- [ ] **Step 3: Commit**

```bash
cd contracts
git add contracts/mocks/MaliciousReentrantERC20.sol test/EscrowManager.test.ts
git commit -m "test(contracts): add reentrancy attack test"
```

---

### Task 8: Gas-sponsored meta-transaction integration test

**Files:**
- Modify: `contracts/test/EscrowManager.test.ts` (add `describe("gas-sponsored meta-transactions", ...)`, insert before the marker comment)

**Interfaces:**
- Consumes: `deposit` (Task 3), `forwarder` fixture value (Task 1), OpenZeppelin's `ERC2771Forwarder.execute(ForwardRequestData)` and `nonces(address)`.
- Produces: nothing new on `EscrowManager` — proves `_msgSender()` resolves to the real organizer (not the relayer) when a call is routed through the trusted forwarder, which is the mechanism the app's relayer (a later, separate plan) depends on.

- [ ] **Step 1: Write the failing test**

In `contracts/test/EscrowManager.test.ts`, insert before the marker comment:

```typescript
  describe("gas-sponsored meta-transactions", () => {
    it("resolves _msgSender() to the organizer when deposit is called through the trusted forwarder", async () => {
      const { escrow, forwarder, token, operator, organizer, talent, deployer } =
        await loadFixture(deployEscrowFixture);
      const id = bookingId("meta-tx-booking");

      await escrow
        .connect(operator)
        .registerBooking(id, organizer.address, talent.address, await token.getAddress(), 1_000_000n, 500);
      await token.mint(organizer.address, 1_000_000n);
      await token.connect(organizer).approve(await escrow.getAddress(), 1_000_000n);

      const network = await ethers.provider.getNetwork();
      const domain = {
        name: "HosEscrowForwarder",
        version: "1",
        chainId: network.chainId,
        verifyingContract: await forwarder.getAddress(),
      };
      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
        ],
      };

      const nonce = await forwarder.nonces(organizer.address);
      const data = escrow.interface.encodeFunctionData("deposit", [id]);
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Shared fields between the signed EIP-712 message and the on-chain
      // execute() call. `nonce` is part of the signed payload only —
      // ERC2771Forwarder's ForwardRequestData struct has no nonce field;
      // the contract reads the expected nonce from its own storage during
      // verification instead of trusting a caller-supplied value.
      const requestCore = {
        from: organizer.address,
        to: await escrow.getAddress(),
        value: 0n,
        gas: 500_000n,
        deadline,
      };

      const signature = await organizer.signTypedData(domain, types, { ...requestCore, nonce, data });

      // The relayer (here, `deployer`) submits and pays gas — never the organizer.
      await forwarder.connect(deployer).execute({ ...requestCore, data, signature });

      const record = await escrow.getEscrow(id);
      expect(record.state).to.equal(2n); // State.Funded — proves _msgSender() resolved to organizer
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(1_000_000n);
    });
  });
```

Run: `bunx hardhat test`
Expected: FAIL if the EIP-712 type/domain shape doesn't match OpenZeppelin's `ERC2771Forwarder` exactly — if so, the forwarder's `execute` call reverts with a signature-mismatch error. Confirm this by first running with a deliberately wrong `deadline` type to see the revert, then correct it.

- [ ] **Step 2: Run and verify it passes as written**

Run: `bunx hardhat test`
Expected: PASS — all 24 tests. No production code changes needed; this task proves existing `ERC2771ContextUpgradeable` wiring from Task 1 already works end-to-end through a real forwarder.

- [ ] **Step 3: Commit**

```bash
cd contracts
git add test/EscrowManager.test.ts
git commit -m "test(contracts): add gas-sponsored meta-transaction integration test"
```

---

### Task 9: Upgrade safety

**Files:**
- Create: `contracts/contracts/mocks/EscrowManagerV2Mock.sol`
- Modify: `contracts/test/EscrowManager.test.ts` (add `describe("upgradeability", ...)`, insert before the marker comment)

**Interfaces:**
- Consumes: `EscrowManager` (all prior tasks), `@openzeppelin/hardhat-upgrades`'s `upgrades.upgradeProxy`.
- Produces: `EscrowManagerV2Mock` (test-only contract, not shipped) with `VERSION() → string`, proving storage-layout-safe upgrades.

- [ ] **Step 1: Write the V2 mock and the failing tests**

Create `contracts/contracts/mocks/EscrowManagerV2Mock.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EscrowManager} from "../EscrowManager.sol";

/// @notice Test-only V2 used to prove UUPS upgrades preserve existing
/// storage and the deployed proxy address, without changing production
/// EscrowManager.sol.
contract EscrowManagerV2Mock is EscrowManager {
    string public constant VERSION = "v2";

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) EscrowManager(trustedForwarder) {}
}
```

In `contracts/test/EscrowManager.test.ts`, insert before the marker comment:

```typescript
  describe("upgradeability", () => {
    it("preserves existing escrow storage after upgrading to a new implementation", async () => {
      const { escrow, forwarder, operator, token, organizer, talent } =
        await loadFixture(deployEscrowFixture);
      const id = bookingId("upgrade-booking");

      await escrow
        .connect(operator)
        .registerBooking(id, organizer.address, talent.address, await token.getAddress(), 1_000_000n, 500);

      const EscrowManagerV2Mock = await ethers.getContractFactory("EscrowManagerV2Mock");
      const upgraded = await upgrades.upgradeProxy(await escrow.getAddress(), EscrowManagerV2Mock, {
        constructorArgs: [await forwarder.getAddress()],
        unsafeAllow: ["constructor", "state-variable-immutable"],
      });

      const record = await upgraded.getEscrow(id);
      expect(record.organizer).to.equal(organizer.address);
      expect(record.amount).to.equal(1_000_000n);
      expect(await upgraded.VERSION()).to.equal("v2");
    });

    it("reverts an upgrade attempted by a non-default-admin", async () => {
      const { escrow, forwarder, stranger } = await loadFixture(deployEscrowFixture);

      const EscrowManagerV2Mock = await ethers.getContractFactory("EscrowManagerV2Mock", stranger);
      await expect(
        upgrades.upgradeProxy(await escrow.getAddress(), EscrowManagerV2Mock, {
          constructorArgs: [await forwarder.getAddress()],
          unsafeAllow: ["constructor", "state-variable-immutable"],
        })
      ).to.be.reverted;
    });
  });
```

Run: `bunx hardhat test`
Expected: FAIL — compile error until `EscrowManagerV2Mock.sol` exists; once it compiles, run again.

- [ ] **Step 2: Compile and verify**

Run: `bunx hardhat compile && bunx hardhat test`
Expected: PASS — all 26 tests. `@openzeppelin/hardhat-upgrades` also validates storage-layout compatibility automatically during `upgradeProxy` — if a future real V2 implementation breaks layout, this call throws at test time before any deploy.

- [ ] **Step 3: Commit**

```bash
cd contracts
git add contracts/mocks/EscrowManagerV2Mock.sol test/EscrowManager.test.ts
git commit -m "test(contracts): add upgrade safety tests"
```

---

### Task 10: Deployment script

**Files:**
- Create: `contracts/scripts/deploy.ts`
- Create: `contracts/README.md`

**Interfaces:**
- Consumes: `EscrowManager` (all prior tasks), env vars `ESCROW_ADMIN_ADDRESS`, `ESCROW_OPERATOR_ADDRESS`, `ESCROW_FEE_RECIPIENT_ADDRESS`, optional `TRUSTED_FORWARDER_ADDRESS`.
- Produces: a runnable script that deploys (or reuses) an `ERC2771Forwarder` and deploys the `EscrowManager` UUPS proxy.

- [ ] **Step 1: Write the deploy script**

Create `contracts/scripts/deploy.ts`:

```typescript
import { ethers, upgrades } from "hardhat";

async function main() {
  const adminAddress = process.env.ESCROW_ADMIN_ADDRESS;
  const operatorAddress = process.env.ESCROW_OPERATOR_ADDRESS;
  const feeRecipientAddress = process.env.ESCROW_FEE_RECIPIENT_ADDRESS;

  if (!adminAddress || !operatorAddress || !feeRecipientAddress) {
    throw new Error(
      "Set ESCROW_ADMIN_ADDRESS, ESCROW_OPERATOR_ADDRESS, ESCROW_FEE_RECIPIENT_ADDRESS env vars before deploying"
    );
  }

  let forwarderAddress = process.env.TRUSTED_FORWARDER_ADDRESS;
  if (!forwarderAddress) {
    const Forwarder = await ethers.getContractFactory("ERC2771Forwarder");
    const forwarder = await Forwarder.deploy("HosEscrowForwarder");
    await forwarder.waitForDeployment();
    forwarderAddress = await forwarder.getAddress();
    console.log("Deployed new ERC2771Forwarder to:", forwarderAddress);
  } else {
    console.log("Reusing existing ERC2771Forwarder at:", forwarderAddress);
  }

  const EscrowManager = await ethers.getContractFactory("EscrowManager");
  const proxy = await upgrades.deployProxy(
    EscrowManager,
    [adminAddress, operatorAddress, feeRecipientAddress],
    {
      kind: "uups",
      constructorArgs: [forwarderAddress],
      unsafeAllow: ["constructor", "state-variable-immutable"],
    }
  );

  await proxy.waitForDeployment();
  console.log("EscrowManager proxy deployed to:", await proxy.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Create `contracts/README.md`:

```markdown
# hos-contracts

Solidity smart contracts for the Hos blockchain escrow payment feature.
See `docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md`
at the repo root for the full design.

## Setup

\`\`\`bash
cd contracts
bun install
cp .env.example .env   # fill in RPC URLs, deployer key, role addresses
\`\`\`

## Commands

- `bun run compile` — compile contracts
- `bun run test` — run the Hardhat test suite (Mocha/Chai, not `bun:test`
  — Solidity/EVM tests can't run under Bun's test runner)
- `bun run deploy:fuji` — deploy to Avalanche Fuji testnet
- `bun run deploy:mainnet` — deploy to Avalanche C-Chain mainnet

## Upgrading

To upgrade `EscrowManager` after the initial deployment, write the new
implementation contract, then call `upgrades.upgradeProxy` (see
`test/EscrowManager.test.ts`'s `upgradeability` suite for the exact call
shape) from a script run with the `DEFAULT_ADMIN_ROLE` wallet's key.
```

- [ ] **Step 2: Verify the script runs end-to-end on a local network**

Run:

```bash
cd contracts
ESCROW_ADMIN_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
ESCROW_OPERATOR_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
ESCROW_FEE_RECIPIENT_ADDRESS=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC \
bunx hardhat run scripts/deploy.ts --network hardhat
```

Expected: prints `Deployed new ERC2771Forwarder to: 0x...` followed by `EscrowManager proxy deployed to: 0x...`, exits 0.

- [ ] **Step 3: Commit**

```bash
cd contracts
git add scripts/deploy.ts README.md
git commit -m "feat(contracts): add deployment script"
```
