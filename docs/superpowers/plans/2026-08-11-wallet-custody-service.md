# Wallet Custody Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the custodial wallet service — the second of four subsystems in the blockchain escrow payment feature — so every organizer/talent gets an EVM wallet the platform generates and holds the key for, plus the platform's own operational wallets (admin/operator/relayer/fee recipient).

**Architecture:** A new `wallets` Supabase table, locked down to the service role only (no RLS grants to `anon`/`authenticated`), with a `wallet_addresses` view exposing only each user their own address. Keys are generated with `viem`, encrypted at rest with AES-256-GCM behind a `KeyEncryptionProvider` interface, and provisioned idempotently — once at signup for marketplace users, once via a setup script for the platform's own wallets. A re-authentication-gated export action lets a user retrieve their raw key.

**Tech Stack:** TypeScript, `viem` (new dependency, also needed by the later relayer plan), `@supabase/supabase-js` (service-role client, new to this app — existing code only uses the cookie-scoped `@supabase/ssr` client), Node's built-in `crypto` module, `bun:test`.

## Global Constraints

- Chain: `'avalanche'` (matches the contract plan's target).
- The `wallets` table must have **zero RLS policies granting `anon`/`authenticated` access** — reachable only via the service-role client (`src/lib/supabase/service.ts`, this plan's Task 4). Supabase's `service_role` Postgres role bypasses RLS automatically; no explicit service-role policy is needed.
- `wallet_addresses` (the user-facing view) must never select `encrypted_private_key`.
- Private keys are encrypted with AES-256-GCM via a `KeyEncryptionProvider` interface (`src/lib/wallet/key-provider.ts`) — `AppLevelKeyProvider` is the only implementation this plan ships; a future `CloudKmsKeyProvider` implementing the same interface is documented, not built, here (see `.claude/rules/env-secrets.md`).
- Wallet provisioning (`provisionWalletForUser`, `provisionPlatformWallet`) must be **idempotent** — safe to call repeatedly, only inserting when no matching row exists yet.
- Wallet provisioning at signup is best-effort: a failure must be logged loudly (`console.error` with full context), never silently swallowed, but must **not** block the signup response — the auth account already exists by that point, and provisioning can be retried later since it's idempotent.
- TDD: every task starts with a failing test (RED) before implementation (GREEN), per this repo's `.claude/rules/tdd.md`. Mock the Supabase client the same way existing tests in `src/lib/supabase/*.test.ts` do (a hand-built fake object matching the exact query-builder chain used, e.g. `src/lib/supabase/package-actions.test.ts`) — never a real database connection (none is available in this environment; no Supabase CLI or MCP server is configured for this repo/session).
- Full design context: `docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md` (Wallet custody service section).

---

### Task 1: `wallets` table migration

**Files:**
- Create: `supabase/migrations/20260811080000_wallets.sql`

**Interfaces:**
- Produces: `public.wallets` table (`id, user_id, label, chain, address, encrypted_private_key, exported_at, created_at`), `public.wallet_addresses` view (`id, user_id, address, chain, created_at`).
- Consumes: `public.profiles` (existing table, FK target for `user_id`).

This task is SQL-only — there is no live database connection available in this environment to apply/verify it against (no Supabase CLI or MCP server configured for this repo/session). "Testing" this task means careful review against this repo's existing migration conventions, not execution.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260811080000_wallets.sql`:

```sql
-- Custodial EVM wallets: one per organizer/talent (blockchain escrow
-- payment feature), plus platform-owned wallets (admin/operator/relayer/
-- fee_recipient, user_id null). Private keys are encrypted app-side
-- before insert -- this table is never readable by anon/authenticated
-- Postgres roles, only by the service role (which bypasses RLS by
-- default in Supabase), so a compromised anon/authenticated credential
-- can never read key material.
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  label text check (label in ('admin', 'operator', 'relayer', 'fee_recipient')),
  chain text not null default 'avalanche',
  address text not null,
  encrypted_private_key jsonb not null,
  exported_at timestamptz,
  created_at timestamptz not null default now(),
  constraint wallets_user_id_or_label check (user_id is not null or label is not null)
);

create unique index wallets_address_key on public.wallets (chain, address);
create unique index wallets_user_id_chain_key on public.wallets (user_id, chain) where user_id is not null;
create unique index wallets_label_chain_key on public.wallets (label, chain) where label is not null;
create index wallets_user_id_idx on public.wallets (user_id);

alter table public.wallets enable row level security;
-- Deliberately no policies: this table is reachable only by the
-- service-role Postgres role (which bypasses RLS in Supabase), never by
-- anon or authenticated. See src/lib/supabase/service.ts.

-- Exposes each user's own wallet address (never the encrypted key) to
-- the frontend. This view intentionally runs with its owning role's
-- privileges (Postgres/Supabase default for views: security_invoker =
-- false), which is what lets it select from `wallets` despite that
-- table's RLS -- safe only because the WHERE clause is hard-coded to the
-- caller's own auth.uid() and the column list never includes
-- encrypted_private_key. Do NOT "fix" this to security_invoker = true if
-- a linter flags it as a security-definer view -- that would make every
-- select fail, since the invoking user's own RLS (which allows nothing)
-- would apply instead of the view owner's.
create view public.wallet_addresses as
  select id, user_id, address, chain, created_at
  from public.wallets
  where user_id = auth.uid();

grant select on public.wallet_addresses to authenticated;
```

- [ ] **Step 2: Review against existing conventions**

Compare against `supabase/migrations/0011_kyc_documents_bucket.sql` (view + grant pattern) and `supabase/migrations/0006_packages_and_bookings.sql` (`references public.profiles (id) on delete cascade` FK convention, `enable row level security` placement). Confirm: table/column naming is snake_case, the migration file's timestamp sorts after the latest existing migration (`20260808103000_all_vietnam_cities.sql`), and no policy accidentally grants `anon`/`authenticated` access to the base `wallets` table.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260811080000_wallets.sql
git commit -m "feat(db): add wallets table for custodial EVM wallet storage"
```

---

### Task 2: `KeyEncryptionProvider` + `AppLevelKeyProvider`

**Files:**
- Create: `src/lib/wallet/key-provider.ts`
- Create: `src/lib/wallet/app-level-key-provider.ts`
- Test: `src/lib/wallet/app-level-key-provider.test.ts`

**Interfaces:**
- Produces: `EncryptedPayload` (`{iv, authTag, ciphertext, keyVersion}`), `KeyEncryptionProvider` interface (`encrypt(plaintext: string): Promise<EncryptedPayload>`, `decrypt(payload: EncryptedPayload): Promise<string>`), `AppLevelKeyProvider` class implementing it, `getKeyProvider(): AppLevelKeyProvider` (production singleton, reads `WALLET_MASTER_KEY`).
- Consumes: nothing (first task with app code).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/wallet/key-provider.ts`:

```typescript
export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
  keyVersion: number;
}

export interface KeyEncryptionProvider {
  encrypt(plaintext: string): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload): Promise<string>;
}
```

Create `src/lib/wallet/app-level-key-provider.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import { AppLevelKeyProvider } from "@/lib/wallet/app-level-key-provider";

function testProvider() {
  return new AppLevelKeyProvider(randomBytes(32));
}

describe("AppLevelKeyProvider", () => {
  it("round-trips a plaintext through encrypt then decrypt", async () => {
    const provider = testProvider();
    const payload = await provider.encrypt("0xdeadbeef-private-key");
    expect(await provider.decrypt(payload)).toBe("0xdeadbeef-private-key");
  });

  it("produces different ciphertext for the same plaintext on repeated calls", async () => {
    const provider = testProvider();
    const a = await provider.encrypt("same-plaintext");
    const b = await provider.encrypt("same-plaintext");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it("fails to decrypt when the auth tag has been tampered with", async () => {
    const provider = testProvider();
    const payload = await provider.encrypt("secret");
    const tampered = { ...payload, authTag: Buffer.from("0".repeat(32), "hex").toString("base64") };
    await expect(provider.decrypt(tampered)).rejects.toThrow();
  });

  it("fails to decrypt with a different master key", async () => {
    const providerA = testProvider();
    const providerB = testProvider();
    const payload = await providerA.encrypt("secret");
    await expect(providerB.decrypt(payload)).rejects.toThrow();
  });

  it("rejects a master key that isn't 32 bytes", () => {
    expect(() => new AppLevelKeyProvider(randomBytes(16))).toThrow(/32 bytes/);
  });
});
```

Run: `bun test src/lib/wallet/app-level-key-provider.test.ts`
Expected: FAIL — `Cannot find module '@/lib/wallet/app-level-key-provider'`.

- [ ] **Step 2: Implement `AppLevelKeyProvider`**

Create `src/lib/wallet/app-level-key-provider.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { EncryptedPayload, KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const ALGORITHM = "aes-256-gcm";
const KEY_VERSION = 1;

/**
 * AES-256-GCM encryption using a single master key. Interim
 * implementation pending a Cloud KMS-backed provider implementing the
 * same KeyEncryptionProvider interface -- see .claude/rules/env-secrets.md.
 */
export class AppLevelKeyProvider implements KeyEncryptionProvider {
  constructor(private readonly masterKey: Buffer) {
    if (masterKey.length !== 32) {
      throw new Error(`WALLET_MASTER_KEY must decode to 32 bytes, got ${masterKey.length}`);
    }
  }

  async encrypt(plaintext: string): Promise<EncryptedPayload> {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      keyVersion: KEY_VERSION,
    };
  }

  async decrypt(payload: EncryptedPayload): Promise<string> {
    const decipher = createDecipheriv(ALGORITHM, this.masterKey, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }
}

let singleton: AppLevelKeyProvider | undefined;

/** Production entry point -- reads WALLET_MASTER_KEY (base64, 32 bytes) from the environment. */
export function getKeyProvider(): AppLevelKeyProvider {
  if (!singleton) {
    const raw = process.env.WALLET_MASTER_KEY;
    if (!raw) throw new Error("WALLET_MASTER_KEY is not set");
    singleton = new AppLevelKeyProvider(Buffer.from(raw, "base64"));
  }
  return singleton;
}
```

Run: `bun test src/lib/wallet/app-level-key-provider.test.ts`
Expected: PASS — all 5 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wallet/key-provider.ts src/lib/wallet/app-level-key-provider.ts src/lib/wallet/app-level-key-provider.test.ts
git commit -m "feat(wallet): add AES-256-GCM key encryption provider"
```

---

### Task 3: `generateWallet` (viem)

**Files:**
- Modify: `package.json` (add `viem` dependency)
- Create: `src/lib/wallet/generate-wallet.ts`
- Test: `src/lib/wallet/generate-wallet.test.ts`

**Interfaces:**
- Produces: `GeneratedWallet` (`{address: string, privateKey: string}`), `generateWallet(): GeneratedWallet`.
- Consumes: nothing.

- [ ] **Step 1: Add the dependency**

Run: `bun add viem`
Expected: `package.json`'s `dependencies` gains `"viem": "^2.x.x"` (whatever current major/minor `bun add` resolves), `bun.lock` updates.

- [ ] **Step 2: Write the failing test**

Create `src/lib/wallet/generate-wallet.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { generateWallet } from "@/lib/wallet/generate-wallet";

describe("generateWallet", () => {
  it("returns a checksummed EVM address and a matching private key", () => {
    const wallet = generateWallet();
    expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it("generates a different keypair on every call", () => {
    const a = generateWallet();
    const b = generateWallet();
    expect(a.address).not.toBe(b.address);
    expect(a.privateKey).not.toBe(b.privateKey);
  });
});
```

Run: `bun test src/lib/wallet/generate-wallet.test.ts`
Expected: FAIL — `Cannot find module '@/lib/wallet/generate-wallet'`.

- [ ] **Step 3: Implement `generateWallet`**

Create `src/lib/wallet/generate-wallet.ts`:

```typescript
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export interface GeneratedWallet {
  address: string;
  privateKey: string;
}

export function generateWallet(): GeneratedWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { address: account.address, privateKey };
}
```

Run: `bun test src/lib/wallet/generate-wallet.test.ts`
Expected: PASS — both tests.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock src/lib/wallet/generate-wallet.ts src/lib/wallet/generate-wallet.test.ts
git commit -m "feat(wallet): add generateWallet using viem"
```

---

### Task 4: Service-role client + `provisionWalletForUser` / `provisionPlatformWallet`

**Files:**
- Create: `src/lib/supabase/service.ts`
- Create: `src/lib/wallet/provision.ts`
- Test: `src/lib/wallet/provision.test.ts`

**Interfaces:**
- Consumes: `generateWallet` (Task 3), `KeyEncryptionProvider`, `getKeyProvider` (Task 2).
- Produces: `createServiceClient(): SupabaseClient`; `provisionWalletForUser(supabase: SupabaseClient, userId: string, keyProvider?: KeyEncryptionProvider): Promise<{address: string}>`; `PlatformWalletLabel` (`'admin' | 'operator' | 'relayer' | 'fee_recipient'`); `provisionPlatformWallet(supabase: SupabaseClient, label: PlatformWalletLabel, keyProvider?: KeyEncryptionProvider): Promise<{address: string}>`. Both provision functions default `keyProvider` to `getKeyProvider()` in production but accept an injected one for tests — no `mock.module` needed for this file's tests.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/supabase/service.ts`:

```typescript
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client -- bypasses RLS. Server-only: never import this
 * from a Client Component or anything that could ship it to the browser.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

Create `src/lib/wallet/provision.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { provisionWalletForUser, provisionPlatformWallet } from "@/lib/wallet/provision";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const testKeyProvider: KeyEncryptionProvider = {
  encrypt: async (plaintext) => ({ iv: "iv", authTag: "tag", ciphertext: plaintext, keyVersion: 1 }),
  decrypt: async (payload) => payload.ciphertext,
};

function makeSupabase(options: { existingAddress?: string; selectError?: string; insertError?: string }) {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from: (table: string) => {
      if (table !== "wallets") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => {
                if (options.selectError) return { data: null, error: { message: options.selectError } };
                return {
                  data: options.existingAddress ? { address: options.existingAddress } : null,
                  error: null,
                };
              },
            }),
          }),
        }),
        insert: async (row: Record<string, unknown>) => {
          inserted.push(row);
          if (options.insertError) return { error: { message: options.insertError } };
          return { error: null };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, inserted };
}

