# App / DB Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the three already-built subsystems (`EscrowManager` contract, custodial wallet service, gas-sponsorship relayer) into the real booking flow — the fourth and final subsystem of the blockchain escrow payment feature — plus the new Fiat/Crypto payment-channel choice at checkout, and the admin surface needed to resolve a cancelled-after-funding crypto booking.

**Architecture:** `package_bookings` gains a `payment_channel` (`'fiat' | 'crypto'`), `escrow_booking_id`, `escrow_state`, and `commission_bps_snapshot`. Checkout now always creates `Prepaid` bookings, choosing Fiat or Crypto for *how*. When a crypto-channel booking is confirmed, the operator wallet registers it on-chain directly (no relay needed — operator calls are trusted platform actions). The organizer deposits via a relayed meta-transaction; a polling indexer reads `EscrowManager` events and is the sole writer of `escrow_state` (never the submitting call's return value). The dual-confirmation Mark Complete flow triggers a relayed release. Cancelling a funded crypto booking does not auto-refund — it becomes visible in a new internal admin surface (gated by an `admin_users` allowlist, not a marketplace `role_type`) where an admin calls `releaseToTalent`/`refundOrganizer` directly.

**Tech Stack:** `viem` (already a dependency), the compiled `EscrowManager` ABI (generated from `contracts/artifacts/`, not hand-transcribed), the wallet custody and relayer subsystems already built and merged-ready on this branch.

## Global Constraints

- Escrow only ever applies to `payment_method = 'Prepaid'` bookings. Going forward, checkout no longer offers `Postpaid` at all (per explicit product decision) — every new booking is `Prepaid`, and `payment_channel` (`'fiat' | 'crypto'`) says how. Existing `Postpaid` bookings, and old `Prepaid` bookings from before this feature, have `payment_channel = null` and are untouched by everything in this plan.
- `escrow_state`, `escrow_booking_id`, `commission_bps_snapshot`, and `payment_channel` on `package_bookings` may only be written by the service-role client (registration/indexer flows), never by an organizer's or talent's own RLS-scoped session — enforced by a database trigger (matching the existing role-change guard pattern in `supabase/migrations/0002_fix_rls_and_role_guard.sql`), not just application-code discipline.
- `escrow_state` is written **only** by the polling indexer, reading real on-chain events — never optimistically set by the code that submits a transaction. A submitted call returning a tx hash means "pending," not "done."
- `bookingId` on-chain is a `bytes32` derived from the Supabase booking UUID's 16 bytes, right-padded — matching the scheme already documented in the contract plan.
- **Explicit, acknowledged simplification (extends the already-agreed "fiat on/off-ramp is out of scope" boundary from the original design):** converting a booking's VND price into a settlement-token amount uses a fixed `VND_PER_USDT` env var, not a real exchange-rate service. This is a placeholder, documented as such in code, not a gap to silently work around later.
- Operator/admin actions (`registerBooking`, admin's `refundOrganizer`/`releaseToTalent`) are called **directly** by the operator/admin platform wallets — never relayed. Only organizer-signed actions (`deposit`, organizer-initiated `releaseToTalent`) go through `relayAsUser`.
- Cancelling a booking never blocks on escrow state — `rejectBooking` still always succeeds. A cancelled *and* on-chain-funded crypto booking simply becomes visible in the new admin dispute queue; nothing auto-refunds.
- Wallet auto-provisioning (`provisionWalletForUser`) at registration time must be idempotent-safe to call even if a wallet already exists from signup (it already is, per the wallet custody plan).
- Every function needing a `KeyEncryptionProvider` or viem client takes it as an optional injected parameter defaulting to the production singleton — no `mock.module` needed. Test mocks for Supabase `.eq()` chains record and assert on call arguments, per the pattern corrected during the wallet and relayer plans' final reviews.
- TDD: every task starts with a failing test (RED) before implementation (GREEN), per `.claude/rules/tdd.md`.
- No live database connection or deployed contract exists in this environment for most of this plan's verification — code-level tasks are verified by mocked/injected tests, matching the pattern established in the wallet custody and relayer plans. The migration (Task 1) *can* be verified against the real dev Supabase project, since that connection was established and is known-working from this session's wallet-migration deployment.
- Full design context: `docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md` (App integration section) — this plan supersedes that section's original "Postpaid untouched, Prepaid escrow-only" framing with the Fiat/Crypto split described above.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260811130000_escrow_booking_integration.sql`

**Interfaces:**
- Produces: `package_bookings.payment_channel/escrow_booking_id/escrow_state/commission_bps_snapshot`; `profiles.commission_bps`; `public.escrow_events` table; `public.escrow_indexer_state` singleton table; `public.admin_users` table.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260811130000_escrow_booking_integration.sql`:

```sql
-- Links package_bookings to on-chain escrow state (blockchain escrow
-- payment feature, subsystem 4). payment_channel distinguishes the new
-- Fiat/Crypto choice at checkout from the existing Prepaid/Postpaid
-- payment_method -- checkout only ever creates 'Prepaid' bookings now,
-- and payment_channel says how that prepayment happens. Existing
-- Postpaid bookings (and old Prepaid ones from before this feature) have
-- payment_channel = null, which is fine: nothing in this feature ever
-- runs for them.
alter table public.package_bookings
  add column payment_channel text check (payment_channel in ('fiat', 'crypto')),
  add column escrow_booking_id text,
  add column escrow_state text not null default 'none'
    check (escrow_state in ('none', 'registered', 'funded', 'released', 'refunded')),
  add column commission_bps_snapshot integer;

create unique index package_bookings_escrow_booking_id_key
  on public.package_bookings (escrow_booking_id)
  where escrow_booking_id is not null;

alter table public.profiles
  add column commission_bps integer not null default 1000
    check (commission_bps between 0 and 10000);

-- Escrow fields are set exclusively by server-side flows (the
-- registerBooking trigger, the event indexer) using the service-role
-- client -- never directly by an organizer/talent's own RLS-scoped
-- session, even though existing policies already let them update other
-- columns on their own bookings. Same guard pattern as the role-change
-- guard in 0002_fix_rls_and_role_guard.sql.
create or replace function public.guard_escrow_fields()
returns trigger as $$
begin
  if (new.escrow_state is distinct from old.escrow_state
      or new.escrow_booking_id is distinct from old.escrow_booking_id
      or new.commission_bps_snapshot is distinct from old.commission_bps_snapshot
      or new.payment_channel is distinct from old.payment_channel)
     and current_setting('role', true) <> 'service_role' then
    raise exception 'escrow fields can only be modified by the service role';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger guard_escrow_fields_trigger
  before update on public.package_bookings
  for each row execute function public.guard_escrow_fields();

-- On-chain event audit trail, populated by the polling indexer.
create table public.escrow_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.package_bookings (id) on delete cascade,
  event_type text not null check (event_type in ('registered', 'deposited', 'released', 'refunded')),
  tx_hash text not null,
  block_number bigint not null,
  created_at timestamptz not null default now()
);

create index escrow_events_booking_id_idx on public.escrow_events (booking_id);
alter table public.escrow_events enable row level security;
-- Deliberately no policies -- service-role only, same reasoning as
-- public.wallets.

-- Singleton row tracking the indexer's polling cursor.
create table public.escrow_indexer_state (
  id boolean primary key default true,
  last_processed_block bigint not null default 0,
  constraint escrow_indexer_state_singleton check (id)
);
insert into public.escrow_indexer_state (id, last_processed_block) values (true, 0);
alter table public.escrow_indexer_state enable row level security;
-- Service-role only.

-- Internal ops allowlist -- NOT a public.role_type value, since admin is
-- an internal concept, not a marketplace-facing role (see design spec).
create table public.admin_users (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- Service-role only for writes; a user may check their OWN membership
-- (needed to gate the admin UI), nothing else.
create policy "Users can check their own admin membership"
  on public.admin_users for select
  to authenticated
  using ((select auth.uid()) = user_id);
```

- [ ] **Step 2: Review against conventions and apply**

Compare against `supabase/migrations/0002_fix_rls_and_role_guard.sql` (guard-trigger pattern) and `supabase/migrations/20260811080000_wallets.sql` (service-role-only table pattern, singleton-row pattern isn't precedented there but is a standard, simple technique). Confirm the migration's timestamp sorts after `20260811080000_wallets.sql`.

If a live connection to the dev Supabase project is available (per this session's established connection via `bunx supabase db push --db-url "postgresql://postgres.cqnrunwprjjrdzxntpol:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"` — ask the controller for the current password if not provided), run `bunx supabase db push --db-url "..." --dry-run` first to confirm only this one migration is pending (the controller already reconciled all prior drift in this session), then apply for real and verify the new tables/columns exist via `bunx supabase db query --db-url "..." "select column_name from information_schema.columns where table_name='package_bookings' and column_name in ('payment_channel','escrow_booking_id','escrow_state','commission_bps_snapshot');"`. If no live connection is available in your environment, verify by review only and note that in your report.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260811130000_escrow_booking_integration.sql
git commit -m "feat(db): link package_bookings to on-chain escrow state, add admin_users"
```

---

### Task 2: EscrowManager ABI (generated) + minimal ERC20 ABI

**Files:**
- Create: `scripts/generate-escrow-abi.ts`
- Create: `src/lib/chain/abi/escrow-manager.ts` (generated by running the script — not hand-written)
- Create: `src/lib/chain/abi/erc20.ts`

**Interfaces:**
- Produces: `escrowManagerAbi` (the real compiled ABI), `erc20Abi` (minimal: `allowance`, `approve`).
- Consumes: `contracts/artifacts/contracts/EscrowManager.sol/EscrowManager.json` (requires `contracts/` to already be compiled — it is, from the contract plan's own task execution).

This task has no test file: it's codegen tooling living under the repo-root `scripts/` path this repo's TDD hook already skips, mirroring `scripts/provision-platform-wallets.ts` from the wallet custody plan.

- [ ] **Step 1: Write the codegen script**

Create `scripts/generate-escrow-abi.ts`:

```typescript
import { writeFileSync } from "node:fs";

async function main() {
  const artifactModule = await import(
    "../contracts/artifacts/contracts/EscrowManager.sol/EscrowManager.json",
    { with: { type: "json" } }
  );
  const abi = (artifactModule.default as { abi: unknown }).abi;

  const output = `// Generated by scripts/generate-escrow-abi.ts from
// contracts/artifacts/contracts/EscrowManager.sol/EscrowManager.json --
// do not edit by hand. Re-run after any EscrowManager.sol change
// (requires contracts/ to be compiled first: cd contracts && bunx hardhat compile).
export const escrowManagerAbi = ${JSON.stringify(abi, null, 2)} as const;
`;

  writeFileSync("src/lib/chain/abi/escrow-manager.ts", output);
  console.log("Wrote src/lib/chain/abi/escrow-manager.ts");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 2: Run it to generate the committed ABI file**

Run: `bun scripts/generate-escrow-abi.ts`
Expected: prints `Wrote src/lib/chain/abi/escrow-manager.ts`, and that file now exists with a real `escrowManagerAbi` constant (roughly 59 ABI entries — functions, events, and errors from `EscrowManager.sol`).

If `contracts/artifacts/contracts/EscrowManager.sol/EscrowManager.json` doesn't exist in your environment, run `cd contracts && bunx hardhat compile` first, then retry.

- [ ] **Step 3: Write the minimal ERC20 ABI**

Create `src/lib/chain/abi/erc20.ts`:

```typescript
/** Minimal standard ERC20 ABI slice -- only what this app calls (checking and setting the EscrowManager's spending allowance before a deposit). */
export const erc20Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
```

- [ ] **Step 4: Verify and commit**

Run: `bunx tsc --noEmit`
Expected: no errors referencing `src/lib/chain/abi/`.

```bash
git add scripts/generate-escrow-abi.ts src/lib/chain/abi/escrow-manager.ts src/lib/chain/abi/erc20.ts
git commit -m "feat(chain): generate EscrowManager ABI, add minimal ERC20 ABI"
```

---

### Task 3: Escrow config helpers

**Files:**
- Create: `src/lib/chain/escrow-config.ts`
- Test: `src/lib/chain/escrow-config.test.ts`

**Interfaces:**
- Produces: `getEscrowManagerAddress(): \`0x${string}\``, `getSettlementTokenAddress(): \`0x${string}\``, `bookingIdToBytes32(bookingUuid: string): \`0x${string}\``, `vndToTokenAmount(priceVnd: number): bigint`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/chain/escrow-config.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "bun:test";
import {
  bookingIdToBytes32,
  getEscrowManagerAddress,
  getSettlementTokenAddress,
  vndToTokenAmount,
} from "@/lib/chain/escrow-config";

afterEach(() => {
  delete process.env.ESCROW_MANAGER_ADDRESS;
  delete process.env.SETTLEMENT_TOKEN_ADDRESS;
  delete process.env.VND_PER_USDT;
});

describe("getEscrowManagerAddress", () => {
  it("throws when ESCROW_MANAGER_ADDRESS is not set", () => {
    delete process.env.ESCROW_MANAGER_ADDRESS;
    expect(() => getEscrowManagerAddress()).toThrow(/ESCROW_MANAGER_ADDRESS/);
  });

  it("throws when ESCROW_MANAGER_ADDRESS is not a valid address", () => {
    process.env.ESCROW_MANAGER_ADDRESS = "not-an-address";
    expect(() => getEscrowManagerAddress()).toThrow(/not a valid address/);
  });

  it("returns a valid configured address", () => {
    process.env.ESCROW_MANAGER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    expect(getEscrowManagerAddress()).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  });
});

describe("getSettlementTokenAddress", () => {
  it("throws when SETTLEMENT_TOKEN_ADDRESS is not set", () => {
    delete process.env.SETTLEMENT_TOKEN_ADDRESS;
    expect(() => getSettlementTokenAddress()).toThrow(/SETTLEMENT_TOKEN_ADDRESS/);
  });

  it("throws when SETTLEMENT_TOKEN_ADDRESS is not a valid address", () => {
    process.env.SETTLEMENT_TOKEN_ADDRESS = "not-an-address";
    expect(() => getSettlementTokenAddress()).toThrow(/not a valid address/);
  });

  it("returns a valid configured address", () => {
    process.env.SETTLEMENT_TOKEN_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    expect(getSettlementTokenAddress()).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  });
});

describe("bookingIdToBytes32", () => {
  it("right-pads a UUID's 16 bytes into a bytes32 hex string", () => {
    const result = bookingIdToBytes32("11111111-2222-3333-4444-555555555555");
    expect(result).toBe("0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66));
  });

  it("throws for a malformed UUID", () => {
    expect(() => bookingIdToBytes32("not-a-uuid")).toThrow(/not a valid UUID/);
  });
});

describe("vndToTokenAmount", () => {
  it("converts a VND price into smallest-unit token amount using VND_PER_USDT", () => {
    process.env.VND_PER_USDT = "25000";
    // 2,500,000 VND / 25,000 VND-per-USDT = 100 USDT = 100_000000 (6 decimals)
    expect(vndToTokenAmount(2_500_000)).toBe(100_000000n);
  });

  it("throws when VND_PER_USDT is not set", () => {
    delete process.env.VND_PER_USDT;
    expect(() => vndToTokenAmount(1000)).toThrow(/VND_PER_USDT/);
  });
});
```

Run: `bun test src/lib/chain/escrow-config.test.ts`
Expected: FAIL — `Cannot find module '@/lib/chain/escrow-config'`.

- [ ] **Step 2: Implement `escrow-config.ts`**

Create `src/lib/chain/escrow-config.ts`:

```typescript
import { isAddress } from "viem";

const SETTLEMENT_TOKEN_DECIMALS = 6;

export function getEscrowManagerAddress(): `0x${string}` {
  const address = process.env.ESCROW_MANAGER_ADDRESS;
  if (!address) throw new Error("ESCROW_MANAGER_ADDRESS is not set");
  if (!isAddress(address)) throw new Error(`ESCROW_MANAGER_ADDRESS "${address}" is not a valid address`);
  return address;
}

export function getSettlementTokenAddress(): `0x${string}` {
  const address = process.env.SETTLEMENT_TOKEN_ADDRESS;
  if (!address) throw new Error("SETTLEMENT_TOKEN_ADDRESS is not set");
  if (!isAddress(address)) throw new Error(`SETTLEMENT_TOKEN_ADDRESS "${address}" is not a valid address`);
  return address;
}

/**
 * Converts a Supabase booking UUID into the bytes32 key EscrowManager
 * uses, matching the scheme documented in the contract plan: the UUID's
 * 16 bytes right-padded into bytes32.
 */
export function bookingIdToBytes32(bookingUuid: string): `0x${string}` {
  const hex = bookingUuid.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw new Error(`bookingUuid "${bookingUuid}" is not a valid UUID`);
  }
  return `0x${hex.padEnd(64, "0")}` as `0x${string}`;
}

/**
 * Converts a VND price into the settlement token's smallest-unit amount,
 * using a fixed VND_PER_USDT env var. This is an explicit, acknowledged
 * placeholder for a real exchange-rate service -- see this plan's design
 * doc. Do not treat this as a bug to silently work around; it's a known,
 * documented simplification for this phase.
 */
export function vndToTokenAmount(priceVnd: number): bigint {
  const rateRaw = process.env.VND_PER_USDT;
  if (!rateRaw) throw new Error("VND_PER_USDT is not set");
  const rate = Number(rateRaw);
  const tokenAmount = priceVnd / rate;
  return BigInt(Math.round(tokenAmount * 10 ** SETTLEMENT_TOKEN_DECIMALS));
}
```

Run: `bun test src/lib/chain/escrow-config.test.ts`
Expected: PASS — all 9 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chain/escrow-config.ts src/lib/chain/escrow-config.test.ts
git commit -m "feat(chain): add escrow address config, bookingId, and VND conversion helpers"
```

---

### Task 4: `registerEscrowBooking` (operator direct call)

**Files:**
- Create: `src/lib/chain/escrow.ts`
- Test: `src/lib/chain/escrow.test.ts`

**Interfaces:**
- Consumes: `escrowManagerAbi` (Task 2), `getEscrowManagerAddress` (Task 3), `getPublicClient`/`getWalletClient` (relayer plan), `getSigningAccountForPlatformWallet` (relayer plan), `getKeyProvider` (wallet custody plan).
- Produces: `registerEscrowBooking(supabase, params, deps?): Promise<\`0x${string}\`>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/chain/escrow.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { registerEscrowBooking } from "@/lib/chain/escrow";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const OPERATOR_PRIVATE_KEY = generatePrivateKey();
const OPERATOR_ADDRESS = privateKeyToAccount(OPERATOR_PRIVATE_KEY).address;
const ESCROW_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const ORGANIZER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const TALENT_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as const;
const TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa" as const;

const testKeyProvider: KeyEncryptionProvider = {
  encrypt: async (plaintext) => ({ iv: "iv", authTag: "tag", ciphertext: plaintext, keyVersion: 1 }),
  decrypt: async (payload) => payload.ciphertext,
};

function makeSupabase() {
  const eqCalls: [string, unknown][] = [];
  const client = {
    from: (table: string) => {
      if (table !== "wallets") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (col: string, val: unknown) => {
            eqCalls.push([col, val]);
            return {
              eq: (col2: string, val2: unknown) => {
                eqCalls.push([col2, val2]);
                return {
                  maybeSingle: async () => ({
                    data: { encrypted_private_key: { ciphertext: OPERATOR_PRIVATE_KEY } },
                    error: null,
                  }),
                };
              },
            };
          },
        }),
      };
    },
  };
  return { client: client as unknown as SupabaseClient, eqCalls };
}

describe("registerEscrowBooking", () => {
  it("submits registerBooking signed by the operator wallet", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const { client, eqCalls } = makeSupabase();

    let writeContractArgs: unknown;
    let signerAddress: string | undefined;
    const walletClientFactory = (account: { address: `0x${string}` }) => {
      signerAddress = account.address;
      return {
        writeContract: async (args: unknown) => {
          writeContractArgs = args;
          return "0xtxhash" as const;
        },
      };
    };

    const txHash = await registerEscrowBooking(
      client,
      {
        bookingId: "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`,
        organizerAddress: ORGANIZER_ADDRESS,
        talentAddress: TALENT_ADDRESS,
        tokenAddress: TOKEN_ADDRESS,
        amount: 100_000000n,
        feeBps: 500,
      },
      {
        walletClientFactory: walletClientFactory as never,
        keyProvider: testKeyProvider,
      }
    );

    expect(txHash).toBe("0xtxhash");
    expect(signerAddress).toBe(OPERATOR_ADDRESS);
    expect(eqCalls).toEqual([
      ["label", "operator"],
      ["chain", "avalanche"],
    ]);

    const args = writeContractArgs as { functionName: string; args: unknown[] };
    expect(args.functionName).toBe("registerBooking");
    expect(args.args).toEqual([
      "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66),
      ORGANIZER_ADDRESS,
      TALENT_ADDRESS,
      TOKEN_ADDRESS,
      100_000000n,
      500,
    ]);

    delete process.env.ESCROW_MANAGER_ADDRESS;
  });
});
```

Run: `bun test src/lib/chain/escrow.test.ts`
Expected: FAIL — `Cannot find module '@/lib/chain/escrow'`.

- [ ] **Step 2: Implement `registerEscrowBooking`**

Create `src/lib/chain/escrow.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalAccount, WalletClient } from "viem";
import { getWalletClient } from "@/lib/chain/clients";
import { escrowManagerAbi } from "@/lib/chain/abi/escrow-manager";
import { getEscrowManagerAddress } from "@/lib/chain/escrow-config";
import { getSigningAccountForPlatformWallet } from "@/lib/wallet/signing-account";
import { getKeyProvider } from "@/lib/wallet/app-level-key-provider";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

