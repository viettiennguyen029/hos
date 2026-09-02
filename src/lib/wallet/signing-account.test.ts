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
