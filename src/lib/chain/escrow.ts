import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalAccount, WalletClient } from "viem";
import { getWalletClient } from "@/lib/chain/clients";
import { escrowManagerAbi } from "@/lib/chain/abi/escrow-manager";
import { getEscrowManagerAddress } from "@/lib/chain/escrow-config";
import { getSigningAccountForPlatformWallet } from "@/lib/wallet/signing-account";
import { getKeyProvider } from "@/lib/wallet/app-level-key-provider";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

interface DirectCallDeps {
  walletClientFactory?: (account: LocalAccount) => WalletClient;
  keyProvider?: KeyEncryptionProvider;
}

export async function registerEscrowBooking(
  supabase: SupabaseClient,
  params: {
    bookingId: `0x${string}`;
    organizerAddress: `0x${string}`;
    talentAddress: `0x${string}`;
    tokenAddress: `0x${string}`;
    amount: bigint;
    feeBps: number;
  },
  deps: DirectCallDeps = {}
): Promise<`0x${string}`> {
  const walletClientFactory = deps.walletClientFactory ?? getWalletClient;
  const keyProvider = deps.keyProvider ?? getKeyProvider();
  const operatorAccount = await getSigningAccountForPlatformWallet(supabase, "operator", keyProvider);
  const client = walletClientFactory(operatorAccount);

  return client.writeContract({
    address: getEscrowManagerAddress(),
    abi: escrowManagerAbi,
    functionName: "registerBooking",
    args: [params.bookingId, params.organizerAddress, params.talentAddress, params.tokenAddress, params.amount, params.feeBps],
    account: operatorAccount,
    chain: null,
  }) as Promise<`0x${string}`>;
}
