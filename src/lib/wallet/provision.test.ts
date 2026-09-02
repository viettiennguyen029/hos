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
                    return {
                      data: options.existingAddress ? { address: options.existingAddress } : null,
                      error: null,
                    };
                  },
                };
              },
            };
          },
        }),
        insert: async (row: Record<string, unknown>) => {
          inserted.push(row);
          if (options.insertError) return { error: { message: options.insertError } };
          return { error: null };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, inserted, eqCalls };
}

describe("provisionWalletForUser", () => {
  it("returns the existing address without inserting when a wallet already exists", async () => {
    const { client, inserted, eqCalls } = makeSupabase({ existingAddress: "0xexisting" });
    const result = await provisionWalletForUser(client, "user-1", testKeyProvider);
    expect(result.address).toBe("0xexisting");
    expect(inserted.length).toBe(0);
    expect(eqCalls).toEqual([["user_id", "user-1"], ["chain", "avalanche"]]);
  });

  it("generates and stores a new wallet when none exists", async () => {
    const { client, inserted, eqCalls } = makeSupabase({});
    const result = await provisionWalletForUser(client, "user-1", testKeyProvider);
    expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ user_id: "user-1", chain: "avalanche" });
    expect(eqCalls).toEqual([["user_id", "user-1"], ["chain", "avalanche"]]);
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
    const { client, inserted, eqCalls } = makeSupabase({});
    const result = await provisionPlatformWallet(client, "admin", testKeyProvider);
    expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(inserted[0]).toMatchObject({ label: "admin", chain: "avalanche" });
    expect(eqCalls).toEqual([["label", "admin"], ["chain", "avalanche"]]);
  });

  it("returns the existing address without inserting when a labeled wallet already exists", async () => {
    const { client, inserted, eqCalls } = makeSupabase({ existingAddress: "0xexisting-admin" });
    const result = await provisionPlatformWallet(client, "admin", testKeyProvider);
    expect(result.address).toBe("0xexisting-admin");
    expect(inserted.length).toBe(0);
    expect(eqCalls).toEqual([["label", "admin"], ["chain", "avalanche"]]);
  });
});