describe("provisionWalletForUser", () => {
  it("returns the existing address without inserting when a wallet already exists", async () => {
    const { client, inserted } = makeSupabase({ existingAddress: "0xexisting" });
    const result = await provisionWalletForUser(client, "user-1", testKeyProvider);
    expect(result.address).toBe("0xexisting");
    expect(inserted.length).toBe(0);
  });

  it("generates and stores a new wallet when none exists", async () => {
    const { client, inserted } = makeSupabase({});
    const result = await provisionWalletForUser(client, "user-1", testKeyProvider);
    expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ user_id: "user-1", chain: "avalanche" });
  });

  it("throws when the existence check fails", async () => {
    const { client } = makeSupabase({ selectError: "connection refused" });
    await expect(provisionWalletForUser(client, "user-1", testKeyProvider)).rejects.toThrow(/connection refused/);
  });

  it("throws when the insert fails", async () => {
    const { client } = makeSupabase({ insertError: "unique violation" });
    await expect(provisionWalletForUser(client, "user-1", testKeyProvider)).rejects.toThrow(/unique violation/);
  });
});

describe("provisionPlatformWallet", () => {
  it("generates and stores a new platform wallet keyed by label", async () => {
    const { client, inserted } = makeSupabase({});
    const result = await provisionPlatformWallet(client, "admin", testKeyProvider);
    expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(inserted[0]).toMatchObject({ label: "admin", chain: "avalanche" });
  });

  it("returns the existing address without inserting when a labeled wallet already exists", async () => {
    const { client, inserted } = makeSupabase({ existingAddress: "0xexisting-admin" });
    const result = await provisionPlatformWallet(client, "admin", testKeyProvider);
    expect(result.address).toBe("0xexisting-admin");
    expect(inserted.length).toBe(0);
  });
});
```

Run: `bun test src/lib/wallet/provision.test.ts`
Expected: FAIL — `Cannot find module '@/lib/wallet/provision'`.

- [ ] **Step 2: Implement `provision.ts`**

Create `src/lib/wallet/provision.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateWallet } from "@/lib/wallet/generate-wallet";
import { getKeyProvider } from "@/lib/wallet/app-level-key-provider";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const CHAIN = "avalanche";

