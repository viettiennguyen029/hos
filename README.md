# HOS — Heart of Show

A booking marketplace for live entertainment, where organizers hire talent and
agencies for events, and **Prepaid bookings are settled through an on-chain
escrow** instead of an honor-system bank transfer. Funds are locked in a smart
contract from deposit until the show resolves, and users never touch a wallet
app, hold gas, or manage keys — the platform custodies wallets and sponsors
every transaction fee.

> Built for the hackathon bootcamp.

## What it does

Three self-service roles, each with its own route tree and dashboard:

| Role | Does |
| --- | --- |
| **Organizer** | Posts events, discovers talent, books packages, deposits & releases escrow |
| **Talent** | Publishes packages, manages schedule/availability, gets paid on show completion |
| **Agency** | Represents multiple talents, same booking surface as talent |

Plus an **admin** surface (allowlist-based, not a marketplace role) for dispute
resolution and per-talent commission-rate management.

Core entity flow: `profiles → packages → package_bookings → (escrow) → reviews`,
alongside events/event-listings, quotations, schedule entries, notifications and
KYC.

## Blockchain escrow

Only **Prepaid** packages use escrow; Postpaid keeps the legacy `payment_status`
flag.

- **`EscrowManager`** — UUPS-upgradeable contract on Avalanche C-Chain. A
  per-booking register → deposit → release / refund state machine holding
  USDC/USDT. `bookingId` is the Supabase booking UUID's 16 bytes right-padded to
  `bytes32`.
- **Custodial wallets** — one keypair per user, private key AES-256-GCM
  encrypted at rest behind a `KeyEncryptionProvider` interface (swappable for
  Cloud KMS later). Provisioned automatically on sign-up. Users can export their
  key.
- **Gas sponsorship** — EIP-2771 meta-transactions via `ERC2771Forwarder`; a
  platform relayer wallet pays all AVAX gas.
- **Event sync** — a polling indexer (`escrow-indexer.ts`) mirrors on-chain
  events into Supabase, driven by a Vercel cron every 5 minutes.

Lifecycle wiring: booking confirmed → escrow registered → organizer deposits →
dual-confirmation Mark Complete → release. Cancelling a funded booking routes to
the admin dispute queue (never auto-refunded).

Full design: [`docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md`](docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md).

## Tech stack

- **Next.js 16** (App Router) + **React 19**, Tailwind v4, shadcn / Radix UI
- **Supabase** — Postgres + Auth + Storage, RLS-enforced
- **viem** for chain access; **Hardhat** for contracts (`contracts/` subproject)
- **Avalanche** (Fuji testnet by default), deployed on **Vercel**
- Package manager: **bun** (not npm/yarn/pnpm)
- Tests: Bun's test runner with a happy-dom preload

## Getting started

```bash
bun install
cp .env.example .env   # then fill in the blanks (see below)
bun run dev            # http://localhost:3000
```

### Environment

`.env` is gitignored. `.env.example` lists every key. You'll need:

- Supabase URL / anon key / service-role key
- `WALLET_MASTER_KEY` — base64 of exactly 32 bytes (`openssl rand -base64 32`)
- `AVALANCHE_RPC_URL`, `AVALANCHE_NETWORK`, `FORWARDER_ADDRESS`,
  `ESCROW_MANAGER_ADDRESS`, `SETTLEMENT_TOKEN_ADDRESS`,
  `SETTLEMENT_TOKEN_PERMIT_VERSION`
- `CRON_SECRET`, `VND_PER_USDT`

Config getters in `escrow-config.ts` throw on any missing value — no silent
defaults.

## Commands

| Task | Command |
| --- | --- |
| Dev server | `bun run dev` |
| Build | `bun run build` |
| Lint | `bun run lint` |
| Test (all) | `bun run test` |
| Test (one file) | `bun test --isolate path/to/file.test.ts` |
| Provision platform wallets | `bun run provision-wallets` |

### Contracts (`contracts/`)

Separate Hardhat project with its own `bun install`. From `contracts/`:

```bash
bun run compile
bun run test            # Mocha/Chai — cannot run under Bun's test runner
bun run deploy:fuji
```

## Project structure

```
src/
  app/{organizer,talent,agency,admin}/   role route trees
  app/(auth)/                            sign-in / sign-up / forgot-password
  app/api/cron/                          poll-escrow-events, check-relayer-balance
  lib/supabase/                          data access layer (client/server/service)
  lib/chain/                             escrow contract calls, relayer, indexer
  lib/wallet/                            custodial keypair + encryption
supabase/migrations/                     authoritative schema
contracts/                               Hardhat: EscrowManager.sol
```
