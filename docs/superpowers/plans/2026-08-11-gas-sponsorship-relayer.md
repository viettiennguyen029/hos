# Gas-Sponsorship Relayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the gas-sponsorship relayer — the third of four subsystems in the blockchain escrow payment feature — so an organizer/talent's custodial wallet can sign a contract call without ever holding AVAX, and a platform-owned relayer wallet submits it and pays gas.

**Architecture:** Given `(userId, targetContractAddress, calldata)`, sign an EIP-712 `ForwardRequest` with the user's decrypted custodial key, then submit it through the deployed `ERC2771Forwarder` via the platform's relayer wallet, which pays AVAX gas. The target contract sees the user's own address as `_msgSender()`, never the relayer's — this is the exact mechanism already proven working end-to-end in the contract plan's meta-tx integration test (`contracts/test/EscrowManager.test.ts`, "gas-sponsored meta-transactions"). This plan deliberately stays generic infrastructure — it has no knowledge of `EscrowManager` specifically (no `deposit`/`registerBooking` wiring); that's the next, not-yet-written app-integration plan's job, once this exists.

**Tech Stack:** `viem` (already a dependency from the wallet custody plan — public/wallet clients, `viem/chains`' built-in `avalancheFuji`/`avalanche` definitions, `viem/accounts`' `privateKeyToAccount`), `bun:test`.

## Global Constraints

- Chain selection is controlled by an `AVALANCHE_NETWORK` env var (`'fuji'` default, or `'mainnet'`) — resolves to viem's built-in `avalancheFuji` (chain id 43113) or `avalanche` (chain id 43114) chain objects, matching the chain IDs already used in `contracts/hardhat.config.ts`.
- The EIP-712 domain/types for signing a `ForwardRequest` MUST exactly match what `contracts/test/EscrowManager.test.ts`'s "gas-sponsored meta-transactions" test already proved works against the real deployed `ERC2771Forwarder`: domain `{name: "HosEscrowForwarder", version: "1", chainId, verifyingContract: forwarderAddress}`, type `ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)`. The on-chain `execute()` call's struct has NO `nonce` field (nonce lives only in the signed payload; the contract reads the expected nonce from its own storage) — see `contracts/scripts/deploy.ts` and that same test for the exact shape.
- Every function that decrypts a private key and constructs a signable account (`src/lib/wallet/signing-account.ts`, this plan) is **internal system use only** — clearly documented as such, never exposed as a direct user-facing action. This is distinct from the existing re-authentication-gated `exportWalletPrivateKey` (wallet custody plan), which hands the raw key to its own owner; this plan's functions use the key to sign on the user's behalf for an action the user already initiated through the app, and never return the raw key to any caller.
- Every function that needs a `KeyEncryptionProvider` or a viem client accepts it as an optional injected parameter defaulting to the production singleton — matching the wallet custody plan's established pattern, so tests never need `mock.module` for these dependencies.
- Test mocks for Supabase query builders must record `.eq()` call arguments and assert on them wherever the query is security-relevant (which row gets selected) — the wallet custody plan's final review found tests that didn't do this couldn't catch a wrong-row-query bug. Every task in this plan that mocks a `.eq()` chain follows that corrected pattern from the start.
- TDD: every task starts with a failing test (RED) before implementation (GREEN), per `.claude/rules/tdd.md`. Tests that touch `process.env` must restore it in `afterEach` — this repo's `bun run test` runs the whole suite together (`bun test --isolate`), and `--isolate` resets module mocks per file but not `process.env`, which is genuinely process-global.
- Full design context: `docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md` (Gas-sponsorship relayer section).

---

### Task 1: Chain clients

**Files:**
- Create: `src/lib/chain/clients.ts`
- Test: `src/lib/chain/clients.test.ts`

**Interfaces:**
- Produces: `getPublicClient(): PublicClient`, `getWalletClient(account: Account): WalletClient`.
- Consumes: nothing (first task).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/chain/clients.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getPublicClient, getWalletClient } from "@/lib/chain/clients";

