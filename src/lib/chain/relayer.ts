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
 *
 * @remarks This function performs NO authorization checks -- it will sign
 * and relay any calldata to any contract as any user. Callers MUST
 * authorize the (userId, to, data) combination themselves before calling
 * this -- e.g. verifying the authenticated user matches userId, and that
 * the calldata represents an action that user is actually allowed to take,
 * before ever reaching this function.
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
