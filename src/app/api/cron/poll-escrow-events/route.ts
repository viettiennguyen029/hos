import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pollEscrowEvents } from "@/lib/chain/escrow-indexer";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pollEscrowEvents(createServiceClient());
  return NextResponse.json({ processed: result.processed, toBlock: result.toBlock.toString() });
}