afterEach(() => {
  delete process.env.AVALANCHE_RPC_URL;
  delete process.env.AVALANCHE_NETWORK;
});

describe("getPublicClient", () => {
  it("throws when AVALANCHE_RPC_URL is not set", () => {
    delete process.env.AVALANCHE_RPC_URL;
    expect(() => getPublicClient()).toThrow(/AVALANCHE_RPC_URL/);
  });

  it("throws for an unknown AVALANCHE_NETWORK value", () => {
    process.env.AVALANCHE_RPC_URL = "https://example.com/rpc";
    process.env.AVALANCHE_NETWORK = "not-a-real-network";
    expect(() => getPublicClient()).toThrow(/AVALANCHE_NETWORK/);
  });

  it("defaults to Avalanche Fuji (chain id 43113) when AVALANCHE_NETWORK is unset", () => {
    process.env.AVALANCHE_RPC_URL = "https://example.com/rpc";
    const client = getPublicClient();
    expect(client.chain?.id).toBe(43113);
  });

  it("uses Avalanche mainnet (chain id 43114) when AVALANCHE_NETWORK=mainnet", () => {
    process.env.AVALANCHE_RPC_URL = "https://example.com/rpc";
    process.env.AVALANCHE_NETWORK = "mainnet";
    const client = getPublicClient();
    expect(client.chain?.id).toBe(43114);
  });
});

describe("getWalletClient", () => {
  it("creates a wallet client bound to the given account", () => {
    process.env.AVALANCHE_RPC_URL = "https://example.com/rpc";
    const account = privateKeyToAccount(generatePrivateKey());
    const client = getWalletClient(account);
    expect(client.account?.address).toBe(account.address);
  });
});
```

Run: `bun test src/lib/chain/clients.test.ts`
Expected: FAIL — `Cannot find module '@/lib/chain/clients'`.

- [ ] **Step 2: Implement `clients.ts`**

Create `src/lib/chain/clients.ts`:

```typescript
import { createPublicClient, createWalletClient, http, type Account, type Chain, type PublicClient, type WalletClient } from "viem";
import { avalanche, avalancheFuji } from "viem/chains";

function resolveChain(): Chain {
  const network = process.env.AVALANCHE_NETWORK ?? "fuji";
  if (network === "mainnet") return avalanche;
  if (network === "fuji") return avalancheFuji;
  throw new Error(`Unknown AVALANCHE_NETWORK "${network}" -- expected "fuji" or "mainnet"`);
}

function resolveRpcUrl(): string {
  const url = process.env.AVALANCHE_RPC_URL;
  if (!url) throw new Error("AVALANCHE_RPC_URL is not set");
  return url;
}

export function getPublicClient(): PublicClient {
  return createPublicClient({ chain: resolveChain(), transport: http(resolveRpcUrl()) });
}

export function getWalletClient(account: Account): WalletClient {
  return createWalletClient({ account, chain: resolveChain(), transport: http(resolveRpcUrl()) });
}
```

Run: `bun test src/lib/chain/clients.test.ts`
Expected: PASS — all 5 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chain/clients.ts src/lib/chain/clients.test.ts
git commit -m "feat(chain): add viem public/wallet client factories"
```

---

### Task 2: Forwarder ABI + address config

**Files:**
- Create: `src/lib/chain/forwarder.ts`
- Test: `src/lib/chain/forwarder.test.ts`

**Interfaces:**
- Produces: `forwarderAbi` (viem ABI const — `nonces` and `execute` only), `getForwarderAddress(): \`0x${string}\``.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Create `src/lib/chain/forwarder.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "bun:test";
import { getForwarderAddress } from "@/lib/chain/forwarder";

afterEach(() => {
  delete process.env.FORWARDER_ADDRESS;
});

describe("getForwarderAddress", () => {
  it("throws when FORWARDER_ADDRESS is not set", () => {
    delete process.env.FORWARDER_ADDRESS;
    expect(() => getForwarderAddress()).toThrow(/FORWARDER_ADDRESS/);
  });

  it("returns the configured address", () => {
    process.env.FORWARDER_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa";
    expect(getForwarderAddress()).toBe("0x5FbDB2315678afecb367f032d93F642f64180aa");
  });
});
```

