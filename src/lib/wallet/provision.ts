import type { SupabaseClient } from "@supabase/supabase-js";
import { generateWallet } from "@/lib/wallet/generate-wallet";
import { getKeyProvider } from "@/lib/wallet/app-level-key-provider";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const CHAIN = "avalanche";

async function findOrCreateWallet(
  supabase: SupabaseClient,
  filterColumn: "user_id" | "label",
  filterValue: string,
  keyProvider: KeyEncryptionProvider
): Promise<{ address: string }> {
  const { data: existing, error: selectError } = await supabase
    .from("wallets")
    .select("address")
    .eq(filterColumn, filterValue)
    .eq("chain", CHAIN)
    .maybeSingle();
  if (selectError) {
    throw new Error(
      `Failed to check for an existing wallet (${filterColumn}=${filterValue}): ${selectError.message}`
    );
  }
  if (existing) return { address: existing.address };

  const { address, privateKey } = generateWallet();
  const encryptedPrivateKey = await keyProvider.encrypt(privateKey);

  const { error: insertError } = await supabase.from("wallets").insert({
    [filterColumn]: filterValue,
    chain: CHAIN,
    address,
    encrypted_private_key: encryptedPrivateKey,
  });
  if (insertError) {
    throw new Error(`Failed to store the new wallet (${filterColumn}=${filterValue}): ${insertError.message}`);
  }

  return { address };
}

/** Idempotent: returns the user's existing wallet address for this chain, or generates and stores a new one. */
export async function provisionWalletForUser(
  supabase: SupabaseClient,
  userId: string,
  keyProvider: KeyEncryptionProvider = getKeyProvider()
): Promise<{ address: string }> {
  return findOrCreateWallet(supabase, "user_id", userId, keyProvider);
}

export type PlatformWalletLabel = "admin" | "operator" | "relayer" | "fee_recipient";

/**
 * Idempotent, like provisionWalletForUser but keyed by label -- for the
 * platform's own wallets (admin/operator/relayer/fee recipient), which
 * have no owning user.
 */
export async function provisionPlatformWallet(
  supabase: SupabaseClient,
  label: PlatformWalletLabel,
  keyProvider: KeyEncryptionProvider = getKeyProvider()
): Promise<{ address: string }> {
  return findOrCreateWallet(supabase, "label", label, keyProvider);
}
