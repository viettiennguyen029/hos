import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalAccount, WalletClient } from "viem";
import { encodeFunctionData, parseSignature } from "viem";
import { getWalletClient, getPublicClient } from "@/lib/chain/clients";
import { escrowManagerAbi } from "@/lib/chain/abi/escrow-manager";
import { erc20Abi } from "@/lib/chain/abi/erc20";
import { getEscrowManagerAddress, getSettlementTokenPermitVersion } from "@/lib/chain/escrow-config";
import { getSigningAccountForUser, getSigningAccountForPlatformWallet } from "@/lib/wallet/signing-account";
import { getKeyProvider } from "@/lib/wallet/app-level-key-provider";
import { relayAsUser as relayAsUserDefault } from "@/lib/chain/relayer";
import { signPermit } from "@/lib/chain/sign-permit";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const PERMIT_DEADLINE_SECONDS = 3600;

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

interface DepositEscrowDeps extends RelayedCallDeps {
  publicClient?: Pick<ReturnType<typeof getPublicClient>, "readContract" | "chain">;
  walletClientFactory?: (account: LocalAccount) => WalletClient;
  keyProvider?: KeyEncryptionProvider;
}

/**
 * Deposits the organizer's escrow amount. The organizer's spending
 * approval is granted via an EIP-2612 `permit()` (signed off-chain by the
 * organizer's custodial wallet, submitted on-chain directly by the
 * platform's relayer wallet) rather than a relayed ERC20 `approve()` --
 * relaying `approve()` through the ERC2771Forwarder would grant the
 * allowance to the forwarder's own address, not the organizer's, since a
 * plain ERC20 has no concept of a trusted forwarder. `permit()`'s
 * explicit `owner` parameter carries the authorization instead, so who
 * submits the transaction doesn't matter -- the organizer's wallet stays
 * fully gasless.
 */
export async function depositEscrow(
  supabase: SupabaseClient,
  userId: string,
  params: { bookingId: `0x${string}`; tokenAddress: `0x${string}`; organizerAddress: `0x${string}`; amount: bigint },
  deps: DepositEscrowDeps = {}
): Promise<{ permitTxHash: `0x${string}` | null; depositTxHash: `0x${string}` }> {
  const relay = deps.relayAsUser ?? relayAsUserDefault;
  const publicClient = deps.publicClient ?? getPublicClient();
  const walletClientFactory = deps.walletClientFactory ?? getWalletClient;
  const keyProvider = deps.keyProvider ?? getKeyProvider();
  const escrowAddress = getEscrowManagerAddress();

  const allowance = (await publicClient.readContract({
    address: params.tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [params.organizerAddress, escrowAddress],
  })) as bigint;

  let permitTxHash: `0x${string}` | null = null;
  if (allowance < params.amount) {
    const organizerAccount = await getSigningAccountForUser(supabase, userId, keyProvider);

    const nonce = (await publicClient.readContract({
      address: params.tokenAddress,
      abi: erc20Abi,
      functionName: "nonces",
      args: [params.organizerAddress],
    })) as bigint;
    const tokenName = (await publicClient.readContract({
      address: params.tokenAddress,
      abi: erc20Abi,
      functionName: "name",
      args: [],
    })) as string;

    const chainId = publicClient.chain?.id;
    if (!chainId) throw new Error("Public client has no configured chain id");

    const deadline = BigInt(Math.floor(Date.now() / 1000) + PERMIT_DEADLINE_SECONDS);

    const signature = await signPermit(organizerAccount, {
      tokenAddress: params.tokenAddress,
      tokenName,
      tokenVersion: getSettlementTokenPermitVersion(),
      chainId,
      spender: escrowAddress,
      value: params.amount,
      nonce,
      deadline,
    });
    const { r, s, v } = parseSignature(signature);
    if (v === undefined) throw new Error("permit signature has no recovery id");

    const relayerAccount = await getSigningAccountForPlatformWallet(supabase, "relayer", keyProvider);
    const relayerWalletClient = walletClientFactory(relayerAccount);

    permitTxHash = (await relayerWalletClient.writeContract({
      address: params.tokenAddress,
      abi: erc20Abi,
      functionName: "permit",
      args: [params.organizerAddress, escrowAddress, params.amount, deadline, Number(v), r, s],
      chain: publicClient.chain,
      account: relayerAccount,
    })) as `0x${string}`;
  }

  const depositData = encodeFunctionData({
    abi: escrowManagerAbi,
    functionName: "deposit",
    args: [params.bookingId],
  });
  const depositTxHash = await relay(supabase, userId, escrowAddress, depositData);

  return { permitTxHash, depositTxHash };
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