interface DirectCallDeps {
  walletClientFactory?: (account: LocalAccount) => WalletClient;
  keyProvider?: KeyEncryptionProvider;
}

export async function registerEscrowBooking(
  supabase: SupabaseClient,
  params: {
    bookingId: `0x${string}`;
    organizerAddress: `0x${string}`;
    talentAddress: `0x${string}`;
    tokenAddress: `0x${string}`;
    amount: bigint;
    feeBps: number;
  },
  deps: DirectCallDeps = {}
): Promise<`0x${string}`> {
  const walletClientFactory = deps.walletClientFactory ?? getWalletClient;
  const keyProvider = deps.keyProvider ?? getKeyProvider();
  const operatorAccount = await getSigningAccountForPlatformWallet(supabase, "operator", keyProvider);
  const client = walletClientFactory(operatorAccount);

  return client.writeContract({
    address: getEscrowManagerAddress(),
    abi: escrowManagerAbi,
    functionName: "registerBooking",
    args: [params.bookingId, params.organizerAddress, params.talentAddress, params.tokenAddress, params.amount, params.feeBps],
    account: operatorAccount,
    chain: null,
  }) as Promise<`0x${string}`>;
}
```

Run: `bun test src/lib/chain/escrow.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chain/escrow.ts src/lib/chain/escrow.test.ts
git commit -m "feat(chain): add registerEscrowBooking operator direct call"
```

---

### Task 5: `depositEscrow` (organizer relayed: approve-if-needed + deposit)

**Files:**
- Modify: `src/lib/chain/escrow.ts`
- Modify: `src/lib/chain/escrow.test.ts`

**Interfaces:**
- Consumes: `relayAsUser` (relayer plan), `erc20Abi` (Task 2), `escrowManagerAbi` (Task 2), `getPublicClient` (relayer plan).
- Produces: `depositEscrow(supabase, userId, params, deps?): Promise<{approveTxHash: \`0x${string}\` | null, depositTxHash: \`0x${string}\`}>`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/chain/escrow.test.ts`, add:

```typescript
import { relayAsUser } from "@/lib/chain/relayer";

// ... (keep existing imports/constants/describe block above)

describe("depositEscrow", () => {
  it("relays an approve then a deposit when allowance is insufficient", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const relayCalls: { to: string; data: string }[] = [];
    const relayAsUserFake = async (
      _supabase: SupabaseClient,
      _userId: string,
      to: `0x${string}`,
      data: `0x${string}`
    ) => {
      relayCalls.push({ to, data });
      return `0xtx${relayCalls.length}` as `0x${string}`;
    };

    const publicClient = {
      readContract: async () => 0n, // allowance
    };

    const { depositEscrow } = await import("@/lib/chain/escrow");
    const result = await depositEscrow(
      { from: () => ({}) } as never,
      "user-1",
      {
        bookingId: "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`,
        tokenAddress: TOKEN_ADDRESS,
        organizerAddress: ORGANIZER_ADDRESS,
        amount: 100_000000n,
      },
      { relayAsUser: relayAsUserFake as never, publicClient: publicClient as never }
    );

    expect(relayCalls).toHaveLength(2);
    expect(relayCalls[0]?.to).toBe(TOKEN_ADDRESS);
    expect(relayCalls[1]?.to).toBe(ESCROW_ADDRESS);
    expect(result.approveTxHash).toBe("0xtx1");
    expect(result.depositTxHash).toBe("0xtx2");

    delete process.env.ESCROW_MANAGER_ADDRESS;
  });

  it("skips the approve when allowance is already sufficient", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const relayCalls: { to: string }[] = [];
    const relayAsUserFake = async (_supabase: SupabaseClient, _userId: string, to: `0x${string}`) => {
      relayCalls.push({ to });
      return `0xtx${relayCalls.length}` as `0x${string}`;
    };
    const publicClient = { readContract: async () => 100_000000n };

    const { depositEscrow } = await import("@/lib/chain/escrow");
    const result = await depositEscrow(
      {} as never,
      "user-1",
      {
        bookingId: "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`,
        tokenAddress: TOKEN_ADDRESS,
        organizerAddress: ORGANIZER_ADDRESS,
        amount: 100_000000n,
      },
      { relayAsUser: relayAsUserFake as never, publicClient: publicClient as never }
    );

    expect(relayCalls).toHaveLength(1);
    expect(relayCalls[0]?.to).toBe(ESCROW_ADDRESS);
    expect(result.approveTxHash).toBeNull();
    expect(result.depositTxHash).toBe("0xtx1");

    delete process.env.ESCROW_MANAGER_ADDRESS;
  });
});
```

Run: `bun test src/lib/chain/escrow.test.ts`
Expected: FAIL — `depositEscrow is not exported` / `Cannot find module`.

- [ ] **Step 2: Implement `depositEscrow`**

In `src/lib/chain/escrow.ts`, add near the top:

```typescript
import { encodeFunctionData } from "viem";
import { erc20Abi } from "@/lib/chain/abi/erc20";
import { getPublicClient } from "@/lib/chain/clients";
import { relayAsUser as relayAsUserDefault } from "@/lib/chain/relayer";
```

Append at the end of the file:

```typescript
interface RelayedCallDeps {
  relayAsUser?: typeof relayAsUserDefault;
  publicClient?: Pick<ReturnType<typeof getPublicClient>, "readContract">;
}

