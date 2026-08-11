import { afterEach, describe, expect, it, mock } from "bun:test";

afterEach(() => {
  mock.restore();
});

function mockAdminCheck(isAdmin: boolean) {
  mock.module("@/lib/supabase/admin", () => ({ isCurrentUserAdmin: async () => isAdmin }));
}

describe("resolveDisputeByRelease", () => {
  it("rejects when the caller is not an admin", async () => {
    mockAdminCheck(false);
    const { resolveDisputeByRelease } = await import("@/lib/supabase/admin-actions");
    expect(await resolveDisputeByRelease("booking-1")).toEqual({ error: "Admin access required." });
  });

  it("calls releaseEscrowAsAdmin with the booking's escrow_booking_id when authorized", async () => {
    mockAdminCheck(true);
    const calls: string[] = [];
    mock.module("@/lib/chain/escrow", () => ({
      releaseEscrowAsAdmin: async (_supabase: unknown, bookingId: string) => {
        calls.push(bookingId);
        return "0xtx";
      },
    }));
    mock.module("@/lib/supabase/service", () => ({
      createServiceClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({ single: async () => ({ data: { escrow_booking_id: "0xabc" }, error: null }) }),
          }),
        }),
      }),
    }));
    const { resolveDisputeByRelease } = await import("@/lib/supabase/admin-actions");

    const result = await resolveDisputeByRelease("booking-1");

    expect(result).toEqual({ success: true });
    expect(calls).toEqual(["0xabc"]);
  });
});

describe("resolveDisputeByRefund", () => {
  it("rejects when the caller is not an admin", async () => {
    mockAdminCheck(false);
    const { resolveDisputeByRefund } = await import("@/lib/supabase/admin-actions");
    expect(await resolveDisputeByRefund("booking-1")).toEqual({ error: "Admin access required." });
  });
});
