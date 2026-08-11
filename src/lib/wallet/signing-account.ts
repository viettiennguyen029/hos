import type { SupabaseClient } from "@supabase/supabase-js";
import { privateKeyToAccount, type LocalAccount } from "viem/accounts";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";
import { getKeyProvider } from "@/lib/wallet/app-level-key-provider";
import type { PlatformWalletLabel } from "@/lib/wallet/provision";

const CHAIN = "avalanche";

/**
 * Decrypts a stored wallet's private key and returns a signable viem
 * account. INTERNAL SYSTEM USE ONLY -- for the backend to sign on a
 * user's behalf for an action they initiated through the app (e.g. a
 * relayed deposit). Never expose this as a direct user-facing action or
 * return the account/key it wraps to any caller outside this module's
 * consumers. For the user's own key export, see src/lib/wallet/export.ts
 * (re-authentication-gated, returns the raw key to its owner instead of
 * using it to sign).
 */
async function resolveSigningAccount(
  supabase: SupabaseClient,
  filterColumn: "user_id" | "label",
  filterValue: string,
  keyProvider: KeyEncryptionProvider
): Promise<LocalAccount> {
  const { data: wallet, error } = await supabase
    .from("wallets")
    .select("encrypted_private_key")
    .eq(filterColumn, filterValue)
    .eq("chain", CHAIN)
    .maybeSingle();
  if (error) throw new Error(`Failed to look up wallet (${filterColumn}=${filterValue}): ${error.message}`);
  if (!wallet) throw new Error(`No wallet found (${filterColumn}=${filterValue})`);

  const privateKey = await keyProvider.decrypt(wallet.encrypted_private_key);
  return privateKeyToAccount(privateKey as `0x${string}`);
}

export async function getSigningAccountForUser(
  supabase: SupabaseClient,
  userId: string,
  keyProvider: KeyEncryptionProvider = getKeyProvider()
): Promise<LocalAccount> {
  return resolveSigningAccount(supabase, "user_id", userId, keyProvider);
}

export async function getSigningAccountForPlatformWallet(
  supabase: SupabaseClient,
  label: PlatformWalletLabel,
  keyProvider: KeyEncryptionProvider = getKeyProvider()
): Promise<LocalAccount> {
  return resolveSigningAccount(supabase, "label", label, keyProvider);
}
