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