export async function depositEscrow(
  supabase: SupabaseClient,
  userId: string,
  params: { bookingId: `0x${string}`; tokenAddress: `0x${string}`; organizerAddress: `0x${string}`; amount: bigint },
  deps: RelayedCallDeps = {}
): Promise<{ approveTxHash: `0x${string}` | null; depositTxHash: `0x${string}` }> {
  const relay = deps.relayAsUser ?? relayAsUserDefault;
  const publicClient = deps.publicClient ?? getPublicClient();
  const escrowAddress = getEscrowManagerAddress();

  const allowance = (await publicClient.readContract({
    address: params.tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [params.organizerAddress, escrowAddress],
  })) as bigint;

  let approveTxHash: `0x${string}` | null = null;
  if (allowance < params.amount) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [escrowAddress, params.amount],
    });
    approveTxHash = await relay(supabase, userId, params.tokenAddress, approveData);
  }

  const depositData = encodeFunctionData({
    abi: escrowManagerAbi,
    functionName: "deposit",
    args: [params.bookingId],
  });
  const depositTxHash = await relay(supabase, userId, escrowAddress, depositData);

  return { approveTxHash, depositTxHash };
}
```

Run: `bun test src/lib/chain/escrow.test.ts`
Expected: PASS — all 3 tests (1 from Task 4, 2 new).

- [ ] **Step 3: Commit**

```bash
git add src/lib/chain/escrow.ts src/lib/chain/escrow.test.ts
git commit -m "feat(chain): add depositEscrow relayed approve-then-deposit flow"
```

---

### Task 6: `releaseEscrowToTalent` (organizer relayed) + admin direct release/refund

**Files:**
- Modify: `src/lib/chain/escrow.ts`
- Modify: `src/lib/chain/escrow.test.ts`

**Interfaces:**
- Produces: `releaseEscrowToTalent(supabase, userId, bookingId, deps?): Promise<\`0x${string}\`>`, `releaseEscrowAsAdmin(supabase, bookingId, deps?): Promise<\`0x${string}\`>`, `refundEscrowAsAdmin(supabase, bookingId, deps?): Promise<\`0x${string}\`>`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/chain/escrow.test.ts`, add:

```typescript
describe("releaseEscrowToTalent", () => {
  it("relays releaseToTalent signed by the organizer", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const relayCalls: { to: string; userId: string }[] = [];
    const relayAsUserFake = async (_supabase: SupabaseClient, userId: string, to: `0x${string}`) => {
      relayCalls.push({ to, userId });
      return "0xreleasetx" as const;
    };

    const { releaseEscrowToTalent } = await import("@/lib/chain/escrow");
    const bookingId = "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`;
    const txHash = await releaseEscrowToTalent({} as never, "user-1", bookingId, { relayAsUser: relayAsUserFake as never });

    expect(txHash).toBe("0xreleasetx");
    expect(relayCalls).toEqual([{ to: ESCROW_ADDRESS, userId: "user-1" }]);
    delete process.env.ESCROW_MANAGER_ADDRESS;
  });
});

