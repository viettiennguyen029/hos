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

**Trusted forwarder address is immutable — every upgrade MUST pass it
again.** The ERC2771 trusted-forwarder address is set via the
implementation contract's constructor and stored as an `immutable` in the
implementation's own bytecode, not in proxy storage. `upgrades.upgradeProxy`
deploys a brand-new implementation contract, so its constructor runs again
— you MUST pass the exact same forwarder address via `constructorArgs` on
every future upgrade (see the `Deployed Addresses` table below for the
value to copy). If you deploy a new implementation with a different (or
missing) forwarder address, `_msgSender()` will silently resolve to the
relayer instead of the real user for any meta-transaction call, and every
sponsored `deposit` will start reverting with `NotAuthorizedForBooking` in
production.

## Deployed Addresses

Fill in immediately after each deploy so future upgrades can copy the
exact forwarder address.

| Network | Forwarder Address | Proxy Address |
| --- | --- | --- |
| Avalanche Fuji (testnet) | `<fill in after first deploy>` | `<fill in after first deploy>` |
| Avalanche C-Chain (mainnet) | `<fill in after first deploy>` | `<fill in after first deploy>` |