async function findOrCreateWallet(
  supabase: SupabaseClient,
  filterColumn: "user_id" | "label",
  filterValue: string,
  keyProvider: KeyEncryptionProvider
): Promise<{ address: string }> {
  const { data: existing, error: selectError } = await supabase
    .from("wallets")
    .select("address")
    .eq(filterColumn, filterValue)
    .eq("chain", CHAIN)
    .maybeSingle();
  if (selectError) {
    throw new Error(
      `Failed to check for an existing wallet (${filterColumn}=${filterValue}): ${selectError.message}`
    );
  }
  if (existing) return { address: existing.address };

  const { address, privateKey } = generateWallet();
  const encryptedPrivateKey = await keyProvider.encrypt(privateKey);

  const { error: insertError } = await supabase.from("wallets").insert({
    [filterColumn]: filterValue,
    chain: CHAIN,
    address,
    encrypted_private_key: encryptedPrivateKey,
  });
  if (insertError) {
    throw new Error(`Failed to store the new wallet (${filterColumn}=${filterValue}): ${insertError.message}`);
  }

  return { address };
}

/** Idempotent: returns the user's existing wallet address for this chain, or generates and stores a new one. */
export async function provisionWalletForUser(
  supabase: SupabaseClient,
  userId: string,
  keyProvider: KeyEncryptionProvider = getKeyProvider()
): Promise<{ address: string }> {
  return findOrCreateWallet(supabase, "user_id", userId, keyProvider);
}

