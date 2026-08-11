import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";

mock.module("@/lib/supabase/admin-actions", () => ({
  resolveDisputeByRelease: async () => ({ success: true }),
  resolveDisputeByRefund: async () => ({ success: true }),
}));
mock.module("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

let bookingsResult: unknown[] = [];
mock.module("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: async () => ({ data: bookingsResult, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

import AdminDisputesPage from "@/app/admin/disputes/page";

describe("AdminDisputesPage", () => {
  it("renders each booking with its price and both action buttons", async () => {
    bookingsResult = [
      {
        id: "booking-1",
        price_vnd: 1500000,
        status: "cancelled",
        escrow_state: "funded",
        organizer: { full_name: "Nova Events" },
      },
    ];

    render(await AdminDisputesPage());

    expect(screen.getByText(/booking-1/i)).toBeInTheDocument();
    expect(screen.getByText(/1,500,000 VND/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Release to Talent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refund Organizer" })).toBeInTheDocument();
  });

  it("shows 'No open disputes.' when there are no bookings", async () => {
    bookingsResult = [];

    render(await AdminDisputesPage());

    expect(screen.getByText("No open disputes.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release to Talent" })).not.toBeInTheDocument();
  });
});
