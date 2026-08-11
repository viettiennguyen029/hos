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
