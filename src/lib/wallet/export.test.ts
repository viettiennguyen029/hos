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
