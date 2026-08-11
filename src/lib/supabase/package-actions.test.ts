import { afterEach, describe, expect, it, mock } from "bun:test";

const revalidatePath = mock(() => {});
mock.module("next/cache", () => ({ revalidatePath }));

const USER_ID = "11111111-1111-1111-1111-111111111111";

const TALENT_ID = "22222222-2222-2222-2222-222222222222";
const ORGANIZER_ID = "33333333-3333-3333-3333-333333333333";

interface FakeBooking {
  organizer_id: string;
  awaiting_response_from: "talent" | "organizer" | null;
  talent_offer_vnd: number;
  organizer_offer_vnd: number;
  talent_id: string;
  payment_method?: "Prepaid" | "Postpaid";
  status?: string;
  payment_status?: "pending" | "complete";
  booked_date?: string | null;
  booked_end_time?: string | null;
}

function makeSupabase(options: {
  user: { id: string } | null;
  kycStatus?: string;
  booking?: FakeBooking;
  packageTalentId?: string;
  busySlots?: { busy_date: string; start_time: string; end_time: string }[];
}) {
  const inserted: { packages?: Record<string, unknown>; cart_items?: Record<string, unknown>; package_bookings?: Record<string, unknown>[] } = {};
  const updated: { packages?: Record<string, unknown>; package_bookings?: Record<string, unknown> } = {};

  return {
    auth: { getUser: async () => ({ data: { user: options.user } }) },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === "get_talent_busy_slots") return { data: options.busySlots ?? [] };
      throw new Error(`unexpected rpc ${fn} with args ${JSON.stringify(args)}`);
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { kyc_status: options.kycStatus ?? "verified" } }),
            }),
          }),
        };
      }
      if (table === "packages") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { talent_id: options.packageTalentId ?? TALENT_ID } }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            inserted.packages = row;
            return { error: null };
          },
          update: (row: Record<string, unknown>) => {
            updated.packages = row;
            return { eq: () => ({ eq: async () => ({ error: null }) }) };
          },
        };
      }
      if (table === "cart_items") {
        return {
          select: () => ({
            eq: (col: string, val: unknown) => ({
              in: async (col2: string, vals: unknown[]) => ({
                data: [
                  {
                    id: "cart-1",
                    package_id: "pkg-1",
                    organizer_id: options.user?.id,
                    price_vnd: 5_000_000,
                    booked_date: "2026-12-01",
                    booked_time: "20:00",
                    booked_end_time: "21:00",
                    city_id: "city-1",
                    address: "123 Main St",
                  },
                ],
              }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            inserted.cart_items = row;
            return { error: null };
          },
          delete: () => ({
            in: async () => ({ error: null }),
          }),
        };
      }
      if (table === "package_bookings") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: options.booking
                  ? {
                      organizer_id: options.booking.organizer_id,
                      awaiting_response_from: options.booking.awaiting_response_from,
                      talent_offer_vnd: options.booking.talent_offer_vnd,
                      organizer_offer_vnd: options.booking.organizer_offer_vnd,
                      payment_method: options.booking.payment_method ?? "Prepaid",
                      status: options.booking.status ?? "confirmed",
                      payment_status: options.booking.payment_status ?? "pending",
                      booked_date: options.booking.booked_date ?? "2020-01-01",
                      booked_end_time: options.booking.booked_end_time ?? "00:00:00",
                      package: { talent_id: options.booking.talent_id },
                    }
                  : null,
              }),
            }),
          }),
          insert: async (rows: Record<string, unknown>[]) => {
            inserted.package_bookings = rows;
            return { error: null };
          },
          delete: () => ({
            in: async () => ({ error: null }),
          }),
          update: (row: Record<string, unknown>) => {
            updated.package_bookings = row;
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    __inserted: inserted,
    __updated: updated,
  };
}

let supabaseMock = makeSupabase({ user: { id: USER_ID } });

mock.module("@/lib/supabase/server", () => ({
  createClient: async () => supabaseMock,
}));

import {
  addToCart,
  checkoutCart,
  confirmBookingOffer,
  createPackage,
  deletePackage,
  markBookingPaid,
  organizerMarkComplete,
  rejectBooking,
  removeFromCart,
  submitCounterOffer,
  talentMarkComplete,
  updatePackage,
} from "@/lib/supabase/package-actions";

afterEach(() => {
  revalidatePath.mockClear();
});

function packageFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("categoryId", "22222222-2222-2222-2222-222222222222");
  formData.set("subcategoryId", "33333333-3333-3333-3333-333333333333");
  formData.set("title", "Acoustic Set");
  formData.set("cityId", "44444444-4444-4444-4444-444444444444");
  formData.set("repeatOn", "false");
  formData.set("startDate", "2026-09-01");
  formData.set("endDate", "2026-09-01");
  formData.set("startTime", "20:00");
  formData.set("endTime", "22:00");
  formData.set("priceMin", "1000000");
  formData.set("priceMax", "2000000");
  formData.set("paymentMethod", "Prepaid");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

function checkoutFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.append("itemIds", "cart-1");
  formData.set("paymentChannel", "fiat");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

describe("package actions — signed-out guard", () => {
  it("createPackage rejects when not signed in", async () => {
    supabaseMock = makeSupabase({ user: null });
    expect(await createPackage(packageFormData())).toEqual({ error: "You must be signed in." });
  });

  it("updatePackage rejects when not signed in", async () => {
    supabaseMock = makeSupabase({ user: null });
    expect(await updatePackage("pkg-1", packageFormData())).toEqual({ error: "You must be signed in." });
  });

  it("deletePackage rejects when not signed in", async () => {
    supabaseMock = makeSupabase({ user: null });
    expect(await deletePackage("pkg-1")).toEqual({ error: "You must be signed in." });
  });

  it("addToCart rejects when not signed in", async () => {
    supabaseMock = makeSupabase({ user: null });
    expect(await addToCart(new FormData())).toEqual({ error: "You must be signed in." });
  });

  it("removeFromCart rejects when not signed in", async () => {
    supabaseMock = makeSupabase({ user: null });
    expect(await removeFromCart("cart-1")).toEqual({ error: "You must be signed in." });
  });

  it("checkoutCart rejects when not signed in", async () => {
    supabaseMock = makeSupabase({ user: null });
    expect(await checkoutCart(new FormData())).toEqual({ error: "You must be signed in." });
  });

  it("confirmBookingOffer rejects when not signed in", async () => {
    supabaseMock = makeSupabase({ user: null });
    expect(await confirmBookingOffer("booking-1")).toEqual({ error: "You must be signed in." });
  });

  it("submitCounterOffer rejects when not signed in", async () => {
    supabaseMock = makeSupabase({ user: null });
    expect(await submitCounterOffer("booking-1", new FormData())).toEqual({ error: "You must be signed in." });
  });

  it("rejectBooking rejects when not signed in", async () => {
    supabaseMock = makeSupabase({ user: null });
    expect(await rejectBooking("booking-1")).toEqual({ error: "You must be signed in." });
  });
});

describe("createPackage / updatePackage", () => {
  it("persists category_id/subcategory_id/city_id from the submitted lookup ids", async () => {
    supabaseMock = makeSupabase({ user: { id: USER_ID } });
    const result = await createPackage(packageFormData());
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__inserted.packages).toMatchObject({
      category_id: "22222222-2222-2222-2222-222222222222",
      subcategory_id: "33333333-3333-3333-3333-333333333333",
      city_id: "44444444-4444-4444-4444-444444444444",
    });
  });

  it("updates category_id/subcategory_id/city_id from the submitted lookup ids", async () => {
    supabaseMock = makeSupabase({ user: { id: USER_ID } });
    const result = await updatePackage("pkg-1", packageFormData({ subcategoryId: "" }));
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__updated.packages).toMatchObject({
      category_id: "22222222-2222-2222-2222-222222222222",
      subcategory_id: null,
      city_id: "44444444-4444-4444-4444-444444444444",
    });
  });

  it("persists working method/skill tags, splitting skill tags on comma", async () => {
    supabaseMock = makeSupabase({ user: { id: USER_ID } });
    const result = await createPackage(
      packageFormData({ workingMethod: "Freelance", skillTags: "Guitar, Vocals ,  Piano" })
    );
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__inserted.packages).toMatchObject({
      working_method: "Freelance",
      skill_tags: ["Guitar", "Vocals", "Piano"],
    });
  });

  it("stores null working method and an empty skill_tags array when omitted", async () => {
    supabaseMock = makeSupabase({ user: { id: USER_ID } });
    await createPackage(packageFormData());
    expect(supabaseMock.__inserted.packages).toMatchObject({
      working_method: null,
      skill_tags: [],
    });
  });
});

