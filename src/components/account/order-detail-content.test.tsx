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

let confirmResult: { error: string } | { success: true } = { success: true as const };
let counterResult: { error: string } | { success: true } = { success: true as const };
let cancelResult: { error: string } | { success: true } = { success: true as const };
let markPaidResult: { error: string } | { success: true } = { success: true as const };
let talentMarkCompleteResult: { error: string } | { success: true } = { success: true as const };
let organizerMarkCompleteResult: { error: string } | { success: true } = { success: true as const };
let depositResult: { error: string } | { success: true } = { success: true as const };
const confirmCalls: string[] = [];
const counterCalls: { bookingId: string; offerVnd: string | null }[] = [];
const cancelCalls: string[] = [];
const markPaidCalls: string[] = [];
const talentMarkCompleteCalls: string[] = [];
const organizerMarkCompleteCalls: string[] = [];
const depositCalls: string[] = [];
mock.module("@/lib/supabase/package-actions", () => ({
  confirmBookingOffer: async (bookingId: string) => {
    confirmCalls.push(bookingId);
    return confirmResult;
  },
  submitCounterOffer: async (bookingId: string, formData: FormData) => {
    counterCalls.push({ bookingId, offerVnd: formData.get("offerVnd") as string | null });
    return counterResult;
  },
  rejectBooking: async (bookingId: string) => {
    cancelCalls.push(bookingId);
    return cancelResult;
  },
  markBookingPaid: async (bookingId: string) => {
    markPaidCalls.push(bookingId);
    return markPaidResult;
  },
  talentMarkComplete: async (bookingId: string) => {
    talentMarkCompleteCalls.push(bookingId);
    return talentMarkCompleteResult;
  },
  organizerMarkComplete: async (bookingId: string) => {
    organizerMarkCompleteCalls.push(bookingId);
    return organizerMarkCompleteResult;
  },
  depositBookingEscrow: async (bookingId: string) => {
    depositCalls.push(bookingId);
    return depositResult;
  },
}));

import { OrderDetailContent } from "@/components/account/order-detail-content";
import type { BookingDetail } from "@/lib/supabase/types";

afterEach(() => {
  cleanup();
  toastCalls.length = 0;
  confirmCalls.length = 0;
  counterCalls.length = 0;
  cancelCalls.length = 0;
  markPaidCalls.length = 0;
  talentMarkCompleteCalls.length = 0;
  organizerMarkCompleteCalls.length = 0;
  depositCalls.length = 0;
  confirmResult = { success: true as const };
  counterResult = { success: true as const };
  cancelResult = { success: true as const };
  markPaidResult = { success: true as const };
  talentMarkCompleteResult = { success: true as const };
  organizerMarkCompleteResult = { success: true as const };
  depositResult = { success: true as const };
  refresh.mockClear();
});

function makeBooking(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: "booking-1",
    package_id: "pkg-1",
    organizer_id: "org-1",
    price_vnd: 5_000_000,
    talent_offer_vnd: 5_000_000,
    organizer_offer_vnd: 5_000_000,
    awaiting_response_from: "talent",
    booked_date: "2026-12-01",
    booked_time: "20:00",
    booked_end_time: "21:00",
    city_id: "city-hcm",
    address: "123 Main St",
    payment_method: "Prepaid",
    status: "pending",
    payment_status: "pending",
    talent_marked_complete_at: null,
    payment_channel: null,
    escrow_booking_id: null,
    escrow_state: "none",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    organizer_name: "Test Organizer",
    talent_name: "Test Talent",
    package_title: "Acoustic Set",
    package_description: "A chill acoustic set.",
    package_working_method: "Freelance",
    package_skill_tags: ["Guitar", "Vocals"],
    venue_city_name: "HCM City",
    venue_address: "123 Main St",
    ...overrides,
  };
}