export type PlatformWalletLabel = "admin" | "operator" | "relayer" | "fee_recipient";

/**
 * Idempotent, like provisionWalletForUser but keyed by label -- for the
 * platform's own wallets (admin/operator/relayer/fee recipient), which
 * have no owning user.
 */
export async function provisionPlatformWallet(
  supabase: SupabaseClient,
  label: PlatformWalletLabel,
  keyProvider: KeyEncryptionProvider = getKeyProvider()
): Promise<{ address: string }> {
  return findOrCreateWallet(supabase, "label", label, keyProvider);
}
```

Run: `bun test src/lib/wallet/provision.test.ts`
Expected: PASS — all 6 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/service.ts src/lib/wallet/provision.ts src/lib/wallet/provision.test.ts
git commit -m "feat(wallet): add service-role client and idempotent wallet provisioning"
```

---

### Task 5: Wire `provisionWalletForUser` into signup

**Files:**
- Modify: `src/lib/supabase/actions.ts:26-44` (the `signUp` function)
- Test: `src/lib/supabase/actions.test.ts` (new file)

**Interfaces:**
- Consumes: `provisionWalletForUser` (Task 4), `createServiceClient` (Task 4).
- Produces: no new exports — `signUp`'s existing signature/behavior is unchanged for callers; it now has a side effect (wallet provisioning) for organizer/talent signups.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/supabase/actions.test.ts`:

```typescript
import { describe, expect, it, mock } from "bun:test";

const provisionWalletForUser = mock(async () => ({ address: "0xprovisioned" }));
mock.module("@/lib/wallet/provision", () => ({ provisionWalletForUser }));
mock.module("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));

function makeAuthClient(userId: string | null) {
  return {
    auth: {
      signUp: async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

function signUpFormData(role: string) {
  const formData = new FormData();
  formData.set("email", "test@example.com");
  formData.set("password", "password123");
  formData.set("fullName", "Test User");
  formData.set("role", role);
  return formData;
}

describe("signUp — wallet provisioning", () => {
  it("provisions a wallet for a new organizer", async () => {
    provisionWalletForUser.mockClear();
    mock.module("@/lib/supabase/server", () => ({ createClient: async () => makeAuthClient("user-1") }));
    const { signUp } = await import("@/lib/supabase/actions");

    const result = await signUp(signUpFormData("organizer"));

    expect(result).toEqual({ success: true });
    expect(provisionWalletForUser).toHaveBeenCalledTimes(1);
    expect(provisionWalletForUser.mock.calls[0]?.[1]).toBe("user-1");
  });

  it("does not provision a wallet for an agency signup", async () => {
    provisionWalletForUser.mockClear();
    mock.module("@/lib/supabase/server", () => ({ createClient: async () => makeAuthClient("user-2") }));
    const { signUp } = await import("@/lib/supabase/actions");

    await signUp(signUpFormData("agency"));

    expect(provisionWalletForUser).not.toHaveBeenCalled();
  });

  it("still returns success when wallet provisioning throws", async () => {
    provisionWalletForUser.mockClear();
    provisionWalletForUser.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    mock.module("@/lib/supabase/server", () => ({ createClient: async () => makeAuthClient("user-3") }));
    const { signUp } = await import("@/lib/supabase/actions");

    const result = await signUp(signUpFormData("talent"));

    expect(result).toEqual({ success: true });
  });
});
```