Run: `bun test src/lib/chain/forwarder.test.ts`
Expected: FAIL — `Cannot find module '@/lib/chain/forwarder'`.

- [ ] **Step 2: Implement `forwarder.ts`**

Create `src/lib/chain/forwarder.ts`:

```typescript
/**
 * Minimal ABI slice of OpenZeppelin's ERC2771Forwarder -- only the two
 * functions this app calls. See contracts/node_modules/@openzeppelin/
 * contracts/metatx/ERC2771Forwarder.sol for the full contract.
 */
export const forwarderAbi = [
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

export function getForwarderAddress(): `0x${string}` {
  const address = process.env.FORWARDER_ADDRESS;
  if (!address) throw new Error("FORWARDER_ADDRESS is not set");
  return address as `0x${string}`;
}
```

Run: `bun test src/lib/chain/forwarder.test.ts`
Expected: PASS — both tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chain/forwarder.ts src/lib/chain/forwarder.test.ts
git commit -m "feat(chain): add ERC2771Forwarder ABI and address config"
```

---

### Task 3: EIP-712 `ForwardRequest` signing helper

**Files:**
- Create: `src/lib/chain/sign-forward-request.ts`
- Test: `src/lib/chain/sign-forward-request.test.ts`

**Interfaces:**
- Produces: `ForwardRequestCore` (`{from, to, value, gas, deadline}`), `signForwardRequest(account, params): Promise<\`0x${string}\`>`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/chain/sign-forward-request.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyTypedData } from "viem";
import { signForwardRequest } from "@/lib/chain/sign-forward-request";

const FORWARDER_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa" as const;
const TO_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const CHAIN_ID = 43113;

const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
} as const;

describe("signForwardRequest", () => {
  it("produces a signature that verifies against the same typed data via viem's verifyTypedData", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const requestCore = {
      from: account.address,
      to: TO_ADDRESS,
      value: 0n,
      gas: 500_000n,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    };
    const nonce = 0n;
    const data = "0xabcdef" as const;

    const signature = await signForwardRequest(account, {
      forwarderAddress: FORWARDER_ADDRESS,
      chainId: CHAIN_ID,
      requestCore,
      nonce,
      data,
    });

    const isValid = await verifyTypedData({
      address: account.address,
      domain: { name: "HosEscrowForwarder", version: "1", chainId: CHAIN_ID, verifyingContract: FORWARDER_ADDRESS },
      types: FORWARD_REQUEST_TYPES,
      primaryType: "ForwardRequest",
      message: { ...requestCore, nonce, data },
      signature,
    });

    expect(isValid).toBe(true);
  });

  it("produces a different signature for a different signer", async () => {
    const accountA = privateKeyToAccount(generatePrivateKey());
    const accountB = privateKeyToAccount(generatePrivateKey());
    const requestCore = {
      from: accountA.address,
      to: TO_ADDRESS,
      value: 0n,
      gas: 500_000n,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    };
    const sigA = await signForwardRequest(accountA, { forwarderAddress: FORWARDER_ADDRESS, chainId: CHAIN_ID, requestCore, nonce: 0n, data: "0x" });
    const sigB = await signForwardRequest(accountB, { forwarderAddress: FORWARDER_ADDRESS, chainId: CHAIN_ID, requestCore, nonce: 0n, data: "0x" });
    expect(sigA).not.toBe(sigB);
  });

  it("produces a different signature for a different nonce", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const requestCore = {
      from: account.address,
      to: TO_ADDRESS,
      value: 0n,
      gas: 500_000n,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    };
    const sig0 = await signForwardRequest(account, { forwarderAddress: FORWARDER_ADDRESS, chainId: CHAIN_ID, requestCore, nonce: 0n, data: "0x" });
    const sig1 = await signForwardRequest(account, { forwarderAddress: FORWARDER_ADDRESS, chainId: CHAIN_ID, requestCore, nonce: 1n, data: "0x" });
    expect(sig0).not.toBe(sig1);
  });
});
```

Run: `bun test src/lib/chain/sign-forward-request.test.ts`
Expected: FAIL — `Cannot find module '@/lib/chain/sign-forward-request'`.

- [ ] **Step 2: Implement `sign-forward-request.ts`**

Create `src/lib/chain/sign-forward-request.ts`:

```typescript
import type { LocalAccount } from "viem/accounts";

