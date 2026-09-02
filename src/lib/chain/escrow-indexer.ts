import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicClient } from "@/lib/chain/clients";
import { escrowManagerAbi } from "@/lib/chain/abi/escrow-manager";
import { getEscrowManagerAddress } from "@/lib/chain/escrow-config";

const EVENT_NAMES = ["BookingRegistered", "Deposited", "Released", "Refunded"] as const;

const EVENT_TO_STATE: Record<string, string> = {
  BookingRegistered: "registered",
  Deposited: "funded",
  Released: "released",
  Refunded: "refunded",
};

const EVENT_TO_TYPE: Record<string, string> = {
  BookingRegistered: "registered",
  Deposited: "deposited",
  Released: "released",
  Refunded: "refunded",
};

export async function pollEscrowEvents(
  supabase: SupabaseClient,
  publicClient: Pick<ReturnType<typeof getPublicClient>, "getLogs" | "getBlockNumber"> = getPublicClient()
): Promise<{ processed: number; toBlock: bigint }> {
  const { data: cursor, error: cursorError } = await supabase
    .from("escrow_indexer_state")
    .select("last_processed_block")
    .eq("id", true)
    .single();
  if (cursorError) throw new Error(`Failed to read indexer cursor: ${cursorError.message}`);

  const fromBlock = BigInt(cursor.last_processed_block) + 1n;
  const toBlock = await publicClient.getBlockNumber();
  if (fromBlock > toBlock) return { processed: 0, toBlock };

  const address = getEscrowManagerAddress();
  let processed = 0;

  for (const eventName of EVENT_NAMES) {
    const eventAbiItem = escrowManagerAbi.find((item) => item.type === "event" && item.name === eventName);
    const logs = await publicClient.getLogs({
      address,
      event: eventAbiItem as never,
      fromBlock,
      toBlock,
    }) as Array<{ args?: { bookingId?: `0x${string}` }; transactionHash: `0x${string}`; blockNumber: bigint }>;

    for (const log of logs) {
      const bookingIdHex = (log.args as { bookingId: `0x${string}` }).bookingId;
      const { data: booking, error: bookingError } = await supabase
        .from("package_bookings")
        .select("id")
        .eq("escrow_booking_id", bookingIdHex)
        .maybeSingle();
      if (bookingError) throw new Error(`Failed to look up booking for event ${eventName}: ${bookingError.message}`);
      if (!booking) {
        console.warn(`[pollEscrowEvents] no booking found for escrow_booking_id ${bookingIdHex} (event ${eventName})`);
        continue;
      }

      const { error: insertError } = await supabase.from("escrow_events").insert({
        booking_id: booking.id,
        event_type: EVENT_TO_TYPE[eventName],
        tx_hash: log.transactionHash,
        block_number: Number(log.blockNumber),
      });
      if (insertError) throw new Error(`Failed to record escrow event: ${insertError.message}`);

      const { error: updateError } = await supabase
        .from("package_bookings")
        .update({ escrow_state: EVENT_TO_STATE[eventName] })
        .eq("id", booking.id);
      if (updateError) throw new Error(`Failed to update booking escrow_state: ${updateError.message}`);

      processed += 1;
    }
  }

  const { error: cursorUpdateError } = await supabase
    .from("escrow_indexer_state")
    .update({ last_processed_block: Number(toBlock) })
    .eq("id", true);
  if (cursorUpdateError) throw new Error(`Failed to update indexer cursor: ${cursorUpdateError.message}`);

  return { processed, toBlock };
}