Run: `bun run test`
Expected: FAIL — `provisionWalletForUser` is never called (the `signUp` function doesn't reference it yet), so the first two assertions fail.

- [ ] **Step 2: Wire wallet provisioning into `signUp`**

In `src/lib/supabase/actions.ts`, add imports near the top of the file:

```typescript
import { provisionWalletForUser } from "@/lib/wallet/provision";
import { createServiceClient } from "@/lib/supabase/service";
```

Replace the `signUp` function (currently lines 26-44) with:

```typescript
export async function signUp(formData: FormData): Promise<{ error: string } | { success: true }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  const role = String(formData.get("role") ?? "organizer") as Role;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
      emailRedirectTo: `${SITE_URL}/auth/callback?next=/`,
    },
  });
  if (error) return { error: error.message };

  if ((role === "organizer" || role === "talent") && data.user) {
    // Best-effort: the auth account already exists at this point, and
    // provisionWalletForUser is idempotent, so a transient failure here
    // is recovered the next time it's called rather than failing the
    // whole signup over an auxiliary step.
    try {
      await provisionWalletForUser(createServiceClient(), data.user.id);
    } catch (walletError) {
      console.error(`[signUp] wallet provisioning failed for user ${data.user.id}:`, walletError);
    }
  }

  return { success: true };
}
```

Run: `bun run test`
Expected: PASS — all 3 new tests, and the existing suite unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/actions.ts src/lib/supabase/actions.test.ts
git commit -m "feat(wallet): provision a custodial wallet at organizer/talent signup"
```

---

### Task 6: Export private key (re-authentication-gated)

**Files:**
- Create: `src/lib/wallet/export.ts`
- Create: `src/lib/wallet/actions.ts`
- Test: `src/lib/wallet/export.test.ts`
- Test: `src/lib/wallet/actions.test.ts`

**Interfaces:**
- Consumes: `KeyEncryptionProvider` (Task 2), `createClient` (existing `src/lib/supabase/server.ts`), `createServiceClient` (Task 4).
- Produces: `exportWalletPrivateKeyCore(authClient, serviceClient, keyProvider, password): Promise<{error: string} | {privateKey: string}>` (fully unit-testable core logic); `exportWalletPrivateKey(password: string)` ("use server" wrapper wiring in the real clients, called from the UI).

- [ ] **Step 1: Write the failing core-logic tests**

Create `src/lib/wallet/export.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { exportWalletPrivateKeyCore } from "@/lib/wallet/export";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const testKeyProvider: KeyEncryptionProvider = {
  encrypt: async (plaintext) => ({ iv: "iv", authTag: "tag", ciphertext: plaintext, keyVersion: 1 }),
  decrypt: async (payload) => payload.ciphertext,
};

function makeAuthClient(options: { user?: { id: string; email: string } | null; reauthFails?: boolean }) {
  return {
    auth: {
      getUser: async () => ({ data: { user: options.user ?? null } }),
      signInWithPassword: async () => (options.reauthFails ? { error: { message: "invalid" } } : { error: null }),
    },
  } as never;
}

function makeServiceClient(options: {
  wallet?: { id: string; encrypted_private_key: unknown };
  selectError?: string;
  updateError?: string;
}) {
  const updates: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (options.selectError) return { data: null, error: { message: options.selectError } };
              return { data: options.wallet ?? null, error: null };
            },
          }),
        }),
      }),
      update: (row: Record<string, unknown>) => ({
        eq: async () => {
          updates.push(row);
          return { error: options.updateError ? { message: options.updateError } : null };
        },
      }),
    }),
  };
  return { client: client as never, updates };
}