export interface ForwardRequestCore {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  gas: bigint;
  deadline: number;
}

const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
} as const;

/**
 * Signs an EIP-712 ForwardRequest for OpenZeppelin's ERC2771Forwarder.
 * Domain name/version and the type definition here MUST match
 * contracts/test/EscrowManager.test.ts's "gas-sponsored
 * meta-transactions" test exactly -- that test proves this shape against
 * the real deployed forwarder.
 */
export async function signForwardRequest(
  account: LocalAccount,
  params: {
    forwarderAddress: `0x${string}`;
    chainId: number;
    requestCore: ForwardRequestCore;
    nonce: bigint;
    data: `0x${string}`;
  }
): Promise<`0x${string}`> {
  return account.signTypedData({
    domain: {
      name: "HosEscrowForwarder",
      version: "1",
      chainId: params.chainId,
      verifyingContract: params.forwarderAddress,
    },
    types: FORWARD_REQUEST_TYPES,
    primaryType: "ForwardRequest",
    message: {
      ...params.requestCore,
      nonce: params.nonce,
      data: params.data,
    },
  });
}
```

Run: `bun test src/lib/chain/sign-forward-request.test.ts`
Expected: PASS — all 3 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chain/sign-forward-request.ts src/lib/chain/sign-forward-request.test.ts
git commit -m "feat(chain): add EIP-712 ForwardRequest signing helper"
```

---

### Task 4: Internal wallet signing account resolver

**Files:**
- Create: `src/lib/wallet/signing-account.ts`
- Test: `src/lib/wallet/signing-account.test.ts`

