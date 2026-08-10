# hos-contracts

Solidity smart contracts for the Hos blockchain escrow payment feature.
See `docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md`
at the repo root for the full design.

## Setup

```bash
cd contracts
bun install
cp .env.example .env   # fill in RPC URLs, deployer key, role addresses
```

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