describe("exportWalletPrivateKeyCore", () => {
  it("rejects when not signed in", async () => {
    const auth = makeAuthClient({ user: null });
    const { client: service } = makeServiceClient({});
    const result = await exportWalletPrivateKeyCore(auth, service, testKeyProvider, "password");
    expect(result).toEqual({ error: "You must be signed in." });
  });

  it("rejects when password re-verification fails", async () => {
    const auth = makeAuthClient({ user: { id: "user-1", email: "a@b.com" }, reauthFails: true });
    const { client: service } = makeServiceClient({});
    const result = await exportWalletPrivateKeyCore(auth, service, testKeyProvider, "wrong-password");
    expect(result).toEqual({ error: "Incorrect password." });
  });

  it("rejects when no wallet exists for the user", async () => {
    const auth = makeAuthClient({ user: { id: "user-1", email: "a@b.com" } });
    const { client: service } = makeServiceClient({ wallet: undefined });
    const result = await exportWalletPrivateKeyCore(auth, service, testKeyProvider, "password");
    expect(result).toEqual({ error: "No wallet found for your account." });
  });

  it("returns the decrypted private key and records exported_at on success", async () => {
    const auth = makeAuthClient({ user: { id: "user-1", email: "a@b.com" } });
    const { client: service, updates } = makeServiceClient({
      wallet: { id: "wallet-1", encrypted_private_key: { ciphertext: "0xrawkey", iv: "iv", authTag: "tag", keyVersion: 1 } },
    });
    const result = await exportWalletPrivateKeyCore(auth, service, testKeyProvider, "password");
    expect(result).toEqual({ privateKey: "0xrawkey" });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toHaveProperty("exported_at");
  });

  it("still returns the private key even if recording exported_at fails", async () => {
    const auth = makeAuthClient({ user: { id: "user-1", email: "a@b.com" } });
    const { client: service } = makeServiceClient({
      wallet: { id: "wallet-1", encrypted_private_key: { ciphertext: "0xrawkey", iv: "iv", authTag: "tag", keyVersion: 1 } },
      updateError: "connection refused",
    });
    const result = await exportWalletPrivateKeyCore(auth, service, testKeyProvider, "password");
    expect(result).toEqual({ privateKey: "0xrawkey" });
  });
});
```

Run: `bun test src/lib/wallet/export.test.ts`
Expected: FAIL — `Cannot find module '@/lib/wallet/export'`.

- [ ] **Step 2: Implement `export.ts`**

Create `src/lib/wallet/export.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const CHAIN = "avalanche";

export async function exportWalletPrivateKeyCore(
  authClient: SupabaseClient,
  serviceClient: SupabaseClient,
  keyProvider: KeyEncryptionProvider,
  password: string
): Promise<{ error: string } | { privateKey: string }> {
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user?.email) return { error: "You must be signed in." };

  // Re-authenticate: confirms this request is really the account
  // holder, not just someone with an unattended open session.
  const { error: reauthError } = await authClient.auth.signInWithPassword({ email: user.email, password });
  if (reauthError) return { error: "Incorrect password." };

  const { data: wallet, error: selectError } = await serviceClient
    .from("wallets")
    .select("id, encrypted_private_key")
    .eq("user_id", user.id)
    .eq("chain", CHAIN)
    .maybeSingle();
  if (selectError) return { error: "Failed to look up your wallet." };
  if (!wallet) return { error: "No wallet found for your account." };

  const privateKey = await keyProvider.decrypt(wallet.encrypted_private_key);

  const { error: updateError } = await serviceClient
    .from("wallets")
    .update({ exported_at: new Date().toISOString() })
    .eq("id", wallet.id);
  if (updateError) {
    console.error(`[exportWalletPrivateKey] failed to record exported_at for wallet ${wallet.id}:`, updateError);
  }

  return { privateKey };
}
```

Run: `bun test src/lib/wallet/export.test.ts`
Expected: PASS — all 5 tests.

- [ ] **Step 3: Write the failing wrapper test**

Create `src/lib/wallet/actions.test.ts`:

```typescript
import { describe, expect, it, mock } from "bun:test";

mock.module("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1", email: "a@b.com" } } }),
      signInWithPassword: async () => ({ error: null }),
    },
  }),
}));
mock.module("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "wallet-1", encrypted_private_key: { ciphertext: "0xrawkey", iv: "iv", authTag: "tag", keyVersion: 1 } },
              error: null,
            }),
          }),
        }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));
mock.module("@/lib/wallet/app-level-key-provider", () => ({
  getKeyProvider: () => ({ decrypt: async (payload: { ciphertext: string }) => payload.ciphertext }),
}));