**Interfaces:**
- Consumes: `KeyEncryptionProvider`, `getKeyProvider` (wallet custody plan), `PlatformWalletLabel` (wallet custody plan's `src/lib/wallet/provision.ts`).
- Produces: `getSigningAccountForUser(supabase, userId, keyProvider?): Promise<LocalAccount>`, `getSigningAccountForPlatformWallet(supabase, label, keyProvider?): Promise<LocalAccount>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/wallet/signing-account.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSigningAccountForUser, getSigningAccountForPlatformWallet } from "@/lib/wallet/signing-account";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const REAL_PRIVATE_KEY = generatePrivateKey();
const REAL_ADDRESS = privateKeyToAccount(REAL_PRIVATE_KEY).address;

const testKeyProvider: KeyEncryptionProvider = {
  encrypt: async (plaintext) => ({ iv: "iv", authTag: "tag", ciphertext: plaintext, keyVersion: 1 }),
  decrypt: async (payload) => payload.ciphertext,
};

function makeSupabase(options: { wallet?: { encrypted_private_key: unknown }; selectError?: string }) {
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
                  maybeSingle: async () => {
                    if (options.selectError) return { data: null, error: { message: options.selectError } };
                    return { data: options.wallet ?? null, error: null };
                  },
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

describe("getSigningAccountForUser", () => {
  it("returns a signable account matching the decrypted private key", async () => {
    const { client, eqCalls } = makeSupabase({ wallet: { encrypted_private_key: { ciphertext: REAL_PRIVATE_KEY } } });
    const account = await getSigningAccountForUser(client, "user-1", testKeyProvider);
    expect(account.address).toBe(REAL_ADDRESS);
    expect(eqCalls).toEqual([["user_id", "user-1"], ["chain", "avalanche"]]);
  });

  it("throws when no wallet is found", async () => {
    const { client } = makeSupabase({});
    await expect(getSigningAccountForUser(client, "user-1", testKeyProvider)).rejects.toThrow(/No wallet found/);
  });

  it("throws when the lookup fails", async () => {
    const { client } = makeSupabase({ selectError: "connection refused" });
    await expect(getSigningAccountForUser(client, "user-1", testKeyProvider)).rejects.toThrow(/connection refused/);
  });
});

describe("getSigningAccountForPlatformWallet", () => {
  it("filters by label instead of user_id", async () => {
    const { client, eqCalls } = makeSupabase({ wallet: { encrypted_private_key: { ciphertext: REAL_PRIVATE_KEY } } });
    const account = await getSigningAccountForPlatformWallet(client, "relayer", testKeyProvider);
    expect(account.address).toBe(REAL_ADDRESS);
    expect(eqCalls).toEqual([["label", "relayer"], ["chain", "avalanche"]]);
  });
});
```

Run: `bun test src/lib/wallet/signing-account.test.ts`
Expected: FAIL — `Cannot find module '@/lib/wallet/signing-account'`.

- [ ] **Step 2: Implement `signing-account.ts`**

Create `src/lib/wallet/signing-account.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { privateKeyToAccount, type LocalAccount } from "viem/accounts";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";
import { getKeyProvider } from "@/lib/wallet/app-level-key-provider";
import type { PlatformWalletLabel } from "@/lib/wallet/provision";

const CHAIN = "avalanche";

/**
 * Decrypts a stored wallet's private key and returns a signable viem
 * account. INTERNAL SYSTEM USE ONLY -- for the backend to sign on a
 * user's behalf for an action they initiated through the app (e.g. a
 * relayed deposit). Never expose this as a direct user-facing action or
 * return the account/key it wraps to any caller outside this module's
 * consumers. For the user's own key export, see src/lib/wallet/export.ts
 * (re-authentication-gated, returns the raw key to its owner instead of
 * using it to sign).
 */
async function resolveSigningAccount(
  supabase: SupabaseClient,
  filterColumn: "user_id" | "label",
  filterValue: string,
  keyProvider: KeyEncryptionProvider
): Promise<LocalAccount> {
  const { data: wallet, error } = await supabase
    .from("wallets")
    .select("encrypted_private_key")
    .eq(filterColumn, filterValue)
    .eq("chain", CHAIN)
    .maybeSingle();
  if (error) throw new Error(`Failed to look up wallet (${filterColumn}=${filterValue}): ${error.message}`);
  if (!wallet) throw new Error(`No wallet found (${filterColumn}=${filterValue})`);

  const privateKey = await keyProvider.decrypt(wallet.encrypted_private_key);
  return privateKeyToAccount(privateKey as `0x${string}`);
}

export async function getSigningAccountForUser(
  supabase: SupabaseClient,
  userId: string,
  keyProvider: KeyEncryptionProvider = getKeyProvider()
): Promise<LocalAccount> {
  return resolveSigningAccount(supabase, "user_id", userId, keyProvider);
}

export async function getSigningAccountForPlatformWallet(
  supabase: SupabaseClient,
  label: PlatformWalletLabel,
  keyProvider: KeyEncryptionProvider = getKeyProvider()
): Promise<LocalAccount> {
  return resolveSigningAccount(supabase, "label", label, keyProvider);
}
```

Run: `bun test src/lib/wallet/signing-account.test.ts`
Expected: PASS — all 4 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wallet/signing-account.ts src/lib/wallet/signing-account.test.ts
git commit -m "feat(wallet): add internal signing-account resolver for system-initiated signing"
```

---

### Task 5: `relayAsUser` orchestration

**Files:**
- Create: `src/lib/chain/relayer.ts`
- Test: `src/lib/chain/relayer.test.ts`

**Interfaces:**
- Consumes: `getPublicClient`, `getWalletClient` (Task 1); `forwarderAbi`, `getForwarderAddress` (Task 2); `signForwardRequest` (Task 3); `getSigningAccountForUser`, `getSigningAccountForPlatformWallet` (Task 4).
- Produces: `relayAsUser(supabase, userId, to, data, deps?): Promise<\`0x${string}\`>` — returns the submitted transaction hash.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/chain/relayer.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount, type LocalAccount } from "viem/accounts";
import { relayAsUser } from "@/lib/chain/relayer";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const USER_PRIVATE_KEY = generatePrivateKey();
const USER_ADDRESS = privateKeyToAccount(USER_PRIVATE_KEY).address;
const RELAYER_PRIVATE_KEY = generatePrivateKey();
const RELAYER_ADDRESS = privateKeyToAccount(RELAYER_PRIVATE_KEY).address;
const TO_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const FORWARDER_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa" as const;

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
                  maybeSingle: async () => {
                    if (col === "user_id") {
                      return { data: { encrypted_private_key: { ciphertext: USER_PRIVATE_KEY } }, error: null };
                    }
                    return { data: { encrypted_private_key: { ciphertext: RELAYER_PRIVATE_KEY } }, error: null };
                  },
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

