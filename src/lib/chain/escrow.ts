import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalAccount, WalletClient } from "viem";
import { encodeFunctionData } from "viem";
import { getWalletClient, getPublicClient } from "@/lib/chain/clients";
import { escrowManagerAbi } from "@/lib/chain/abi/escrow-manager";
import { erc20Abi } from "@/lib/chain/abi/erc20";
import { getEscrowManagerAddress } from "@/lib/chain/escrow-config";
import { getSigningAccountForPlatformWallet } from "@/lib/wallet/signing-account";
import { getKeyProvider } from "@/lib/wallet/app-level-key-provider";
import { relayAsUser as relayAsUserDefault } from "@/lib/chain/relayer";
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

interface RelayedCallDeps {
  relayAsUser?: typeof relayAsUserDefault;
  publicClient?: Pick<ReturnType<typeof getPublicClient>, "readContract">;
}

export async function depositEscrow(
  supabase: SupabaseClient,
  userId: string,
  params: { bookingId: `0x${string}`; tokenAddress: `0x${string}`; organizerAddress: `0x${string}`; amount: bigint },
  deps: RelayedCallDeps = {}
): Promise<{ approveTxHash: `0x${string}` | null; depositTxHash: `0x${string}` }> {
  const relay = deps.relayAsUser ?? relayAsUserDefault;
  const publicClient = deps.publicClient ?? getPublicClient();
  const escrowAddress = getEscrowManagerAddress();

  const allowance = (await publicClient.readContract({
    address: params.tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [params.organizerAddress, escrowAddress],
  })) as bigint;

  let approveTxHash: `0x${string}` | null = null;
  if (allowance < params.amount) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [escrowAddress, params.amount],
    });
    approveTxHash = await relay(supabase, userId, params.tokenAddress, approveData);
  }

  const depositData = encodeFunctionData({
    abi: escrowManagerAbi,
    functionName: "deposit",
    args: [params.bookingId],
  });
  const depositTxHash = await relay(supabase, userId, escrowAddress, depositData);

  return { approveTxHash, depositTxHash };
}

export async function releaseEscrowToTalent(
  supabase: SupabaseClient,
  userId: string,
  bookingId: `0x${string}`,
  deps: RelayedCallDeps = {}
): Promise<`0x${string}`> {
  const relay = deps.relayAsUser ?? relayAsUserDefault;
  const data = encodeFunctionData({ abi: escrowManagerAbi, functionName: "releaseToTalent", args: [bookingId] });
  return relay(supabase, userId, getEscrowManagerAddress(), data);
}

export async function releaseEscrowAsAdmin(
  supabase: SupabaseClient,
  bookingId: `0x${string}`,
  deps: DirectCallDeps = {}
): Promise<`0x${string}`> {
  const walletClientFactory = deps.walletClientFactory ?? getWalletClient;
  const keyProvider = deps.keyProvider ?? getKeyProvider();
  const adminAccount = await getSigningAccountForPlatformWallet(supabase, "admin", keyProvider);
  const client = walletClientFactory(adminAccount);

  return client.writeContract({
    address: getEscrowManagerAddress(),
    abi: escrowManagerAbi,
    functionName: "releaseToTalent",
    args: [bookingId],
    account: adminAccount,
    chain: null,
  }) as Promise<`0x${string}`>;
}

export async function refundEscrowAsAdmin(
  supabase: SupabaseClient,
  bookingId: `0x${string}`,
  deps: DirectCallDeps = {}
): Promise<`0x${string}`> {
  const walletClientFactory = deps.walletClientFactory ?? getWalletClient;
  const keyProvider = deps.keyProvider ?? getKeyProvider();
  const adminAccount = await getSigningAccountForPlatformWallet(supabase, "admin", keyProvider);
  const client = walletClientFactory(adminAccount);

  return client.writeContract({
    address: getEscrowManagerAddress(),
    abi: escrowManagerAbi,
    functionName: "refundOrganizer",
    args: [bookingId],
    account: adminAccount,
    chain: null,
  }) as Promise<`0x${string}`>;
}
