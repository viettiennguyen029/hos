# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` and the many `.claude/rules/*.md` files are already loaded into
your context — this file covers only what they don't: build/test commands
and cross-file architecture.

## Commands

Package manager is **bun** (never npm/yarn/pnpm). Next.js here has breaking
changes vs. training data — see `AGENTS.md` and read `node_modules/next/dist/docs/`.

| Task                       | Command                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| Dev server                 | `bun run dev` (localhost:3000)                                           |
| Build                      | `bun run build`                                                          |
| Lint                       | `bun run lint`                                                           |
| Test (all)                 | `bun run test` — **never bare `bun test`** (see AGENTS.md: mock leakage) |
| Test (one file)            | `bun test --isolate path/to/file.test.ts`                                |
| Provision platform wallets | `bun run provision-wallets`                                              |

Tests use Bun's runner with `happydom` preload (`bunfig.toml`) for DOM +
`@testing-library/react`. Test files sit beside source (`*.test.ts[x]`).
Follow RED/GREEN/REFACTOR (`.claude/rules/tdd.md`); a pre-commit hook
blocks committing a staged source file with no sibling test.

### Contracts subproject (`contracts/`)

Separate Hardhat project with its own `bun install`. Excluded from the root
tsconfig. From `contracts/`:

- `bun run compile` / `bun run test` (Mocha/Chai — **cannot** run under Bun's
  test runner)
- `bun run deploy:fuji` / `bun run deploy:mainnet`
- Upgrades: see `contracts/README.md` and the `deploying-upgrading-contracts`
  skill. The ERC2771 trusted-forwarder address is an immutable in impl
  bytecode — every upgrade MUST re-pass it via `constructorArgs`.

## Architecture

Next.js 16 App Router + React 19, Supabase (Postgres + Auth + Storage),
shadcn/radix UI, Tailwind v4. Deployed on Vercel. `@/*` → `src/*`.

### Marketplace domain

A booking marketplace with three self-service roles — **organizer**,
**talent**, **agency** (`role_type` enum, `supabase/migrations/0001_init.sql`)
— plus an **admin** surface introduced by the escrow feature (allowlist
table, not a marketplace role). Route trees mirror roles: `src/app/{organizer,
talent,agency,admin}/`. Each role layout (`src/app/<role>/layout.tsx`) calls
`getCurrentProfile()` and redirects on role mismatch, then renders `AppShell`.
`(auth)` route group holds sign-in/up/forgot-password.

Core entity flow: profiles → packages → package_bookings → (escrow) →
reviews. Also events/event-listings, quotations, schedule entries,
notifications, KYC. Migrations in `supabase/migrations/` are the
authoritative schema — `.claude/rules/domain-model.md` is an unfilled
placeholder; read migrations, not it.

### Data access layer (`src/lib/supabase/`)

- `client.ts` — browser client; `server.ts` — RSC/server-action client
  (cookie-based, anon key, RLS-enforced); `service.ts` — `createServiceClient()`
  service-role client that **bypasses RLS** (use only where explicitly
  required, e.g. wallet provisioning, cron indexer).
- `proxy.ts` + root `src/proxy.ts` — session refresh middleware.
- `*-actions.ts` files are `"use server"` server actions; non-`-actions`
  files are query helpers. Types in `types.ts`.

### Blockchain escrow (`src/lib/chain/`, `src/lib/wallet/`, `contracts/`)

Full design: `docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md`.
Only **Prepaid** packages use escrow; Postpaid keeps the old
`payment_status` honor-system flag.

- **`EscrowManager`** (UUPS proxy, Avalanche C-Chain) — per-booking
  register/deposit/release/refund state machine holding USDT/USDC. bookingId
  = Supabase UUID's 16 bytes right-padded to bytes32 (`escrow-config.ts`).
- **Custodial wallets** (`src/lib/wallet/`) — keypair per user, private key
  AES-256-GCM encrypted at rest behind `KeyEncryptionProvider` interface
  (`key-provider.ts`; `app-level-key-provider.ts` reads `WALLET_MASTER_KEY`
  — the system's highest-value secret, see `.claude/rules/env-secrets.md`).
  Swappable for Cloud KMS later. Provisioned on sign-up via
  `provisionWalletForUser` in `actions.ts`.
- **Gas sponsorship** — EIP-2771 meta-tx via `ERC2771Forwarder`; a
  platform relayer wallet pays all AVAX gas. Users never hold gas or sign
  in a wallet app. See `src/lib/chain/{forwarder,relayer,sign-forward-request,
sign-permit}.ts`.
- **Event sync** — `escrow-indexer.ts` polls chain events into Supabase;
  driven by the `poll-escrow-events` cron. Cursor seeded at contract
  deploy block (`supabase/migrations/20260811150000_seed_indexer_cursor.sql`).

### Cron (`src/app/api/cron/`)

Vercel cron (`vercel.json`): `poll-escrow-events` (every 5 min),
`check-relayer-balance` (hourly). Both gated by `CRON_SECRET`.

## Environment

`.env` is gitignored and ephemeral; `.env.example` lists all keys
(Supabase URL/anon/service-role, `WALLET_MASTER_KEY`, `AVALANCHE_RPC_URL`,
`AVALANCHE_NETWORK`, `FORWARDER_ADDRESS`, `ESCROW_MANAGER_ADDRESS`,
`SETTLEMENT_TOKEN_ADDRESS`, `SETTLEMENT_TOKEN_PERMIT_VERSION`,
`CRON_SECRET`, `VND_PER_USDT`). Config getters in `escrow-config.ts` throw
on missing values — no silent defaults (`.claude/rules/no-fallbacks.md`).