describe("relayAsUser", () => {
  it("signs with the user's account, submits with the relayer's account, and returns the tx hash", async () => {
    const { client } = makeSupabase();

    process.env.FORWARDER_ADDRESS = FORWARDER_ADDRESS;

    let readContractArgs: unknown;
    const publicClient = {
      chain: { id: 43113 },
      readContract: async (args: unknown) => {
        readContractArgs = args;
        return 0n; // nonce
      },
    };

    let writeContractArgs: unknown;
    let writeContractSignerAddress: string | undefined;
    const walletClientFactory = (account: LocalAccount) => {
      writeContractSignerAddress = account.address;
      return {
        writeContract: async (args: unknown) => {
          writeContractArgs = args;
          return "0xtxhash" as const;
        },
      };
    };

    const txHash = await relayAsUser(client, "user-1", TO_ADDRESS, "0xabcdef", {
      publicClient: publicClient as never,
      walletClientFactory: walletClientFactory as never,
      keyProvider: testKeyProvider,
    });

    expect(txHash).toBe("0xtxhash");
    expect(writeContractSignerAddress).toBe(RELAYER_ADDRESS);
    expect((readContractArgs as { args: string[] }).args).toEqual([USER_ADDRESS]);

    const request = (writeContractArgs as { args: [{ from: string; to: string; data: string; signature: string }] }).args[0];
    expect(request.from).toBe(USER_ADDRESS);
    expect(request.to).toBe(TO_ADDRESS);
    expect(request.data).toBe("0xabcdef");
    expect(request.signature).toMatch(/^0x[a-fA-F0-9]{130}$/);

    delete process.env.FORWARDER_ADDRESS;
  });
});
```

Run: `bun test src/lib/chain/relayer.test.ts`
Expected: FAIL — `Cannot find module '@/lib/chain/relayer'`.

- [ ] **Step 2: Implement `relayer.ts`**

Create `src/lib/chain/relayer.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalAccount, PublicClient, WalletClient } from "viem";
import { getPublicClient, getWalletClient } from "@/lib/chain/clients";
import { forwarderAbi, getForwarderAddress } from "@/lib/chain/forwarder";
import { signForwardRequest } from "@/lib/chain/sign-forward-request";
import { getSigningAccountForUser, getSigningAccountForPlatformWallet } from "@/lib/wallet/signing-account";
import { getKeyProvider } from "@/lib/wallet/app-level-key-provider";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const DEADLINE_SECONDS = 3600;
const DEFAULT_GAS = 500_000n;

