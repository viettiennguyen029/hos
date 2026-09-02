import { afterEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/poll-escrow-events", () => {
  it("returns 401 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    mock.module("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
    mock.module("@/lib/chain/escrow-indexer", () => ({ pollEscrowEvents: async () => ({ processed: 0, toBlock: 0n }) }));
    const { GET } = await import("@/app/api/cron/poll-escrow-events/route");

    const response = await GET(new NextRequest("http://localhost/api/cron/poll-escrow-events"));
    expect(response.status).toBe(401);
  });

  it("returns 401 when the Authorization header doesn't match", async () => {
    process.env.CRON_SECRET = "test-secret";
    mock.module("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
    mock.module("@/lib/chain/escrow-indexer", () => ({ pollEscrowEvents: async () => ({ processed: 0, toBlock: 0n }) }));
    const { GET } = await import("@/app/api/cron/poll-escrow-events/route");

    const response = await GET(
      new NextRequest("http://localhost/api/cron/poll-escrow-events", { headers: { authorization: "Bearer wrong" } })
    );
    expect(response.status).toBe(401);
  });

  it("polls events and returns 200 with the result when authorized", async () => {
    process.env.CRON_SECRET = "test-secret";
    mock.module("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
    mock.module("@/lib/chain/escrow-indexer", () => ({
      pollEscrowEvents: async () => ({ processed: 3, toBlock: 999n }),
    }));
    const { GET } = await import("@/app/api/cron/poll-escrow-events/route");

    const response = await GET(
      new NextRequest("http://localhost/api/cron/poll-escrow-events", {
        headers: { authorization: "Bearer test-secret" },
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ processed: 3, toBlock: "999" });
  });
});