describe("releaseEscrowAsAdmin", () => {
  it("submits releaseToTalent signed by the admin wallet", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const { client, eqCalls } = makeSupabase();
    let writeContractArgs: unknown;
    const walletClientFactory = () => ({
      writeContract: async (args: unknown) => {
        writeContractArgs = args;
        return "0xadminreleasetx" as const;
      },
    });

    const { releaseEscrowAsAdmin } = await import("@/lib/chain/escrow");
    const bookingId = "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`;
    const txHash = await releaseEscrowAsAdmin(client, bookingId, {
      walletClientFactory: walletClientFactory as never,
      keyProvider: testKeyProvider,
    });

    expect(txHash).toBe("0xadminreleasetx");
    expect(eqCalls).toEqual([["label", "admin"], ["chain", "avalanche"]]);
    expect((writeContractArgs as { functionName: string }).functionName).toBe("releaseToTalent");
    delete process.env.ESCROW_MANAGER_ADDRESS;
  });
});

describe("refundEscrowAsAdmin", () => {
  it("submits refundOrganizer signed by the admin wallet", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const { client, eqCalls } = makeSupabase();
    let writeContractArgs: unknown;
    const walletClientFactory = () => ({
      writeContract: async (args: unknown) => {
        writeContractArgs = args;
        return "0xrefundtx" as const;
      },
    });

    const { refundEscrowAsAdmin } = await import("@/lib/chain/escrow");
    const bookingId = "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`;
    const txHash = await refundEscrowAsAdmin(client, bookingId, {
      walletClientFactory: walletClientFactory as never,
      keyProvider: testKeyProvider,
    });

    expect(txHash).toBe("0xrefundtx");
    expect(eqCalls).toEqual([["label", "admin"], ["chain", "avalanche"]]);
    expect((writeContractArgs as { functionName: string }).functionName).toBe("refundOrganizer");
    delete process.env.ESCROW_MANAGER_ADDRESS;
  });
});
```

Run: `bun test src/lib/chain/escrow.test.ts`
Expected: FAIL — the three new functions aren't exported yet.

- [ ] **Step 2: Implement the three functions**

Append to `src/lib/chain/escrow.ts`:

```typescript
export async function releaseEscrowToTalent(
  supabase: SupabaseClient,
  userId: string,
  bookingId: `0x${string}`,
  deps: RelayedCallDeps = {}
): Promise<`0x${string}`> {
  const relay = deps.relayAsUser ?? relayAsUserDefault;
  const data = encodeFunctionData({ abi: escrowManagerAbi, functionName: "releaseToTalent", args: [bookingId] });
  return relay(supabase, userId, getEscrowManagerAddress(), data);
}

export async function releaseEscrowAsAdmin(
  supabase: SupabaseClient,
  bookingId: `0x${string}`,
  deps: DirectCallDeps = {}
): Promise<`0x${string}`> {
  const walletClientFactory = deps.walletClientFactory ?? getWalletClient;
  const keyProvider = deps.keyProvider ?? getKeyProvider();
  const adminAccount = await getSigningAccountForPlatformWallet(supabase, "admin", keyProvider);
  const client = walletClientFactory(adminAccount);

  return client.writeContract({
    address: getEscrowManagerAddress(),
    abi: escrowManagerAbi,
    functionName: "releaseToTalent",
    args: [bookingId],
    account: adminAccount,
    chain: null,
  }) as Promise<`0x${string}`>;
}

export async function refundEscrowAsAdmin(
  supabase: SupabaseClient,
  bookingId: `0x${string}`,
  deps: DirectCallDeps = {}
): Promise<`0x${string}`> {
  const walletClientFactory = deps.walletClientFactory ?? getWalletClient;
  const keyProvider = deps.keyProvider ?? getKeyProvider();
  const adminAccount = await getSigningAccountForPlatformWallet(supabase, "admin", keyProvider);
  const client = walletClientFactory(adminAccount);

  return client.writeContract({
    address: getEscrowManagerAddress(),
    abi: escrowManagerAbi,
    functionName: "refundOrganizer",
    args: [bookingId],
    account: adminAccount,
    chain: null,
  }) as Promise<`0x${string}`>;
}
```

Run: `bun test src/lib/chain/escrow.test.ts`
Expected: PASS — all 6 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chain/escrow.ts src/lib/chain/escrow.test.ts
git commit -m "feat(chain): add releaseEscrowToTalent, releaseEscrowAsAdmin, refundEscrowAsAdmin"
```

---

### Task 7: Event indexer

**Files:**
- Create: `src/lib/chain/escrow-indexer.ts`
- Test: `src/lib/chain/escrow-indexer.test.ts`

**Interfaces:**
- Consumes: `escrowManagerAbi`, `getEscrowManagerAddress`, `getPublicClient`.
- Produces: `pollEscrowEvents(supabase, publicClient?): Promise<{processed: number, toBlock: bigint}>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/chain/escrow-indexer.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pollEscrowEvents } from "@/lib/chain/escrow-indexer";

const BOOKING_ID = "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`;
const BOOKING_UUID = "11111111-2222-3333-4444-555555555555";

afterEach(() => {
  delete process.env.ESCROW_MANAGER_ADDRESS;
});

function makeSupabase(options: { cursor: number; bookingFound?: boolean }) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  let cursorUpdate: number | undefined;

  const client = {
    from: (table: string) => {
      if (table === "escrow_indexer_state") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { last_processed_block: options.cursor }, error: null }),
            }),
          }),
          update: (row: { last_processed_block: number }) => ({
            eq: async () => {
              cursorUpdate = row.last_processed_block;
              return { error: null };
            },
          }),
        };
      }
      if (table === "package_bookings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: options.bookingFound === false ? null : { id: BOOKING_UUID },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "escrow_events") {
        return {
          insert: async (row: Record<string, unknown>) => {
            inserted.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client: client as unknown as SupabaseClient, inserted, updated, getCursorUpdate: () => cursorUpdate };
}

describe("pollEscrowEvents", () => {
  it("does nothing when there are no new blocks", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const { client } = makeSupabase({ cursor: 100 });
    const publicClient = { getBlockNumber: async () => 100n, getLogs: async () => [] };

    const result = await pollEscrowEvents(client, publicClient as never);

    expect(result).toEqual({ processed: 0, toBlock: 100n });
  });

  it("records a Deposited event and updates the booking's escrow_state to funded", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const { client, inserted, getCursorUpdate } = makeSupabase({ cursor: 100 });
    const publicClient = {
      getBlockNumber: async () => 105n,
      getLogs: async ({ event }: { event: { name: string } }) => {
        if (event.name !== "Deposited") return [];
        return [{ args: { bookingId: BOOKING_ID }, transactionHash: "0xdeposittx", blockNumber: 103n }];
      },
    };

    const result = await pollEscrowEvents(client, publicClient as never);

    expect(result.processed).toBe(1);
    expect(inserted).toEqual([
      { booking_id: BOOKING_UUID, event_type: "deposited", tx_hash: "0xdeposittx", block_number: 103 },
    ]);
    expect(getCursorUpdate()).toBe(105);
  });

  it("warns and skips (without throwing) when no booking matches the event's bookingId", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const { client, inserted } = makeSupabase({ cursor: 100, bookingFound: false });
    const publicClient = {
      getBlockNumber: async () => 105n,
      getLogs: async ({ event }: { event: { name: string } }) => {
        if (event.name !== "Deposited") return [];
        return [{ args: { bookingId: BOOKING_ID }, transactionHash: "0xdeposittx", blockNumber: 103n }];
      },
    };

    const result = await pollEscrowEvents(client, publicClient as never);

    expect(result.processed).toBe(0);
    expect(inserted).toHaveLength(0);
  });
});
```

Run: `bun test src/lib/chain/escrow-indexer.test.ts`
Expected: FAIL — `Cannot find module '@/lib/chain/escrow-indexer'`.

- [ ] **Step 2: Implement `escrow-indexer.ts`**

Create `src/lib/chain/escrow-indexer.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicClient } from "@/lib/chain/clients";
import { escrowManagerAbi } from "@/lib/chain/abi/escrow-manager";
import { getEscrowManagerAddress } from "@/lib/chain/escrow-config";