describe("confirmBookingOffer", () => {
  it("accepts the organizer's offer when it's the talent's turn, setting price_vnd and clearing the turn", async () => {
    supabaseMock = makeSupabase({
      user: { id: TALENT_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: "talent",
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 4_500_000,
      },
    });
    const result = await confirmBookingOffer("booking-1");
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__updated.package_bookings).toEqual({
      status: "confirmed",
      price_vnd: 4_500_000,
      awaiting_response_from: null,
      payment_status: "pending",
    });
  });

  it("marks Postpaid bookings as already paid on confirm, since payment happens after the event", async () => {
    supabaseMock = makeSupabase({
      user: { id: TALENT_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: "talent",
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 4_500_000,
        payment_method: "Postpaid",
      },
    });
    await confirmBookingOffer("booking-1");
    expect(supabaseMock.__updated.package_bookings).toMatchObject({ payment_status: "complete" });
  });

  it("accepts the talent's offer when it's the organizer's turn", async () => {
    supabaseMock = makeSupabase({
      user: { id: ORGANIZER_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: "organizer",
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 4_500_000,
      },
    });
    const result = await confirmBookingOffer("booking-1");
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__updated.package_bookings).toMatchObject({ price_vnd: 5_000_000 });
  });

  it("rejects when it isn't the caller's turn", async () => {
    supabaseMock = makeSupabase({
      user: { id: TALENT_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: "organizer",
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 4_500_000,
      },
    });
    expect(await confirmBookingOffer("booking-1")).toEqual({ error: "It's not your turn to respond to this offer." });
  });

  it("rejects when the caller isn't part of the booking", async () => {
    supabaseMock = makeSupabase({
      user: { id: "44444444-4444-4444-4444-444444444444" },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: "talent",
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 4_500_000,
      },
    });
    expect(await confirmBookingOffer("booking-1")).toEqual({ error: "You are not part of this booking." });
  });
});

describe("markBookingPaid", () => {
  it("marks a Prepaid confirmed booking as paid when the organizer confirms", async () => {
    supabaseMock = makeSupabase({
      user: { id: ORGANIZER_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: null,
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        payment_method: "Prepaid",
        status: "confirmed",
        payment_status: "pending",
      },
    });
    const result = await markBookingPaid("booking-1");
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__updated.package_bookings).toEqual({ payment_status: "complete" });
  });

  it("rejects when the caller isn't the organizer", async () => {
    supabaseMock = makeSupabase({
      user: { id: TALENT_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: null,
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        payment_method: "Prepaid",
        status: "confirmed",
        payment_status: "pending",
      },
    });
    expect(await markBookingPaid("booking-1")).toEqual({
      error: "Only the organizer can confirm payment for this booking.",
    });
  });

  it("rejects when the booking isn't confirmed yet", async () => {
    supabaseMock = makeSupabase({
      user: { id: ORGANIZER_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: "talent",
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        payment_method: "Prepaid",
        status: "pending",
        payment_status: "pending",
      },
    });
    expect(await markBookingPaid("booking-1")).toEqual({ error: "This booking isn't confirmed yet." });
  });

  it("rejects Postpaid bookings, which don't need prepayment", async () => {
    supabaseMock = makeSupabase({
      user: { id: ORGANIZER_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: null,
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        payment_method: "Postpaid",
        status: "confirmed",
        payment_status: "complete",
      },
    });
    expect(await markBookingPaid("booking-1")).toEqual({ error: "This booking doesn't require prepayment." });
  });
});

describe("talentMarkComplete", () => {
  it("records a timestamp when the talent marks a confirmed, past-end-time booking complete", async () => {
    supabaseMock = makeSupabase({
      user: { id: TALENT_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: null,
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        status: "confirmed",
        booked_date: "2020-01-01",
        booked_end_time: "00:00:00",
      },
    });
    const result = await talentMarkComplete("booking-1");
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__updated.package_bookings).toHaveProperty("talent_marked_complete_at");
  });

  it("rejects when the caller isn't the talent", async () => {
    supabaseMock = makeSupabase({
      user: { id: ORGANIZER_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: null,
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        status: "confirmed",
        booked_date: "2020-01-01",
        booked_end_time: "00:00:00",
      },
    });
    expect(await talentMarkComplete("booking-1")).toEqual({
      error: "Only the talent can mark this booking complete.",
    });
  });

  it("rejects when the booking isn't confirmed", async () => {
    supabaseMock = makeSupabase({
      user: { id: TALENT_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: "talent",
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        status: "pending",
        booked_date: "2020-01-01",
        booked_end_time: "00:00:00",
      },
    });
    expect(await talentMarkComplete("booking-1")).toEqual({ error: "This booking isn't confirmed yet." });
  });

  it("rejects before the booking's end time has passed", async () => {
    supabaseMock = makeSupabase({
      user: { id: TALENT_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: null,
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        status: "confirmed",
        booked_date: "2999-01-01",
        booked_end_time: "00:00:00",
      },
    });
    expect(await talentMarkComplete("booking-1")).toEqual({
      error: "This booking can't be marked complete until its end time has passed.",
    });
  });
});