/**
 * Signs `data` as a meta-transaction on behalf of `userId`'s custodial
 * wallet, then submits it via the platform's relayer wallet (which pays
 * AVAX gas) through the trusted ERC2771Forwarder. The target contract
 * sees the user's own address as _msgSender(), never the relayer's.
 */
export async function relayAsUser(
  supabase: SupabaseClient,
  userId: string,
  to: `0x${string}`,
  data: `0x${string}`,
  deps: {
    publicClient?: PublicClient;
    walletClientFactory?: (account: LocalAccount) => WalletClient;
    keyProvider?: KeyEncryptionProvider;
  } = {}
): Promise<`0x${string}`> {
  const forwarderAddress = getForwarderAddress();
  const publicClient = deps.publicClient ?? getPublicClient();
  const walletClientFactory = deps.walletClientFactory ?? getWalletClient;
  const keyProvider = deps.keyProvider ?? getKeyProvider();

  const userAccount = await getSigningAccountForUser(supabase, userId, keyProvider);
  const nonce = (await publicClient.readContract({
    address: forwarderAddress,
    abi: forwarderAbi,
    functionName: "nonces",
    args: [userAccount.address],
  })) as bigint;

  const chainId = publicClient.chain?.id;
  if (!chainId) throw new Error("Public client has no configured chain id");

  const requestCore = {
    from: userAccount.address,
    to,
    value: 0n,
    gas: DEFAULT_GAS,
    deadline: Math.floor(Date.now() / 1000) + DEADLINE_SECONDS,
  };

  const signature = await signForwardRequest(userAccount, {
    forwarderAddress,
    chainId,
    requestCore,
    nonce,
    data,
  });

  const relayerAccount = await getSigningAccountForPlatformWallet(supabase, "relayer", keyProvider);
  const relayerWalletClient = walletClientFactory(relayerAccount);

  return relayerWalletClient.writeContract({
    address: forwarderAddress,
    abi: forwarderAbi,
    functionName: "execute",
    args: [{ ...requestCore, data, signature }],
    chain: publicClient.chain,
    account: relayerAccount,
  }) as Promise<`0x${string}`>;
}
```

Run: `bun test src/lib/chain/relayer.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chain/relayer.ts src/lib/chain/relayer.test.ts
git commit -m "feat(chain): add relayAsUser gas-sponsored meta-transaction orchestration"
```

---

### Task 6: Platform wallet balance monitoring

**Files:**
- Create: `src/lib/wallet/check-balances.ts`
- Create: `src/app/api/cron/check-relayer-balance/route.ts`
- Modify: `vercel.json` (add cron schedule)
- Modify: `.env.example` (add `AVALANCHE_RPC_URL`, `AVALANCHE_NETWORK`, `FORWARDER_ADDRESS`, `CRON_SECRET`)
- Test: `src/lib/wallet/check-balances.test.ts`

**Interfaces:**
- Consumes: `PlatformWalletLabel` (wallet custody plan), `getPublicClient` (Task 1), `createServiceClient` (wallet custody plan).
- Produces: `WalletBalanceStatus` (`{label, address, balanceWei, belowThreshold}`), `checkPlatformWalletBalances(supabase, publicClient?, thresholdWei?): Promise<WalletBalanceStatus[]>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/wallet/check-balances.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkPlatformWalletBalances } from "@/lib/wallet/check-balances";

