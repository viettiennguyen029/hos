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