describe("organizerMarkComplete", () => {
  it("marks a confirmed, past-end-time booking as completed", async () => {
    supabaseMock = makeSupabase({
      user: { id: ORGANIZER_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: null,
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        status: "confirmed",
        booked_date: "2020-01-01",
        booked_end_time: "00:00:00",
      },
    });
    const result = await organizerMarkComplete("booking-1");
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__updated.package_bookings).toEqual({ status: "completed" });
  });

  it("rejects when the caller isn't the organizer", async () => {
    supabaseMock = makeSupabase({
      user: { id: TALENT_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: null,
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        status: "confirmed",
        booked_date: "2020-01-01",
        booked_end_time: "00:00:00",
      },
    });
    expect(await organizerMarkComplete("booking-1")).toEqual({
      error: "Only the organizer can mark this booking completed.",
    });
  });

  it("rejects when the booking isn't confirmed", async () => {
    supabaseMock = makeSupabase({
      user: { id: ORGANIZER_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: null,
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        status: "dealing",
        booked_date: "2020-01-01",
        booked_end_time: "00:00:00",
      },
    });
    expect(await organizerMarkComplete("booking-1")).toEqual({ error: "This booking isn't confirmed yet." });
  });

  it("rejects before the booking's end time has passed", async () => {
    supabaseMock = makeSupabase({
      user: { id: ORGANIZER_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: null,
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 5_000_000,
        status: "confirmed",
        booked_date: "2999-01-01",
        booked_end_time: "00:00:00",
      },
    });
    expect(await organizerMarkComplete("booking-1")).toEqual({
      error: "This booking can't be marked completed until its end time has passed.",
    });
  });
});

describe("submitCounterOffer", () => {
  it("sets the talent's new offer and flips the turn to the organizer", async () => {
    supabaseMock = makeSupabase({
      user: { id: TALENT_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: "talent",
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 4_500_000,
      },
    });
    const formData = new FormData();
    formData.set("offerVnd", "6000000");
    const result = await submitCounterOffer("booking-1", formData);
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__updated.package_bookings).toEqual({
      talent_offer_vnd: 6_000_000,
      awaiting_response_from: "organizer",
      status: "dealing",
    });
  });

  it("sets the organizer's new offer and flips the turn to the talent", async () => {
    supabaseMock = makeSupabase({
      user: { id: ORGANIZER_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: "organizer",
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 4_500_000,
      },
    });
    const formData = new FormData();
    formData.set("offerVnd", "4800000");
    const result = await submitCounterOffer("booking-1", formData);
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__updated.package_bookings).toEqual({
      organizer_offer_vnd: 4_800_000,
      awaiting_response_from: "talent",
      status: "dealing",
    });
  });

  it("rejects a non-positive offer amount", async () => {
    supabaseMock = makeSupabase({
      user: { id: TALENT_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: "talent",
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 4_500_000,
      },
    });
    const formData = new FormData();
    formData.set("offerVnd", "0");
    expect(await submitCounterOffer("booking-1", formData)).toEqual({ error: "Enter a valid offer amount." });
  });

  it("rejects when it isn't the caller's turn", async () => {
    supabaseMock = makeSupabase({
      user: { id: TALENT_ID },
      booking: {
        organizer_id: ORGANIZER_ID,
        talent_id: TALENT_ID,
        awaiting_response_from: "organizer",
        talent_offer_vnd: 5_000_000,
        organizer_offer_vnd: 4_500_000,
      },
    });
    const formData = new FormData();
    formData.set("offerVnd", "6000000");
    expect(await submitCounterOffer("booking-1", formData)).toEqual({
      error: "It's not your turn to respond to this offer.",
    });
  });
});