function makeSupabase(wallets: { label: string; address: string }[]) {
  return {
    from: (table: string) => {
      if (table !== "wallets") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          in: () => ({
            eq: async () => ({ data: wallets, error: null }),
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
}

describe("checkPlatformWalletBalances", () => {
  it("flags a wallet below the threshold and not the ones above it", async () => {
    const supabase = makeSupabase([
      { label: "relayer", address: "0xrelayer" },
      { label: "operator", address: "0xoperator" },
    ]);
    const balances: Record<string, bigint> = { "0xrelayer": 1n, "0xoperator": 10n ** 18n };
    const publicClient = { getBalance: async ({ address }: { address: string }) => balances[address] };

    const results = await checkPlatformWalletBalances(supabase, publicClient as never, 100n);

    expect(results).toHaveLength(2);
    const relayer = results.find((r) => r.label === "relayer");
    const operator = results.find((r) => r.label === "operator");
    expect(relayer?.belowThreshold).toBe(true);
    expect(operator?.belowThreshold).toBe(false);
  });
});
```

Run: `bun test src/lib/wallet/check-balances.test.ts`
Expected: FAIL — `Cannot find module '@/lib/wallet/check-balances'`.

- [ ] **Step 2: Implement `check-balances.ts`**

Create `src/lib/wallet/check-balances.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicClient } from "@/lib/chain/clients";
import type { PlatformWalletLabel } from "@/lib/wallet/provision";

const LABELS: PlatformWalletLabel[] = ["admin", "operator", "relayer", "fee_recipient"];
const CHAIN = "avalanche";
const DEFAULT_THRESHOLD_WEI = 10n ** 16n; // 0.01 AVAX

export interface WalletBalanceStatus {
  label: string;
  address: string;
  balanceWei: bigint;
  belowThreshold: boolean;
}

export async function checkPlatformWalletBalances(
  supabase: SupabaseClient,
  publicClient: Pick<ReturnType<typeof getPublicClient>, "getBalance"> = getPublicClient(),
  thresholdWei: bigint = DEFAULT_THRESHOLD_WEI
): Promise<WalletBalanceStatus[]> {
  const { data: wallets, error } = await supabase.from("wallets").select("label, address").in("label", LABELS).eq("chain", CHAIN);
  if (error) throw new Error(`Failed to list platform wallets: ${error.message}`);

  const results: WalletBalanceStatus[] = [];
  for (const wallet of wallets ?? []) {
    const balanceWei = await publicClient.getBalance({ address: wallet.address as `0x${string}` });
    const belowThreshold = balanceWei < thresholdWei;
    if (belowThreshold) {
      console.warn(
        `[checkPlatformWalletBalances] ${wallet.label} wallet (${wallet.address}) balance ${balanceWei} wei is below threshold ${thresholdWei} wei`
      );
    }
    results.push({ label: wallet.label, address: wallet.address, balanceWei, belowThreshold });
  }
  return results;
}
```

Run: `bun test src/lib/wallet/check-balances.test.ts`
Expected: PASS.

- [ ] **Step 3: Add the cron route**

Create `src/app/api/cron/check-relayer-balance/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkPlatformWalletBalances } from "@/lib/wallet/check-balances";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await checkPlatformWalletBalances(createServiceClient());
  const anyLow = results.some((r) => r.belowThreshold);
  return NextResponse.json(
    { results: results.map((r) => ({ ...r, balanceWei: r.balanceWei.toString() })), anyLow },
    { status: anyLow ? 503 : 200 }
  );
}
```

Add a `crons` array to `vercel.json`:

```json
{
  "installCommand": "bun install --frozen-lockfile",
  "buildCommand": "bun run build",
  "crons": [
    {
      "path": "/api/cron/check-relayer-balance",
      "schedule": "0 * * * *"
    }
  ]
}
```

Add to `.env.example`, in a new section:

```
# Blockchain escrow payment -- chain connectivity and gas sponsorship.
AVALANCHE_RPC_URL=
AVALANCHE_NETWORK=fuji
FORWARDER_ADDRESS=
# Bearer token Vercel Cron must present to trigger /api/cron/check-relayer-balance.
CRON_SECRET=
```

Run: `bunx tsc --noEmit`
Expected: no errors referencing the new route file.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wallet/check-balances.ts src/lib/wallet/check-balances.test.ts src/app/api/cron/check-relayer-balance/route.ts vercel.json .env.example
git commit -m "feat(wallet): add platform wallet balance monitoring cron"
```
