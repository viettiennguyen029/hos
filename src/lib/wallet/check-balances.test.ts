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
      { label: "admin", address: "0xadmin" },
      { label: "fee_recipient", address: "0xfeerecipient" },
    ]);
    const balances: Record<string, bigint> = {
      "0xrelayer": 1n,
      "0xoperator": 10n ** 18n,
      "0xadmin": 10n ** 18n,
      "0xfeerecipient": 10n ** 18n,
    };
    const publicClient = { getBalance: async ({ address }: { address: string }) => balances[address] };

    const results = await checkPlatformWalletBalances(supabase, publicClient as never, 100n);

    expect(results).toHaveLength(4);
    const relayer = results.find((r) => r.label === "relayer");
    const operator = results.find((r) => r.label === "operator");
    expect(relayer?.belowThreshold).toBe(true);
    expect(operator?.belowThreshold).toBe(false);
  });

  it("throws when a required platform wallet label is missing (never silently reports healthy)", async () => {
    const supabase = makeSupabase([
      { label: "relayer", address: "0xrelayer" },
      { label: "operator", address: "0xoperator" },
    ]);
    const publicClient = { getBalance: async () => 10n ** 18n };

    await expect(checkPlatformWalletBalances(supabase, publicClient as never, 100n)).rejects.toThrow(/admin.*fee_recipient|fee_recipient.*admin/);
  });

  it("throws when no platform wallets exist at all", async () => {
    const supabase = makeSupabase([]);
    const publicClient = { getBalance: async () => 10n ** 18n };

    await expect(checkPlatformWalletBalances(supabase, publicClient as never, 100n)).rejects.toThrow(/admin|operator|relayer|fee_recipient/);
  });
});