describe("rejectBooking", () => {
  it("cancels the booking and clears the pending turn", async () => {
    supabaseMock = makeSupabase({ user: { id: TALENT_ID } });
    const result = await rejectBooking("booking-1");
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__updated.package_bookings).toEqual({
      status: "cancelled",
      awaiting_response_from: null,
    });
  });
});

describe("addToCart", () => {
  function cartFormData(overrides: Record<string, string> = {}): FormData {
    const formData = new FormData();
    formData.set("packageId", "pkg-1");
    formData.set("priceVnd", "1000000");
    formData.set("cityId", "city-hcm");
    formData.set("address", "123 Main St");
    formData.set("bookedTime", "10:00");
    formData.set("bookedEndTime", "11:00");
    for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
    return formData;
  }

  it("revalidates the organizer layout so the cart badge/dropdown refresh on the next navigation", async () => {
    supabaseMock = makeSupabase({ user: { id: USER_ID } });
    const result = await addToCart(cartFormData());

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith("/organizer", "layout");
  });

  it("requires a perform city", async () => {
    supabaseMock = makeSupabase({ user: { id: USER_ID } });
    expect(await addToCart(cartFormData({ cityId: "" }))).toEqual({ error: "Select the perform city." });
  });

  it("requires a perform address", async () => {
    supabaseMock = makeSupabase({ user: { id: USER_ID } });
    expect(await addToCart(cartFormData({ address: "" }))).toEqual({ error: "Enter the perform address." });
  });

  it("requires an end time", async () => {
    supabaseMock = makeSupabase({ user: { id: USER_ID } });
    expect(await addToCart(cartFormData({ bookedEndTime: "" }))).toEqual({
      error: "Enter an end time for this booking.",
    });
  });

  it("rejects an end time at or before the start time", async () => {
    supabaseMock = makeSupabase({ user: { id: USER_ID } });
    expect(await addToCart(cartFormData({ bookedTime: "10:00", bookedEndTime: "10:00" }))).toEqual({
      error: "End time must be after start time.",
    });
  });

  it("persists the booked start and end time", async () => {
    supabaseMock = makeSupabase({ user: { id: USER_ID } });
    await addToCart(cartFormData({ bookedTime: "14:00", bookedEndTime: "15:30" }));
    expect(supabaseMock.__inserted.cart_items).toMatchObject({
      booked_time: "14:00",
      booked_end_time: "15:30",
    });
  });

  it("rejects a booking that overlaps the talent's existing confirmed schedule, even from a different organizer", async () => {
    supabaseMock = makeSupabase({
      user: { id: USER_ID },
      busySlots: [{ busy_date: "2026-12-01", start_time: "10:30:00", end_time: "12:00:00" }],
    });
    const result = await addToCart(
      cartFormData({ bookedDate: "2026-12-01", bookedTime: "10:00", bookedEndTime: "11:00" })
    );
    expect(result).toEqual({ error: "This talent is already booked 10:30-12:00 on 2026-12-01." });
    expect(supabaseMock.__inserted.cart_items).toBeUndefined();
  });

  it("allows a booking that does not overlap any busy slot", async () => {
    supabaseMock = makeSupabase({
      user: { id: USER_ID },
      busySlots: [{ busy_date: "2026-12-01", start_time: "10:30:00", end_time: "12:00:00" }],
    });
    const result = await addToCart(
      cartFormData({ bookedDate: "2026-12-01", bookedTime: "13:00", bookedEndTime: "14:00" })
    );
    expect(result).toEqual({ success: true });
  });

  it("ignores busy slots on a different date", async () => {
    supabaseMock = makeSupabase({
      user: { id: USER_ID },
      busySlots: [{ busy_date: "2026-12-02", start_time: "10:00:00", end_time: "11:00:00" }],
    });
    const result = await addToCart(
      cartFormData({ bookedDate: "2026-12-01", bookedTime: "10:00", bookedEndTime: "11:00" })
    );
    expect(result).toEqual({ success: true });
  });
});

describe("checkoutCart", () => {
  it("inserts package_bookings with payment_method: Prepaid and payment_channel from formData", async () => {
    supabaseMock = makeSupabase({ user: { id: USER_ID } });
    const result = await checkoutCart(checkoutFormData({ paymentChannel: "crypto" }));
    expect(result).toEqual({ success: true });
    expect(supabaseMock.__inserted.package_bookings).toBeDefined();
    expect(supabaseMock.__inserted.package_bookings?.[0]).toMatchObject({
      payment_method: "Prepaid",
      payment_channel: "crypto",
    });
  });
});
