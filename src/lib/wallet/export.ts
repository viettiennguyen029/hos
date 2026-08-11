import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const CHAIN = "avalanche";

export async function exportWalletPrivateKeyCore(
  authClient: SupabaseClient,
  serviceClient: SupabaseClient,
  keyProvider: KeyEncryptionProvider,
  password: string
): Promise<{ error: string } | { privateKey: string }> {
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user?.email) return { error: "You must be signed in." };

  // Re-authenticate: confirms this request is really the account
  // holder, not just someone with an unattended open session.
  const { error: reauthError } = await authClient.auth.signInWithPassword({ email: user.email, password });
  if (reauthError) {
    console.error(`[exportWalletPrivateKey] re-authentication failed for user ${user.id}`);
    return { error: "Incorrect password." };
  }

  const { data: wallet, error: selectError } = await serviceClient
    .from("wallets")
    .select("id, encrypted_private_key")
    .eq("user_id", user.id)
    .eq("chain", CHAIN)
    .maybeSingle();
  if (selectError) return { error: "Failed to look up your wallet." };
  if (!wallet) return { error: "No wallet found for your account." };

  const privateKey = await keyProvider.decrypt(wallet.encrypted_private_key);

  const { error: updateError } = await serviceClient
    .from("wallets")
    .update({ exported_at: new Date().toISOString() })
    .eq("id", wallet.id);
  if (updateError) {
    console.error(`[exportWalletPrivateKey] failed to record exported_at for wallet ${wallet.id}:`, updateError);
  }

  console.info(`[exportWalletPrivateKey] key exported for user ${user.id}, wallet ${wallet.id}`);

  return { privateKey };
}
