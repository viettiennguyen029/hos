---
name: deploying-upgrading-contracts
description: Use when deploying, redeploying, or upgrading a UUPS-upgradeable smart contract in this repo's contracts/ Hardhat subproject (e.g. EscrowManager) — includes Avalanche network config, required env vars, OpenZeppelin upgrade-safety flags, and EVM-version/reentrancy-guard/meta-tx gotchas specific to this project's setup.
---

# Deploying & Upgrading Contracts (`contracts/` Hardhat subproject)

## Overview

`contracts/` is a self-contained Hardhat + TypeScript subproject (own `package.json`, own test runner — not `bun:test`), holding `EscrowManager`, a UUPS-upgradeable escrow contract with an immutable EIP-2771 trusted forwarder. This skill covers deploying it and safely upgrading it later. Full design: `docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md`.

## Quick Reference

| Action | Command |
|---|---|
| Install | `cd contracts && bun install` |
| Compile | `bunx hardhat compile` |
| **Run full test suite** | `bun run test` — **not** bare `bunx hardhat test` (see Gotcha 4) |
| Deploy (Fuji / mainnet) | `bun run deploy:fuji` / `bun run deploy:mainnet` |
| Deploy (local smoke test) | `ESCROW_ADMIN_ADDRESS=... ESCROW_OPERATOR_ADDRESS=... ESCROW_FEE_RECIPIENT_ADDRESS=... bunx hardhat run scripts/deploy.ts --network hardhat` |

Required env vars for any deploy: `ESCROW_ADMIN_ADDRESS`, `ESCROW_OPERATOR_ADDRESS`, `ESCROW_FEE_RECIPIENT_ADDRESS`. Optional: `TRUSTED_FORWARDER_ADDRESS` (reuses an existing `ERC2771Forwarder` instead of deploying a new one — do this on every deploy after the first, so organizer/talent meta-tx signatures stay valid against one canonical forwarder). Networks: `avalancheFuji` (43113), `avalanche` (43114) — see `contracts/hardhat.config.ts`.

## Deploying

`contracts/scripts/deploy.ts` resolves config via an exported `resolveDeployConfig(env)` (throws loudly if required vars are missing — this is what makes the function unit-testable in `contracts/scripts/deploy.test.ts` without a network), then deploys/reuses the forwarder and calls `upgrades.deployProxy(EscrowManagerFactory, [admin, operator, feeRecipient], { kind: "uups", constructorArgs: [forwarderAddress], unsafeAllow: ["constructor", "state-variable-immutable"] })`.

## Upgrading

1. Write the new implementation contract. It must extend/replicate `EscrowManager`'s inheritance chain and **only append new storage variables at the end** — never reorder, retype, or remove existing ones. Its constructor must still accept `trustedForwarder`, forward it to the parent constructor, and call `_disableInitializers()` — copy the pattern in `contracts/contracts/mocks/EscrowManagerV2Mock.sol` exactly.
2. Run the upgrade from a script or console:
   ```typescript
   const NewImpl = await ethers.getContractFactory("EscrowManagerV2");
   await upgrades.upgradeProxy(proxyAddress, NewImpl, {
     constructorArgs: [forwarderAddress],
     unsafeAllow: ["constructor", "state-variable-immutable"],
   });
   ```
   The `unsafeAllow` flags are **required, not a warning to work around** — `ERC2771ContextUpgradeable`'s trusted-forwarder is deliberately an immutable set via constructor (correct: infra that shouldn't change per-proxy), and the OZ plugin flags any constructor/immutable by default.
3. Must be sent by an account holding `DEFAULT_ADMIN_ROLE` (`_authorizeUpgrade` is gated to it) — any other signer reverts.
4. `upgradeProxy` automatically validates storage-layout compatibility and throws before deploying if unsafe. Trust that check.
5. Test the upgrade the way `contracts/test/EscrowManager.test.ts`'s `upgradeability` block does: write real state through the old implementation, upgrade, assert that state survived, and assert a non-admin's upgrade attempt reverts.

## Gotchas

1. **Pin `evmVersion` explicitly** in `hardhat.config.ts`'s `solidity.settings` — don't rely on solc's implicit default. It is *not* `"paris"` as commonly assumed; solc 0.8.24's actual default tracks the latest hardfork it supports (`"cancun"`), confirmed by inspecting `artifacts/build-info/*.json`, not by trusting a log message. This project pins `"shanghai"` specifically so the reentrancy guard stays `ReentrancyGuardUpgradeable` (storage-based) rather than accidentally depending on Cancun-only transient-storage opcodes (TSTORE/TLOAD), whose support on Avalanche C-Chain isn't confirmed.
2. **Force-compile third-party contracts you deploy but don't inherit.** Hardhat only compiles files reachable via imports from `contracts/contracts/`. Deploying `@openzeppelin/contracts/metatx/ERC2771Forwarder.sol` directly (in tests/scripts) requires a forcing-import file — see `contracts/contracts/Imports.sol`.
3. **Guard standalone scripts on module identity, never on env-var presence.** A script meant to run directly *and* be imported for tests (like `deploy.ts`, which exports `resolveDeployConfig`) needs `if (require.main === module) { main()... }` around its entry point. Guarding on `if (process.env.X && ...)` instead turns "required config is missing" into a silent no-op (exit 0, no output) rather than a loud failure — a serious footgun for a script that can deploy to mainnet. (This project's `tsconfig.json` uses CommonJS, so `require.main === module` works; an ESM project needs `import.meta.url === pathToFileURL(process.argv[1]).href` instead.)
4. **A colocated test file existing isn't the same as it running.** `bunx hardhat test` (bare) only discovers `contracts/test/**` by default. A script's own sibling test (`contracts/scripts/deploy.test.ts`) must be wired into the `test` script explicitly (`contracts/package.json` runs `hardhat test && hardhat test scripts/deploy.test.ts`) or it silently never executes — even though it exists and would satisfy a naive TDD file-presence check. Always verify by checking the actual reported pass count, not the file's presence on disk.