describe("OrderDetailContent — display", () => {
  it("shows both parties' names, the package detail, and skill tags", () => {
    render(<OrderDetailContent role="talent" booking={makeBooking()} />);
    expect(screen.getByText("Test Organizer")).toBeInTheDocument();
    expect(screen.getByText("Test Talent")).toBeInTheDocument();
    expect(screen.getByText("Acoustic Set")).toBeInTheDocument();
    expect(screen.getByText("123 Main St")).toBeInTheDocument();
    expect(screen.getByText("Freelance")).toBeInTheDocument();
    expect(screen.getByText("Guitar")).toBeInTheDocument();
    expect(screen.getByText("Vocals")).toBeInTheDocument();
  });

  it("shows the specific booked start-end time, not the package's availability window", () => {
    render(<OrderDetailContent role="talent" booking={makeBooking({ booked_time: "14:00", booked_end_time: "15:00" })} />);
    expect(screen.getByText("14:00 - 15:00")).toBeInTheDocument();
  });

  it("falls back to Flexible when no specific time was booked", () => {
    render(<OrderDetailContent role="talent" booking={makeBooking({ booked_time: null, booked_end_time: null })} />);
    expect(screen.getByText("Flexible")).toBeInTheDocument();
  });
});

describe("OrderDetailContent — whose turn it is", () => {
  it("enables Confirm/Add New Offer for the talent when it's the talent's turn", () => {
    render(<OrderDetailContent role="talent" booking={makeBooking({ awaiting_response_from: "talent" })} />);
    expect(screen.getByRole("button", { name: /order confirm/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /add new offer/i })).toBeEnabled();
  });

  it("disables Confirm/Add New Offer for the organizer and shows a waiting message when it's the talent's turn", () => {
    render(<OrderDetailContent role="organizer" booking={makeBooking({ awaiting_response_from: "talent" })} />);
    expect(screen.getByRole("button", { name: /order confirm/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /add new offer/i })).toBeDisabled();
    expect(screen.getByText(/waiting for talent/i)).toBeInTheDocument();
  });

  it("keeps Cancel enabled even when it isn't the viewer's turn", () => {
    render(<OrderDetailContent role="organizer" booking={makeBooking({ awaiting_response_from: "talent" })} />);
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeEnabled();
  });

  it("hides the negotiation actions once the booking is confirmed", () => {
    render(
      <OrderDetailContent
        role="talent"
        booking={makeBooking({ status: "confirmed", awaiting_response_from: null })}
      />
    );
    expect(screen.queryByRole("button", { name: /order confirm/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add new offer/i })).not.toBeInTheDocument();
  });
});

