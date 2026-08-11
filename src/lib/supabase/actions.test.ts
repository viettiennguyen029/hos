import { describe, expect, it, mock } from "bun:test";

const provisionWalletForUser = mock(async (_client: unknown, _userId: string) => ({ address: "0xprovisioned" }));
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
