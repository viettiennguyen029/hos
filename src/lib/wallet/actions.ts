"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getKeyProvider } from "@/lib/wallet/app-level-key-provider";
import { exportWalletPrivateKeyCore } from "@/lib/wallet/export";

export async function exportWalletPrivateKey(
  password: string
): Promise<{ error: string } | { privateKey: string }> {
  const authClient = await createClient();
  return exportWalletPrivateKeyCore(authClient, createServiceClient(), getKeyProvider(), password);
}