describe("OrderDetailContent — payment step (confirmed, Prepaid, unpaid)", () => {
  function confirmedUnpaidBooking(overrides: Partial<BookingDetail> = {}) {
    return makeBooking({
      status: "confirmed",
      awaiting_response_from: null,
      payment_method: "Prepaid",
      payment_status: "pending",
      ...overrides,
    });
  }

  it("shows Proceed to Payment and Cancel for the organizer", () => {
    render(<OrderDetailContent role="organizer" booking={confirmedUnpaidBooking()} />);
    expect(screen.getByRole("button", { name: /proceed to payment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });

  it("shows a waiting message instead of a payment button for the talent", () => {
    render(<OrderDetailContent role="talent" booking={confirmedUnpaidBooking()} />);
    expect(screen.queryByRole("button", { name: /proceed to payment/i })).not.toBeInTheDocument();
    expect(screen.getByText(/waiting for the organizer to complete payment/i)).toBeInTheDocument();
  });

  it("opens the payment dialog with bank transfer details and a QR code", () => {
    render(<OrderDetailContent role="organizer" booking={confirmedUnpaidBooking()} />);
    fireEvent.click(screen.getByRole("button", { name: /proceed to payment/i }));
    expect(screen.getByText("Payment - Final step")).toBeInTheDocument();
    expect(screen.getByText(/scan this qr/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i already did that/i })).toBeInTheDocument();
  });

  it("confirms payment and refreshes on success", async () => {
    render(<OrderDetailContent role="organizer" booking={confirmedUnpaidBooking()} />);
    fireEvent.click(screen.getByRole("button", { name: /proceed to payment/i }));
    fireEvent.click(screen.getByRole("button", { name: /i already did that/i }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(markPaidCalls).toEqual(["booking-1"]);
    expect(toastCalls).toContainEqual({ type: "success", message: "Payment confirmed." });
    expect(refresh).toHaveBeenCalled();
  });
});

describe("OrderDetailContent — crypto escrow deposit (confirmed, registered on-chain, not yet funded)", () => {
  function registeredCryptoBooking(overrides: Partial<BookingDetail> = {}) {
    return makeBooking({
      status: "confirmed",
      awaiting_response_from: null,
      payment_method: "Prepaid",
      payment_status: "pending",
      payment_channel: "crypto",
      escrow_state: "registered",
      ...overrides,
    });
  }

  it("shows Deposit (not Proceed to Payment) for the organizer, and hides isPaid-gated content", () => {
    render(<OrderDetailContent role="organizer" booking={registeredCryptoBooking()} />);
    expect(screen.getByRole("button", { name: /^deposit$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /proceed to payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add to calendar/i })).not.toBeInTheDocument();
  });

  it("does not show Deposit for the talent", () => {
    render(<OrderDetailContent role="talent" booking={registeredCryptoBooking()} />);
    expect(screen.queryByRole("button", { name: /^deposit$/i })).not.toBeInTheDocument();
  });

  it("clicking Deposit calls depositBookingEscrow and refreshes on success", async () => {
    render(<OrderDetailContent role="organizer" booking={registeredCryptoBooking()} />);
    fireEvent.click(screen.getByRole("button", { name: /^deposit$/i }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(depositCalls).toEqual(["booking-1"]);
    expect(toastCalls).toContainEqual({ type: "success", message: "Deposit submitted." });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows isPaid-gated content (Add to Calendar) once the escrow is funded, same as a fiat-paid booking", () => {
    render(
      <OrderDetailContent
        role="organizer"
        booking={registeredCryptoBooking({ escrow_state: "funded" })}
      />
    );
    expect(screen.queryByRole("button", { name: /^deposit$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
  });

  it("shows isPaid-gated content (Add to Calendar) once the escrow is released, same as a fiat-paid booking", () => {
    render(
      <OrderDetailContent
        role="organizer"
        booking={registeredCryptoBooking({ escrow_state: "released" })}
      />
    );
    expect(screen.queryByRole("button", { name: /^deposit$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
  });
});

describe("OrderDetailContent — unfunded/refunded crypto bookings are never treated as paid", () => {
  function cryptoBooking(overrides: Partial<BookingDetail> = {}) {
    return makeBooking({
      status: "confirmed",
      awaiting_response_from: null,
      payment_method: "Prepaid",
      payment_status: "pending",
      payment_channel: "crypto",
      ...overrides,
    });
  }

  it("hides isPaid-gated content for a confirmed crypto booking that hasn't been registered on-chain yet (escrow_state: none)", () => {
    render(<OrderDetailContent role="organizer" booking={cryptoBooking({ escrow_state: "none" })} />);
    expect(screen.queryByRole("button", { name: /add to calendar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark as completed/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^deposit$/i })).not.toBeInTheDocument();
  });

  it("hides isPaid-gated content for a refunded crypto booking", () => {
    render(<OrderDetailContent role="organizer" booking={cryptoBooking({ escrow_state: "refunded" })} />);
    expect(screen.queryByRole("button", { name: /add to calendar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark as completed/i })).not.toBeInTheDocument();
  });
});

describe("OrderDetailContent — paid/complete state", () => {
  function paidBooking(overrides: Partial<BookingDetail> = {}) {
    return makeBooking({
      status: "confirmed",
      awaiting_response_from: null,
      payment_method: "Prepaid",
      payment_status: "complete",
      // Default fixture's booked_date (2026-12-01) is in the future, so
      // "Mark Complete" stays disabled unless a test explicitly needs it
      // enabled (past end time).
      ...overrides,
    });
  }

  function paidBookingPastEndTime(overrides: Partial<BookingDetail> = {}) {
    return paidBooking({ booked_date: "2020-01-01", booked_time: "20:00", booked_end_time: "21:00", ...overrides });
  }

  it("hides Generate check-in QR (not yet enabled) but shows Add to Calendar", () => {
    render(<OrderDetailContent role="organizer" booking={paidBooking()} />);
    expect(screen.queryByRole("button", { name: /generate check-in qr code for talent/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
  });

  it("treats Postpaid bookings as already paid once confirmed", () => {
    render(
      <OrderDetailContent
        role="organizer"
        booking={paidBooking({ payment_method: "Postpaid", payment_status: "pending" })}
      />
    );
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
  });

  it("disables Mark as Completed for the organizer before the booking's end time", () => {
    render(<OrderDetailContent role="organizer" booking={paidBooking()} />);
    expect(screen.getByRole("button", { name: /mark as completed/i })).toBeDisabled();
  });

  it("enables Mark as Completed for the organizer once the end time has passed", () => {
    render(<OrderDetailContent role="organizer" booking={paidBookingPastEndTime()} />);
    expect(screen.getByRole("button", { name: /mark as completed/i })).toBeEnabled();
  });

  it("organizer marking complete calls organizerMarkComplete and refreshes", async () => {
    render(<OrderDetailContent role="organizer" booking={paidBookingPastEndTime()} />);
    fireEvent.click(screen.getByRole("button", { name: /mark as completed/i }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(organizerMarkCompleteCalls).toEqual(["booking-1"]);
    expect(toastCalls).toContainEqual({ type: "success", message: "Booking completed." });
    expect(refresh).toHaveBeenCalled();
  });

  it("disables Mark as Complete for the talent before the booking's end time", () => {
    render(<OrderDetailContent role="talent" booking={paidBooking()} />);
    expect(screen.getByRole("button", { name: /^mark as complete$/i })).toBeDisabled();
  });

  it("talent marking complete calls talentMarkComplete and refreshes, without changing booking status", async () => {
    render(<OrderDetailContent role="talent" booking={paidBookingPastEndTime()} />);
    fireEvent.click(screen.getByRole("button", { name: /^mark as complete$/i }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(talentMarkCompleteCalls).toEqual(["booking-1"]);
    expect(toastCalls).toContainEqual({
      type: "success",
      message: "Marked complete. The organizer has been notified.",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a waiting message instead of the button once the talent has marked complete", () => {
    render(
      <OrderDetailContent
        role="talent"
        booking={paidBookingPastEndTime({ talent_marked_complete_at: "2026-08-08T10:00:00Z" })}
      />
    );
    expect(screen.queryByRole("button", { name: /^mark as complete$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/waiting for the organizer/i)).toBeInTheDocument();
  });

  it("shows the organizer that the talent already marked it complete", () => {
    render(
      <OrderDetailContent
        role="organizer"
        booking={paidBookingPastEndTime({ talent_marked_complete_at: "2026-08-08T10:00:00Z" })}
      />
    );
    expect(screen.getByText(/talent marked this complete/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark as completed/i })).toBeInTheDocument();
  });

  it("hides both Mark Complete actions once the booking is fully completed", () => {
    render(<OrderDetailContent role="organizer" booking={paidBookingPastEndTime({ status: "completed" })} />);
    expect(screen.queryByRole("button", { name: /mark as completed/i })).not.toBeInTheDocument();
    expect(screen.getByText(/this booking is complete/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
  });
});

describe("OrderDetailContent — actions", () => {
  it("confirms the offer and refreshes on success", async () => {
    render(<OrderDetailContent role="talent" booking={makeBooking()} />);
    fireEvent.click(screen.getByRole("button", { name: /order confirm/i }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(confirmCalls).toEqual(["booking-1"]);
    expect(toastCalls).toContainEqual({ type: "success", message: "Order confirmed." });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an error toast without refreshing when confirm fails", async () => {
    confirmResult = { error: "It's not your turn to respond to this offer." };
    render(<OrderDetailContent role="talent" booking={makeBooking()} />);
    fireEvent.click(screen.getByRole("button", { name: /order confirm/i }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toastCalls).toContainEqual({
      type: "error",
      message: "It's not your turn to respond to this offer.",
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("opens the counter-offer modal and submits the entered amount", async () => {
    render(<OrderDetailContent role="talent" booking={makeBooking()} />);
    fireEvent.click(screen.getByRole("button", { name: /add new offer/i }));
    fireEvent.change(screen.getByLabelText(/your offer/i), { target: { value: "6000000" } });
    fireEvent.click(screen.getByRole("button", { name: /send offer request/i }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(counterCalls).toEqual([{ bookingId: "booking-1", offerVnd: "6000000" }]);
    expect(toastCalls).toContainEqual({ type: "success", message: "Offer sent." });
    expect(refresh).toHaveBeenCalled();
  });

  it("cancels the booking on Cancel click", async () => {
    render(<OrderDetailContent role="talent" booking={makeBooking()} />);
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancelCalls).toEqual(["booking-1"]);
    expect(toastCalls).toContainEqual({ type: "success", message: "Booking cancelled." });
    expect(refresh).toHaveBeenCalled();
  });
});