const EVENT_NAMES = ["BookingRegistered", "Deposited", "Released", "Refunded"] as const;

const EVENT_TO_STATE: Record<string, string> = {
  BookingRegistered: "registered",
  Deposited: "funded",
  Released: "released",
  Refunded: "refunded",
};

const EVENT_TO_TYPE: Record<string, string> = {
  BookingRegistered: "registered",
  Deposited: "deposited",
  Released: "released",
  Refunded: "refunded",
};

export async function pollEscrowEvents(
  supabase: SupabaseClient,
  publicClient: Pick<ReturnType<typeof getPublicClient>, "getLogs" | "getBlockNumber"> = getPublicClient()
): Promise<{ processed: number; toBlock: bigint }> {
  const { data: cursor, error: cursorError } = await supabase
    .from("escrow_indexer_state")
    .select("last_processed_block")
    .eq("id", true)
    .single();
  if (cursorError) throw new Error(`Failed to read indexer cursor: ${cursorError.message}`);

  const fromBlock = BigInt(cursor.last_processed_block) + 1n;
  const toBlock = await publicClient.getBlockNumber();
  if (fromBlock > toBlock) return { processed: 0, toBlock };

  const address = getEscrowManagerAddress();
  let processed = 0;

  for (const eventName of EVENT_NAMES) {
    const eventAbiItem = escrowManagerAbi.find((item) => item.type === "event" && item.name === eventName);
    const logs = await publicClient.getLogs({
      address,
      event: eventAbiItem as never,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      const bookingIdHex = (log.args as { bookingId: `0x${string}` }).bookingId;
      const { data: booking, error: bookingError } = await supabase
        .from("package_bookings")
        .select("id")
        .eq("escrow_booking_id", bookingIdHex)
        .maybeSingle();
      if (bookingError) throw new Error(`Failed to look up booking for event ${eventName}: ${bookingError.message}`);
      if (!booking) {
        console.warn(`[pollEscrowEvents] no booking found for escrow_booking_id ${bookingIdHex} (event ${eventName})`);
        continue;
      }

      const { error: insertError } = await supabase.from("escrow_events").insert({
        booking_id: booking.id,
        event_type: EVENT_TO_TYPE[eventName],
        tx_hash: log.transactionHash,
        block_number: Number(log.blockNumber),
      });
      if (insertError) throw new Error(`Failed to record escrow event: ${insertError.message}`);

      const { error: updateError } = await supabase
        .from("package_bookings")
        .update({ escrow_state: EVENT_TO_STATE[eventName] })
        .eq("id", booking.id);
      if (updateError) throw new Error(`Failed to update booking escrow_state: ${updateError.message}`);

      processed += 1;
    }
  }

  const { error: cursorUpdateError } = await supabase
    .from("escrow_indexer_state")
    .update({ last_processed_block: Number(toBlock) })
    .eq("id", true);
  if (cursorUpdateError) throw new Error(`Failed to update indexer cursor: ${cursorUpdateError.message}`);

  return { processed, toBlock };
}
```

Run: `bun test src/lib/chain/escrow-indexer.test.ts`
Expected: PASS — all 3 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chain/escrow-indexer.ts src/lib/chain/escrow-indexer.test.ts
git commit -m "feat(chain): add polling event indexer for escrow state"
```

---

### Task 8: Indexer cron route + env docs

**Files:**
- Create: `src/app/api/cron/poll-escrow-events/route.ts`
- Create: `src/app/api/cron/poll-escrow-events/route.test.ts`
- Modify: `vercel.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `pollEscrowEvents` (Task 7), `createServiceClient` (wallet custody plan).

- [ ] **Step 1: Write the failing test**

Create `src/app/api/cron/poll-escrow-events/route.test.ts`:

```typescript
import { afterEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/poll-escrow-events", () => {
  it("returns 401 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    mock.module("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
    mock.module("@/lib/chain/escrow-indexer", () => ({ pollEscrowEvents: async () => ({ processed: 0, toBlock: 0n }) }));
    const { GET } = await import("@/app/api/cron/poll-escrow-events/route");

    const response = await GET(new NextRequest("http://localhost/api/cron/poll-escrow-events"));
    expect(response.status).toBe(401);
  });

  it("returns 401 when the Authorization header doesn't match", async () => {
    process.env.CRON_SECRET = "test-secret";
    mock.module("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
    mock.module("@/lib/chain/escrow-indexer", () => ({ pollEscrowEvents: async () => ({ processed: 0, toBlock: 0n }) }));
    const { GET } = await import("@/app/api/cron/poll-escrow-events/route");

    const response = await GET(
      new NextRequest("http://localhost/api/cron/poll-escrow-events", { headers: { authorization: "Bearer wrong" } })
    );
    expect(response.status).toBe(401);
  });

  it("polls events and returns 200 with the result when authorized", async () => {
    process.env.CRON_SECRET = "test-secret";
    mock.module("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
    mock.module("@/lib/chain/escrow-indexer", () => ({
      pollEscrowEvents: async () => ({ processed: 3, toBlock: 999n }),
    }));
    const { GET } = await import("@/app/api/cron/poll-escrow-events/route");

    const response = await GET(
      new NextRequest("http://localhost/api/cron/poll-escrow-events", {
        headers: { authorization: "Bearer test-secret" },
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ processed: 3, toBlock: "999" });
  });
});
```

Run: `bun test src/app/api/cron/poll-escrow-events/route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/cron/poll-escrow-events/route'`.

- [ ] **Step 2: Implement the route**

Create `src/app/api/cron/poll-escrow-events/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pollEscrowEvents } from "@/lib/chain/escrow-indexer";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pollEscrowEvents(createServiceClient());
  return NextResponse.json({ processed: result.processed, toBlock: result.toBlock.toString() });
}
```

Run: `bun test src/app/api/cron/poll-escrow-events/route.test.ts`
Expected: PASS — all 3 tests.

- [ ] **Step 3: Update `vercel.json` and `.env.example`**

In `vercel.json`, add a second entry to the existing `crons` array (do not remove the balance-check cron already there):

```json
{
  "path": "/api/cron/poll-escrow-events",
  "schedule": "*/5 * * * *"
}
```

In `.env.example`, add to the "Blockchain escrow payment" section:

```
ESCROW_MANAGER_ADDRESS=
SETTLEMENT_TOKEN_ADDRESS=
VND_PER_USDT=
```

- [ ] **Step 4: Verify and commit**

Run: `bunx tsc --noEmit`
Expected: no errors referencing the new route.

```bash
git add src/app/api/cron/poll-escrow-events/route.ts src/app/api/cron/poll-escrow-events/route.test.ts vercel.json .env.example
git commit -m "feat(chain): add escrow event indexer cron route"
```

---

### Task 9: Checkout — Fiat/Crypto payment channel

**Files:**
- Modify: `src/components/checkout/checkout-content.tsx`
- Modify: `src/components/checkout/checkout-content.test.tsx`
- Modify: `src/lib/supabase/package-actions.ts` (`checkoutCart`)
- Modify: `src/lib/supabase/package-actions.test.ts`

**Interfaces:**
- Produces: `checkoutCart` now writes `payment_method: 'Prepaid'` (always) and a new `payment_channel: 'fiat' | 'crypto'` field.

- [ ] **Step 1: Write the failing backend test**

Read `src/lib/supabase/package-actions.test.ts` first to find its existing `checkoutCart` test(s) and the `makeSupabase` fixture shape used there (mirror that exact pattern — don't invent a new one). Add a test asserting: calling `checkoutCart` with `formData.set("paymentChannel", "crypto")` inserts a `package_bookings` row with `payment_method: "Prepaid"` and `payment_channel: "crypto"` (not whatever `formData.get("paymentMethod")` used to control) — following the existing test file's conventions for constructing `formData` and inspecting the `inserted.packages`/`inserted.package_bookings` (or equivalent) fixture field it already tracks.

Run: `bun run test`
Expected: FAIL — the new assertion doesn't match `checkoutCart`'s current behavior (still Prepaid/Postpaid from `formData.get("paymentMethod")`, no `payment_channel` at all).

- [ ] **Step 2: Update `checkoutCart`**

In `src/lib/supabase/package-actions.ts`, replace the `paymentMethod` line and the insert's `payment_method` field (currently around lines 247 and 275):

```typescript
  const paymentChannel = String(formData.get("paymentChannel") ?? "fiat") as "fiat" | "crypto";
  const itemIds = formData.getAll("itemIds").map(String);
```

And in the `.insert(...)` call, change:

```typescript
      payment_method: paymentMethod,
```

to:

```typescript
      payment_method: "Prepaid",
      payment_channel: paymentChannel,
```

Run: `bun run test`
Expected: PASS for the new test; confirm no other existing test in this file broke (some may have referenced the old `paymentMethod` form field name — update them to `paymentChannel` if the brief's Step 1 test revealed any).

- [ ] **Step 3: Write the failing frontend test**

Read `src/components/checkout/checkout-content.test.tsx` to see its existing conventions. Add/update a test asserting: the payment-method selector renders two options labeled "Fiat Payment" and "Crypto Payment" (not "Prepaid"/"Postpaid"), and selecting "Crypto Payment" then submitting calls `checkoutCart` with a `FormData` whose `paymentChannel` field is `"crypto"`.

Run: `bun run test`
Expected: FAIL — the component still renders "Prepaid"/"Postpaid" and sets `paymentMethod`.

- [ ] **Step 4: Update `CheckoutContent`**

In `src/components/checkout/checkout-content.tsx`:

Replace the `paymentMethod` state declaration (currently `const [paymentMethod, setPaymentMethod] = useState<"Prepaid" | "Postpaid">("Prepaid");`) with:

```typescript
  const [paymentChannel, setPaymentChannel] = useState<"fiat" | "crypto">("fiat");
```

In `handleSubmit`, replace `formData.set("paymentMethod", paymentMethod);` with:

```typescript
    formData.set("paymentChannel", paymentChannel);
```

Replace the payment-method button block's array and label (currently `(["Prepaid", "Postpaid"] as const).map((method) => ...`) with:

```tsx
              {(
                [
                  { value: "fiat" as const, label: "Fiat Payment" },
                  { value: "crypto" as const, label: "Crypto Payment" },
                ]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentChannel(value)}
                  className={cn(
                    "flex items-center gap-2 rounded-[8px] border border-transparent bg-white/5 px-4 py-3 text-sm font-medium text-foreground transition-colors",
                    paymentChannel === value && "border-primary bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      paymentChannel === value ? "border-primary" : "border-white/30"
                    )}
                  >
                    {paymentChannel === value && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  {label}
                </button>
              ))}
```

Run: `bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/checkout/checkout-content.tsx src/components/checkout/checkout-content.test.tsx src/lib/supabase/package-actions.ts src/lib/supabase/package-actions.test.ts
git commit -m "feat(checkout): replace Prepaid/Postpaid choice with Fiat/Crypto payment channel"
```

---

### Task 10: Wire `registerEscrowBooking` into booking confirmation, guard `markBookingPaid`

**Files:**
- Modify: `src/lib/supabase/package-actions.ts` (`confirmBookingOffer`, `markBookingPaid`)
- Modify: `src/lib/supabase/package-actions.test.ts`

**Interfaces:**
- Consumes: `registerEscrowBooking` (Task 4), `bookingIdToBytes32`/`vndToTokenAmount`/`getSettlementTokenAddress` (Task 3), `provisionWalletForUser` (wallet custody plan), `createServiceClient` (wallet custody plan).

- [ ] **Step 1: Write the failing tests**

Read `src/lib/supabase/package-actions.test.ts`'s existing `confirmBookingOffer` and `markBookingPaid` tests first, to mirror the exact `makeSupabase`/mock-module conventions already used there.

Add tests (using `mock.module` for `@/lib/chain/escrow`, `@/lib/wallet/provision`, and `@/lib/supabase/service`, matching the pattern already used for `provisionWalletForUser` mocking in this file's signup-adjacent tests):

1. `confirmBookingOffer` on a booking with `payment_channel: 'crypto'` that reaches `status: 'confirmed'`: provisions wallets for both organizer and talent, then calls `registerEscrowBooking` with the right `bookingId`/`organizerAddress`/`talentAddress`/`tokenAddress`/`amount`/`feeBps` — assert the mocked `registerEscrowBooking` was called once with those exact values (deriving `feeBps` from the talent's `commission_bps`, which your fixture booking's package/talent profile should include).
2. `confirmBookingOffer` on a `payment_channel: 'fiat'` (or `null`) booking does NOT call `registerEscrowBooking` at all.
3. `confirmBookingOffer` still returns `{ success: true }` even when `registerEscrowBooking` throws (best-effort, matching the signup wallet-provisioning pattern — log loud via `console.error`, don't block).
4. `markBookingPaid` on a booking with `payment_channel: 'crypto'` returns `{ error: "This booking uses crypto escrow — use the Deposit action instead." }` and does NOT update `payment_status`.

Run: `bun run test`
Expected: FAIL on the new assertions.

- [ ] **Step 2: Implement the wiring**

In `src/lib/supabase/package-actions.ts`, add imports near the top:

```typescript
import { registerEscrowBooking } from "@/lib/chain/escrow";
import { bookingIdToBytes32, getSettlementTokenAddress, vndToTokenAmount } from "@/lib/chain/escrow-config";
import { provisionWalletForUser } from "@/lib/wallet/provision";
import { createServiceClient } from "@/lib/supabase/service";
```

Update `actorRoleFor`'s select and return type to also fetch `organizer_id` and `payment_channel` (both plain columns on `package_bookings`, no embed needed), and add `organizerId`, `talentId`, and `paymentChannel` to the returned object. The exact change: extend the `select` string from `"organizer_id, awaiting_response_from, talent_offer_vnd, organizer_offer_vnd, payment_method, package:packages(talent_id)"` to `"organizer_id, awaiting_response_from, talent_offer_vnd, organizer_offer_vnd, payment_method, payment_channel, package:packages(talent_id)"` (only `payment_channel` is new — `package:packages(talent_id)` already exists and works, don't change its syntax), and add these two lines to the returned object literal: `organizerId: booking.organizer_id,` and `paymentChannel: booking.payment_channel,` (alongside the existing `talentOfferVnd`/etc. fields — `talentId` is already derivable from `packageTalentId`, already computed in this function, just also return it as `talentId: packageTalentId,`).

In `confirmBookingOffer`, after the existing successful update (`if (error) return { error: error.message }; return { success: true };` — insert the new logic BEFORE the final `return { success: true }`, after confirming the update succeeded). Talent commission is fetched with its own simple query rather than a nested embed, to avoid needing to know this repo's exact FK constraint name for a `profiles`-through-`packages` join:

```typescript
  if (actor.paymentChannel === "crypto") {
    // Best-effort, matching the signup wallet-provisioning pattern: the
    // booking is already confirmed at this point, and this can be
    // retried/resolved manually if it fails, so a failure here shouldn't
    // block the confirmation itself.
    try {
      const service = createServiceClient();
      const [{ address: organizerAddress }, { address: talentAddress }, { data: talentProfile }] = await Promise.all([
        provisionWalletForUser(service, actor.organizerId),
        provisionWalletForUser(service, actor.talentId),
        service.from("profiles").select("commission_bps").eq("id", actor.talentId).single(),
      ]);
      await registerEscrowBooking(service, {
        bookingId: bookingIdToBytes32(bookingId),
        organizerAddress: organizerAddress as `0x${string}`,
        talentAddress: talentAddress as `0x${string}`,
        tokenAddress: getSettlementTokenAddress(),
        amount: vndToTokenAmount(agreedPrice),
        feeBps: talentProfile?.commission_bps ?? 1000,
      });
    } catch (registerError) {
      console.error(`[confirmBookingOffer] escrow registration failed for booking ${bookingId}:`, registerError);
    }
  }
```

In `markBookingPaid`, extend the existing `select` to also fetch `payment_channel`, and add a check right after the existing `if (booking.payment_method !== "Prepaid") ...` line:

```typescript
  if (booking.payment_channel === "crypto") {
    return { error: "This booking uses crypto escrow — use the Deposit action instead." };
  }
```

Run: `bun run test`
Expected: PASS — all new and existing tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/package-actions.ts src/lib/supabase/package-actions.test.ts
git commit -m "feat(booking): register crypto bookings on-chain at confirmation, guard fiat-only markBookingPaid"
```

---

### Task 11: Deposit UI

**Files:**
- Modify: `src/components/account/order-detail-content.tsx`
- Modify: `src/components/account/order-detail-content.test.tsx`
- Modify: `src/lib/supabase/package-actions.ts` (new `depositBookingEscrow` action)
- Modify: `src/lib/supabase/package-actions.test.ts`

**Interfaces:**
- Consumes: `depositEscrow` (Task 5).
- Produces: `depositBookingEscrow(bookingId): Promise<{error: string} | {success: true}>`.

- [ ] **Step 1: Write the failing backend test**

In `src/lib/supabase/package-actions.test.ts`, add tests for a new `depositBookingEscrow(bookingId)` action (mirror the file's existing signed-in/ownership-check test conventions from e.g. `markBookingPaid`):
1. Rejects when not signed in.
2. Rejects when the caller isn't the booking's organizer.
3. Rejects when `escrow_state !== 'registered'` (nothing to deposit against yet).
4. On success (organizer, `escrow_state === 'registered'`), calls the mocked `depositEscrow` with the booking's `escrow_booking_id`, `tokenAddress` (from `getSettlementTokenAddress()`), organizer's own wallet address, and `amount` (`vndToTokenAmount` of the booking's `price_vnd`), and returns `{ success: true }`. Note: this action does NOT itself update `escrow_state` — the indexer does, once the deposit is actually mined — so just assert the call happened and the function returned success, not any DB write.

Run: `bun run test`
Expected: FAIL — `depositBookingEscrow` doesn't exist yet.

- [ ] **Step 2: Implement `depositBookingEscrow`**

In `src/lib/supabase/package-actions.ts`, add near `markBookingPaid`:

```typescript
/** Organizer deposits a crypto-channel booking's escrow -- relayed, gas-sponsored. */
export async function depositBookingEscrow(bookingId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: booking } = await supabase
    .from("package_bookings")
    .select("organizer_id, escrow_booking_id, escrow_state, price_vnd")
    .eq("id", bookingId)
    .single();
  if (!booking) return { error: "Booking not found." };
  if (booking.organizer_id !== user.id) return { error: "Only the organizer can deposit for this booking." };
  if (booking.escrow_state !== "registered") return { error: "This booking isn't ready for deposit." };

  const service = createServiceClient();
  try {
    await depositEscrow(service, user.id, {
      bookingId: booking.escrow_booking_id as `0x${string}`,
      tokenAddress: getSettlementTokenAddress(),
      organizerAddress: (await provisionWalletForUser(service, user.id)).address as `0x${string}`,
      amount: vndToTokenAmount(booking.price_vnd),
    });
  } catch (depositError) {
    return { error: depositError instanceof Error ? depositError.message : "Deposit failed." };
  }

  return { success: true };
}
```

Add `depositEscrow` to the `@/lib/chain/escrow` import already added in Task 10.

Run: `bun run test`
Expected: PASS.

- [ ] **Step 3: Write the failing frontend test**

Read `src/components/account/order-detail-content.test.tsx`'s existing conventions. Add a test: when `booking.payment_channel === 'crypto'` and `booking.escrow_state === 'registered'`, the component renders a "Deposit" button (in place of, or alongside, the existing bank-transfer `needsPayment` UI, which should NOT render for crypto bookings), and clicking it calls `depositBookingEscrow(booking.id)`.

Run: `bun run test`
Expected: FAIL.

- [ ] **Step 4: Implement the UI**

In `src/components/account/order-detail-content.tsx`:

Add `depositBookingEscrow` to the existing `@/lib/supabase/package-actions` import.

Update the `needsPayment` computation (currently `const needsPayment = isConfirmed && booking.payment_method === "Prepaid" && booking.payment_status === "pending";`) to exclude crypto bookings, since they use a different UI path:

```typescript
  const needsPayment =
    isConfirmed && booking.payment_method === "Prepaid" && booking.payment_status === "pending" && booking.payment_channel !== "crypto";
  const needsCryptoDeposit =
    isConfirmed && booking.payment_channel === "crypto" && booking.escrow_state === "registered";
```

Add a handler alongside the existing `handleConfirm`/etc.:

```typescript
  async function handleDeposit() {
    setPending(true);
    const result = await runAction(depositBookingEscrow(booking.id), { success: "Deposit submitted." });
    setPending(false);
    if (!("error" in result)) router.refresh();
  }
```

Near where the existing `needsPayment && (...)` block renders (around line 195), add a sibling block:

```tsx
        {needsCryptoDeposit && myRole === "organizer" && (
          <Button disabled={pending} onClick={handleDeposit} className="h-11 w-full rounded-[6px]">
            {pending ? "Depositing..." : "Deposit"}
          </Button>
        )}
```

Run: `bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/account/order-detail-content.tsx src/components/account/order-detail-content.test.tsx src/lib/supabase/package-actions.ts src/lib/supabase/package-actions.test.ts
git commit -m "feat(booking): add crypto deposit action and UI"
```

---

### Task 12: Wire `releaseEscrowToTalent` into organizer Mark Complete

**Files:**
- Modify: `src/lib/supabase/package-actions.ts` (`organizerMarkComplete`)
- Modify: `src/lib/supabase/package-actions.test.ts`

**Interfaces:**
- Consumes: `releaseEscrowToTalent` (Task 6).

- [ ] **Step 1: Write the failing tests**

Add tests for `organizerMarkComplete`, mirroring its existing test conventions:
1. On a booking with `payment_channel: 'crypto'` and `escrow_state: 'funded'` that successfully reaches `status: 'completed'`, calls the mocked `releaseEscrowToTalent` with the booking's `escrow_booking_id` and the calling organizer's user id.
2. On a `payment_channel: 'fiat'` (or `null`) booking, does NOT call `releaseEscrowToTalent`.
3. On a crypto booking whose `escrow_state` is NOT `'funded'` (e.g. still `'registered'`), does NOT call `releaseEscrowToTalent` (nothing to release yet) but still completes normally.
4. Still returns `{ success: true }` even when `releaseEscrowToTalent` throws (best-effort, same pattern as Task 10).

Run: `bun run test`
Expected: FAIL.

- [ ] **Step 2: Implement the wiring**

In `src/lib/supabase/package-actions.ts`, add `releaseEscrowToTalent` to the `@/lib/chain/escrow` import.

In `organizerMarkComplete`, extend the existing `select` to also fetch `payment_channel, escrow_state, escrow_booking_id`, and after the existing successful status update (before the final `return { success: true }`):

```typescript
  if (booking.payment_channel === "crypto" && booking.escrow_state === "funded") {
    try {
      await releaseEscrowToTalent(createServiceClient(), user.id, booking.escrow_booking_id as `0x${string}`);
    } catch (releaseError) {
      console.error(`[organizerMarkComplete] escrow release failed for booking ${bookingId}:`, releaseError);
    }
  }
```

Run: `bun run test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/package-actions.ts src/lib/supabase/package-actions.test.ts
git commit -m "feat(booking): release escrow to talent on organizer Mark Complete"
```

---

### Task 13: Admin membership check + admin layout gate

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/supabase/admin.test.ts`
- Create: `src/app/admin/layout.tsx`

**Interfaces:**
- Produces: `isCurrentUserAdmin(): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase/admin.test.ts`:

```typescript
import { describe, expect, it, mock } from "bun:test";

describe("isCurrentUserAdmin", () => {
  it("returns false when not signed in", async () => {
    mock.module("@/lib/supabase/server", () => ({
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    }));
    const { isCurrentUserAdmin } = await import("@/lib/supabase/admin");
    expect(await isCurrentUserAdmin()).toBe(false);
  });

  it("returns false when signed in but not in admin_users", async () => {
    mock.module("@/lib/supabase/server", () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      }),
    }));
    const { isCurrentUserAdmin } = await import("@/lib/supabase/admin");
    expect(await isCurrentUserAdmin()).toBe(false);
  });

  it("returns true when the user has an admin_users row", async () => {
    mock.module("@/lib/supabase/server", () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "user-1" }, error: null }) }) }),
        }),
      }),
    }));
    const { isCurrentUserAdmin } = await import("@/lib/supabase/admin");
    expect(await isCurrentUserAdmin()).toBe(true);
  });
});
```

Run: `bun test src/lib/supabase/admin.test.ts`
Expected: FAIL — `Cannot find module '@/lib/supabase/admin'`.

- [ ] **Step 2: Implement `admin.ts`**

Create `src/lib/supabase/admin.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";

/** Whether the signed-in user is an internal ops admin -- checks the admin_users allowlist, not any marketplace role_type. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  return data !== null;
}
```

Run: `bun test src/lib/supabase/admin.test.ts`
Expected: PASS — all 3 tests.

- [ ] **Step 3: Add the admin layout gate**

Create `src/app/admin/layout.tsx`:

```tsx
import { notFound } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/supabase/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) notFound();

  return <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/admin.ts src/lib/supabase/admin.test.ts src/app/admin/layout.tsx
git commit -m "feat(admin): add admin_users membership check and layout gate"
```

---

### Task 14: Admin dispute queue

**Files:**
- Create: `src/app/admin/disputes/page.tsx`
- Create: `src/lib/supabase/admin-actions.ts`
- Create: `src/lib/supabase/admin-actions.test.ts`

**Interfaces:**
- Consumes: `releaseEscrowAsAdmin`, `refundEscrowAsAdmin` (Task 6), `isCurrentUserAdmin` (Task 13).
- Produces: `resolveDisputeByRelease(bookingId): Promise<{error: string} | {success: true}>`, `resolveDisputeByRefund(bookingId): Promise<{error: string} | {success: true}>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/supabase/admin-actions.test.ts`:

```typescript
import { afterEach, describe, expect, it, mock } from "bun:test";

afterEach(() => {
  mock.restore();
});

function mockAdminCheck(isAdmin: boolean) {
  mock.module("@/lib/supabase/admin", () => ({ isCurrentUserAdmin: async () => isAdmin }));
}

describe("resolveDisputeByRelease", () => {
  it("rejects when the caller is not an admin", async () => {
    mockAdminCheck(false);
    const { resolveDisputeByRelease } = await import("@/lib/supabase/admin-actions");
    expect(await resolveDisputeByRelease("booking-1")).toEqual({ error: "Admin access required." });
  });

  it("calls releaseEscrowAsAdmin with the booking's escrow_booking_id when authorized", async () => {
    mockAdminCheck(true);
    const calls: string[] = [];
    mock.module("@/lib/chain/escrow", () => ({
      releaseEscrowAsAdmin: async (_supabase: unknown, bookingId: string) => {
        calls.push(bookingId);
        return "0xtx";
      },
    }));
    mock.module("@/lib/supabase/service", () => ({
      createServiceClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({ single: async () => ({ data: { escrow_booking_id: "0xabc" }, error: null }) }),
          }),
        }),
      }),
    }));
    const { resolveDisputeByRelease } = await import("@/lib/supabase/admin-actions");

    const result = await resolveDisputeByRelease("booking-1");

    expect(result).toEqual({ success: true });
    expect(calls).toEqual(["0xabc"]);
  });
});

describe("resolveDisputeByRefund", () => {
  it("rejects when the caller is not an admin", async () => {
    mockAdminCheck(false);
    const { resolveDisputeByRefund } = await import("@/lib/supabase/admin-actions");
    expect(await resolveDisputeByRefund("booking-1")).toEqual({ error: "Admin access required." });
  });
});
```

Run: `bun test src/lib/supabase/admin-actions.test.ts`
Expected: FAIL — `Cannot find module '@/lib/supabase/admin-actions'`.

- [ ] **Step 2: Implement `admin-actions.ts`**

Create `src/lib/supabase/admin-actions.ts`:

```typescript
"use server";

import { isCurrentUserAdmin } from "@/lib/supabase/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { releaseEscrowAsAdmin, refundEscrowAsAdmin } from "@/lib/chain/escrow";

async function getEscrowBookingId(bookingId: string): Promise<string> {
  const service = createServiceClient();
  const { data, error } = await service.from("package_bookings").select("escrow_booking_id").eq("id", bookingId).single();
  if (error || !data?.escrow_booking_id) throw new Error("This booking has no on-chain escrow to resolve.");
  return data.escrow_booking_id;
}

export async function resolveDisputeByRelease(bookingId: string): Promise<{ error: string } | { success: true }> {
  if (!(await isCurrentUserAdmin())) return { error: "Admin access required." };

  try {
    const escrowBookingId = await getEscrowBookingId(bookingId);
    await releaseEscrowAsAdmin(createServiceClient(), escrowBookingId as `0x${string}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to release funds." };
  }
  return { success: true };
}

export async function resolveDisputeByRefund(bookingId: string): Promise<{ error: string } | { success: true }> {
  if (!(await isCurrentUserAdmin())) return { error: "Admin access required." };

  try {
    const escrowBookingId = await getEscrowBookingId(bookingId);
    await refundEscrowAsAdmin(createServiceClient(), escrowBookingId as `0x${string}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to refund organizer." };
  }
  return { success: true };
}
```

Run: `bun test src/lib/supabase/admin-actions.test.ts`
Expected: PASS — all 3 tests.

- [ ] **Step 3: Build the dispute queue page**

Create `src/app/admin/disputes/page.tsx`:

```tsx
import { createServiceClient } from "@/lib/supabase/service";
import { resolveDisputeByRelease, resolveDisputeByRefund } from "@/lib/supabase/admin-actions";
import { Button } from "@/components/ui/button";

export default async function AdminDisputesPage() {
  const supabase = createServiceClient();
  const { data: bookings } = await supabase
    .from("package_bookings")
    .select("id, price_vnd, status, escrow_state, organizer:profiles!package_bookings_organizer_id_fkey(full_name)")
    .eq("payment_channel", "crypto")
    .eq("escrow_state", "funded")
    .eq("status", "cancelled");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Escrow Disputes</h1>
      <p className="text-sm text-muted-foreground">
        Cancelled bookings with funds still locked on-chain. Choose whether the talent gets paid or the organizer gets refunded.
      </p>
      <div className="flex flex-col gap-3">
        {(bookings ?? []).map((booking) => (
          <form
            key={booking.id}
            className="flex items-center justify-between gap-4 rounded-md bg-white/5 p-4"
          >
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-foreground">Booking {booking.id}</span>
              <span className="text-muted-foreground">{booking.price_vnd.toLocaleString("en-US")} VND</span>
            </div>
            <div className="flex gap-2">
              <Button formAction={resolveDisputeByRelease.bind(null, booking.id)}>Release to Talent</Button>
              <Button variant="outline" formAction={resolveDisputeByRefund.bind(null, booking.id)}>
                Refund Organizer
              </Button>
            </div>
          </form>
        ))}
        {(bookings ?? []).length === 0 && <p className="text-sm text-muted-foreground">No open disputes.</p>}
      </div>
    </div>
  );
}
```

If `Button`'s `variant="outline"` isn't a real variant in this repo's `src/components/ui/button.tsx`, check that file and use whichever variant name it actually exports instead of guessing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/admin-actions.ts src/lib/supabase/admin-actions.test.ts src/app/admin/disputes/page.tsx
git commit -m "feat(admin): add escrow dispute queue"
```

---

### Task 15: Admin commission-rate editor

**Files:**
- Create: `src/app/admin/commissions/page.tsx`
- Modify: `src/lib/supabase/admin-actions.ts`
- Modify: `src/lib/supabase/admin-actions.test.ts`

**Interfaces:**
- Produces: `updateTalentCommission(talentId, commissionBps): Promise<{error: string} | {success: true}>`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/supabase/admin-actions.test.ts`, add:

```typescript
describe("updateTalentCommission", () => {
  it("rejects when the caller is not an admin", async () => {
    mockAdminCheck(false);
    const { updateTalentCommission } = await import("@/lib/supabase/admin-actions");
    expect(await updateTalentCommission("talent-1", 500)).toEqual({ error: "Admin access required." });
  });

  it("rejects an out-of-range commission value", async () => {
    mockAdminCheck(true);
    const { updateTalentCommission } = await import("@/lib/supabase/admin-actions");
    expect(await updateTalentCommission("talent-1", 10001)).toEqual({ error: "Commission must be between 0 and 10000 basis points." });
  });

  it("updates the talent's commission_bps when authorized and valid", async () => {
    mockAdminCheck(true);
    const updates: Record<string, unknown>[] = [];
    mock.module("@/lib/supabase/service", () => ({
      createServiceClient: () => ({
        from: () => ({
          update: (row: Record<string, unknown>) => ({
            eq: async () => {
              updates.push(row);
              return { error: null };
            },
          }),
        }),
      }),
    }));
    const { updateTalentCommission } = await import("@/lib/supabase/admin-actions");

    const result = await updateTalentCommission("talent-1", 500);

    expect(result).toEqual({ success: true });
    expect(updates).toEqual([{ commission_bps: 500 }]);
  });
});
```

Run: `bun test src/lib/supabase/admin-actions.test.ts`
Expected: FAIL — `updateTalentCommission` doesn't exist yet.

- [ ] **Step 2: Implement `updateTalentCommission`**

Append to `src/lib/supabase/admin-actions.ts`:

```typescript
export async function updateTalentCommission(
  talentId: string,
  commissionBps: number
): Promise<{ error: string } | { success: true }> {
  if (!(await isCurrentUserAdmin())) return { error: "Admin access required." };
  if (commissionBps < 0 || commissionBps > 10000) {
    return { error: "Commission must be between 0 and 10000 basis points." };
  }

  const { error } = await createServiceClient()
    .from("profiles")
    .update({ commission_bps: commissionBps })
    .eq("id", talentId);
  if (error) return { error: error.message };
  return { success: true };
}
```

Run: `bun test src/lib/supabase/admin-actions.test.ts`
Expected: PASS — all 6 tests.

- [ ] **Step 3: Build the commission editor page**

Create `src/app/admin/commissions/page.tsx`:

```tsx
import { createServiceClient } from "@/lib/supabase/service";
import { updateTalentCommission } from "@/lib/supabase/admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function AdminCommissionsPage() {
  const supabase = createServiceClient();
  const { data: talents } = await supabase
    .from("profiles")
    .select("id, full_name, commission_bps")
    .eq("role", "talent")
    .order("full_name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Talent Commission Rates</h1>
      <div className="flex flex-col gap-3">
        {(talents ?? []).map((talent) => (
          <form
            key={talent.id}
            action={async (formData: FormData) => {
              "use server";
              await updateTalentCommission(talent.id, Number(formData.get("commissionBps")));
            }}
            className="flex items-center justify-between gap-4 rounded-md bg-white/5 p-4"
          >
            <span className="text-sm font-semibold text-foreground">{talent.full_name}</span>
            <div className="flex items-center gap-2">
              <Input name="commissionBps" type="number" min={0} max={10000} defaultValue={talent.commission_bps} className="w-28" />
              <span className="text-xs text-muted-foreground">bps</span>
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
```

If `Button`'s `size="sm"` isn't a real prop/variant in this repo's `Button` component, check `src/components/ui/button.tsx` and adjust to whatever it actually supports.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/commissions/page.tsx src/lib/supabase/admin-actions.ts src/lib/supabase/admin-actions.test.ts
git commit -m "feat(admin): add talent commission-rate editor"
```
