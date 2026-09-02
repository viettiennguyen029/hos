import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkPlatformWalletBalances } from "@/lib/wallet/check-balances";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await checkPlatformWalletBalances(createServiceClient());
  const anyLow = results.some((r) => r.belowThreshold);
  return NextResponse.json(
    { results: results.map((r) => ({ ...r, balanceWei: r.balanceWei.toString() })), anyLow },
    { status: anyLow ? 503 : 200 }
  );
}
