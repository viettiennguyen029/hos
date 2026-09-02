import { createServiceClient } from "@/lib/supabase/service";
import { provisionPlatformWallet, type PlatformWalletLabel } from "@/lib/wallet/provision";

const LABELS: PlatformWalletLabel[] = ["admin", "operator", "relayer", "fee_recipient"];

async function main() {
  const supabase = createServiceClient();

  for (const label of LABELS) {
    const { address } = await provisionPlatformWallet(supabase, label);
    console.log(`${label}: ${address}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
