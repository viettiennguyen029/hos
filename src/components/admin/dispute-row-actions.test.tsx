import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const toastCalls: { type: "error" | "success"; message: string }[] = [];
mock.module("sonner", () => ({
  toast: {
    error: (message: string) => toastCalls.push({ type: "error", message }),
    success: (message: string) => toastCalls.push({ type: "success", message }),
  },
}));
const refresh = mock(() => {});
mock.module("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

let releaseResult: { error: string } | { success: true } = { success: true as const };
let refundResult: { error: string } | { success: true } = { success: true as const };
const releaseCalls: string[] = [];
const refundCalls: string[] = [];
mock.module("@/lib/supabase/admin-actions", () => ({
  resolveDisputeByRelease: async (bookingId: string) => {
    releaseCalls.push(bookingId);
    return releaseResult;
  },
  resolveDisputeByRefund: async (bookingId: string) => {
    refundCalls.push(bookingId);
    return refundResult;
  },
}));

import { DisputeRowActions } from "@/components/admin/dispute-row-actions";

afterEach(() => {
  cleanup();
  toastCalls.length = 0;
  releaseCalls.length = 0;
  refundCalls.length = 0;
  releaseResult = { success: true as const };
  refundResult = { success: true as const };
  refresh.mockClear();
});

describe("DisputeRowActions", () => {
  it("releases funds to the talent and refreshes on success", async () => {
    render(<DisputeRowActions bookingId="booking-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Release to Talent" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(releaseCalls).toEqual(["booking-1"]);
    expect(toastCalls).toContainEqual({ type: "success", message: "Funds released to talent." });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an error toast without refreshing when release fails", async () => {
    releaseResult = { error: "Admin access required." };
    render(<DisputeRowActions bookingId="booking-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Release to Talent" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toastCalls).toContainEqual({ type: "error", message: "Admin access required." });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refunds the organizer and refreshes on success", async () => {
    render(<DisputeRowActions bookingId="booking-2" />);
    fireEvent.click(screen.getByRole("button", { name: "Refund Organizer" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refundCalls).toEqual(["booking-2"]);
    expect(toastCalls).toContainEqual({ type: "success", message: "Organizer refunded." });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an error toast without refreshing when refund fails", async () => {
    refundResult = { error: "Failed to refund organizer." };
    render(<DisputeRowActions bookingId="booking-2" />);
    fireEvent.click(screen.getByRole("button", { name: "Refund Organizer" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toastCalls).toContainEqual({ type: "error", message: "Failed to refund organizer." });
    expect(refresh).not.toHaveBeenCalled();
  });
});
