import { afterEach, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pollEscrowEvents } from "@/lib/chain/escrow-indexer";

const BOOKING_ID = "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`;
const BOOKING_UUID = "11111111-2222-3333-4444-555555555555";

afterEach(() => {
  delete process.env.ESCROW_MANAGER_ADDRESS;
});

function makeSupabase(options: { cursor: number; bookingFound?: boolean }) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  let cursorUpdate: number | undefined;

  const client = {
    from: (table: string) => {
      if (table === "escrow_indexer_state") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { last_processed_block: options.cursor }, error: null }),
            }),
          }),
          update: (row: { last_processed_block: number }) => ({
            eq: async () => {
              cursorUpdate = row.last_processed_block;
              return { error: null };
            },
          }),
        };
      }
      if (table === "package_bookings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: options.bookingFound === false ? null : { id: BOOKING_UUID },
                error: null,
              }),
            }),
          }),
          update: (row: Record<string, unknown>) => ({
            eq: async () => {
              updated.push(row);
              return { error: null };
            },
          }),
        };
      }
      if (table === "escrow_events") {
        return {
          insert: async (row: Record<string, unknown>) => {
            inserted.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client: client as unknown as SupabaseClient, inserted, updated, getCursorUpdate: () => cursorUpdate };
}

describe("pollEscrowEvents", () => {
  it("does nothing when there are no new blocks", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const { client } = makeSupabase({ cursor: 100 });
    const publicClient = { getBlockNumber: async () => 100n, getLogs: async () => [] };

    const result = await pollEscrowEvents(client, publicClient as never);

    expect(result).toEqual({ processed: 0, toBlock: 100n });
  });

  it("records a Deposited event and updates the booking's escrow_state to funded", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const { client, inserted, getCursorUpdate } = makeSupabase({ cursor: 100 });
    const publicClient = {
      getBlockNumber: async () => 105n,
      getLogs: async ({ event }: { event: { name: string } }) => {
        if (event.name !== "Deposited") return [];
        return [{ args: { bookingId: BOOKING_ID }, transactionHash: "0xdeposittx", blockNumber: 103n }];
      },
    };

    const result = await pollEscrowEvents(client, publicClient as never);

    expect(result.processed).toBe(1);
    expect(inserted).toEqual([
      { booking_id: BOOKING_UUID, event_type: "deposited", tx_hash: "0xdeposittx", block_number: 103 },
    ]);
    expect(getCursorUpdate()).toBe(105);
  });

  it("warns and skips (without throwing) when no booking matches the event's bookingId", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const { client, inserted } = makeSupabase({ cursor: 100, bookingFound: false });
    const publicClient = {
      getBlockNumber: async () => 105n,
      getLogs: async ({ event }: { event: { name: string } }) => {
        if (event.name !== "Deposited") return [];
        return [{ args: { bookingId: BOOKING_ID }, transactionHash: "0xdeposittx", blockNumber: 103n }];
      },
    };

    const result = await pollEscrowEvents(client, publicClient as never);

    expect(result.processed).toBe(0);
    expect(inserted).toHaveLength(0);
  });
});