describe("exportWalletPrivateKey", () => {
  it("wires the real clients into exportWalletPrivateKeyCore and returns its result", async () => {
    const { exportWalletPrivateKey } = await import("@/lib/wallet/actions");
    const result = await exportWalletPrivateKey("password");
    expect(result).toEqual({ privateKey: "0xrawkey" });
  });
});
```

Run: `bun test src/lib/wallet/actions.test.ts`
Expected: FAIL — `Cannot find module '@/lib/wallet/actions'`.

- [ ] **Step 4: Implement the `actions.ts` wrapper**

Create `src/lib/wallet/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getKeyProvider } from "@/lib/wallet/app-level-key-provider";
import { exportWalletPrivateKeyCore } from "@/lib/wallet/export";

export async function exportWalletPrivateKey(
  password: string
): Promise<{ error: string } | { privateKey: string }> {
  const authClient = await createClient();
  return exportWalletPrivateKeyCore(authClient, createServiceClient(), getKeyProvider(), password);
}
```

Run: `bun test src/lib/wallet/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallet/export.ts src/lib/wallet/export.test.ts src/lib/wallet/actions.ts src/lib/wallet/actions.test.ts
git commit -m "feat(wallet): add re-authentication-gated private key export"
```

---

### Task 7: Platform wallet provisioning script + env documentation

**Files:**
- Create: `.env.example` (repo root — did not exist before this task)
- Create: `scripts/provision-platform-wallets.ts`
- Modify: `package.json` (add `"provision-wallets"` script)

**Interfaces:**
- Consumes: `provisionPlatformWallet`, `PlatformWalletLabel` (Task 4), `createServiceClient` (Task 4).
- Produces: a runnable script printing the 4 platform wallet addresses, which feed directly into `contracts/scripts/deploy.ts`'s `ESCROW_ADMIN_ADDRESS`/`ESCROW_OPERATOR_ADDRESS`/`ESCROW_FEE_RECIPIENT_ADDRESS` env vars.

This task has no test file: it's a thin orchestration script over already-tested (Task 4) logic, in the same spirit as `contracts/scripts/deploy.ts` (also untested beyond its extracted `resolveDeployConfig`, which has no equivalent extractable pure-logic piece here — the whole script's job is calling `provisionPlatformWallet` 4 times and printing output).

- [ ] **Step 1: Write the root `.env.example`**

Create `.env.example`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Blockchain escrow payment -- custodial wallet key encryption. Must
# decode (base64) to exactly 32 bytes. See
# docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md
# and .claude/rules/env-secrets.md.
WALLET_MASTER_KEY=
```

- [ ] **Step 2: Write the provisioning script**

Create `scripts/provision-platform-wallets.ts`:

```typescript
import { createServiceClient } from "@/lib/supabase/service";
import { provisionPlatformWallet, type PlatformWalletLabel } from "@/lib/wallet/provision";

const LABELS: PlatformWalletLabel[] = ["admin", "operator", "relayer", "fee_recipient"];

async function main() {
  const supabase = createServiceClient();

  for (const label of LABELS) {
    const { address } = await provisionPlatformWallet(supabase, label);
    console.log(`${label}: ${address}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
```

Add to `package.json`'s `"scripts"`:

```json
"provision-wallets": "bun scripts/provision-platform-wallets.ts"
```

- [ ] **Step 3: Verify by reading, not running**

This script requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `WALLET_MASTER_KEY` against a real Supabase project with Task 1's migration applied — none of which exist in this environment (no live database connection, no `.env` file). Do not attempt to run it. Instead verify by inspection: the imports resolve to real exports from Task 4 (`provisionPlatformWallet`, `PlatformWalletLabel`) and Task 4's service client (`createServiceClient`), the `require.main === module` guard matches the same pattern documented in `.claude/skills/deploying-upgrading-contracts/SKILL.md` (Gotcha 3) for dual-purpose scripts, and `bunx tsc --noEmit` from the repo root reports no errors for this new file.

Run: `bunx tsc --noEmit`
Expected: no errors referencing `scripts/provision-platform-wallets.ts`.

- [ ] **Step 4: Commit**

```bash
git add .env.example scripts/provision-platform-wallets.ts package.json
git commit -m "feat(wallet): add platform wallet provisioning script and env documentation"
```
