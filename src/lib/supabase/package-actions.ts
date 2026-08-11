"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertKycVerified } from "@/lib/supabase/kyc";
import { hasEndTimePassed } from "@/lib/booking-time";
import { timeRangesOverlap } from "@/lib/time-overlap";
import type { PaymentMethod } from "@/lib/supabase/types";

export async function createPackage(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const categoryId = String(formData.get("categoryId") ?? "");
  const subcategoryId = String(formData.get("subcategoryId") ?? "") || null;
  const title = String(formData.get("title") ?? "");
  const residency = String(formData.get("residency") ?? "") || null;
  const cityId = String(formData.get("cityId") ?? "");
  const workingMethod = String(formData.get("workingMethod") ?? "") || null;
  const skillTagsRaw = String(formData.get("skillTags") ?? "");
  const skillTags = skillTagsRaw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const repeatOn = formData.get("repeatOn") === "true";
  const repeatDaysRaw = String(formData.get("repeatDays") ?? "");
  const repeatDays = repeatOn && repeatDaysRaw ? repeatDaysRaw.split(",") : null;
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const description = String(formData.get("description") ?? "") || null;
  const priceMinVnd = Number(formData.get("priceMin") ?? 0);
  const priceMaxVnd = Number(formData.get("priceMax") ?? 0);
  const paymentMethod = String(formData.get("paymentMethod") ?? "Prepaid");

  const { error } = await supabase.from("packages").insert({
    talent_id: user.id,
    category_id: categoryId,
    subcategory_id: subcategoryId,
    title,
    residency,
    city_id: cityId,
    working_method: workingMethod,
    skill_tags: skillTags,
    repeat_on: repeatOn,
    repeat_days: repeatDays,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
    description,
    price_min_vnd: priceMinVnd,
    price_max_vnd: priceMaxVnd,
    payment_method: paymentMethod,
  });

  if (error) return { error: error.message };
  revalidatePath("/talent/account/packages");
  return { success: true };
}

export async function updatePackage(
  packageId: string,
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const categoryId = String(formData.get("categoryId") ?? "");
  const subcategoryId = String(formData.get("subcategoryId") ?? "") || null;
  const title = String(formData.get("title") ?? "");
  const residency = String(formData.get("residency") ?? "") || null;
  const cityId = String(formData.get("cityId") ?? "");
  const workingMethod = String(formData.get("workingMethod") ?? "") || null;
  const skillTagsRaw = String(formData.get("skillTags") ?? "");
  const skillTags = skillTagsRaw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const repeatOn = formData.get("repeatOn") === "true";
  const repeatDaysRaw = String(formData.get("repeatDays") ?? "");
  const repeatDays = repeatOn && repeatDaysRaw ? repeatDaysRaw.split(",") : null;
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const description = String(formData.get("description") ?? "") || null;
  const priceMinVnd = Number(formData.get("priceMin") ?? 0);
  const priceMaxVnd = Number(formData.get("priceMax") ?? 0);
  const paymentMethod = String(formData.get("paymentMethod") ?? "Prepaid");

  const { error } = await supabase
    .from("packages")
    .update({
      category_id: categoryId,
      subcategory_id: subcategoryId,
      title,
      residency,
      city_id: cityId,
      working_method: workingMethod,
      skill_tags: skillTags,
      repeat_on: repeatOn,
      repeat_days: repeatDays,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      description,
      price_min_vnd: priceMinVnd,
      price_max_vnd: priceMaxVnd,
      payment_method: paymentMethod,
    })
    .eq("id", packageId)
    .eq("talent_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/talent/account/packages");
  return { success: true };
}

export async function deletePackage(packageId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const { count } = await supabase
    .from("package_bookings")
    .select("id", { count: "exact", head: true })
    .eq("package_id", packageId);
  if (count && count > 0) {
    return { error: "This package has bookings and can't be deleted. Close it instead." };
  }

  const { error } = await supabase.from("packages").delete().eq("id", packageId).eq("talent_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/talent/account/packages");
  return { success: true };
}

export async function addToCart(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const packageId = String(formData.get("packageId") ?? "");
  const priceVnd = Number(formData.get("priceVnd") ?? 0);
  const bookedDate = String(formData.get("bookedDate") ?? "") || null;
  const bookedTime = String(formData.get("bookedTime") ?? "") || null;
  const bookedEndTime = String(formData.get("bookedEndTime") ?? "") || null;
  const cityId = String(formData.get("cityId") ?? "") || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  if (!cityId) return { error: "Select the perform city." };
  if (!address) return { error: "Enter the perform address." };
  // The package's own start_time/end_time is the talent's availability
  // window (e.g. 9AM-6PM) -- the organizer picks a start inside it but must
  // say how long they actually need the talent for.
  if (!bookedEndTime) return { error: "Enter an end time for this booking." };
  if (bookedTime && bookedEndTime <= bookedTime) return { error: "End time must be after start time." };

  // Checked here (not just client-side) so two organizers racing for the
  // same talent can't both slip a colliding booking through, and so it's
  // enforced even if the client-side check gets bypassed.
  if (bookedDate && bookedTime) {
    const { data: pkg } = await supabase.from("packages").select("talent_id").eq("id", packageId).single();
    if (pkg) {
      const { data: busySlots } = await supabase.rpc("get_talent_busy_slots", { p_talent_id: pkg.talent_id });
      const conflict = (busySlots ?? []).find(
        (slot: { busy_date: string; start_time: string; end_time: string }) =>
          slot.busy_date === bookedDate && timeRangesOverlap(bookedTime, bookedEndTime, slot.start_time, slot.end_time)
      );
      if (conflict) {
        return {
          error: `This talent is already booked ${conflict.start_time.slice(0, 5)}-${conflict.end_time.slice(0, 5)} on ${bookedDate}.`,
        };
      }
    }
  }

  const { error } = await supabase.from("cart_items").insert({
    organizer_id: user.id,
    package_id: packageId,
    price_vnd: priceVnd,
    booked_date: bookedDate,
    booked_time: bookedTime,
    booked_end_time: bookedEndTime,
    city_id: cityId,
    address,
  });

  if (error) return { error: error.message };
  // The organizer layout fetches cart items once per navigation; without this,
  // the topbar's cart badge/dropdown stay stale after adding an item.
  revalidatePath("/organizer", "layout");
  return { success: true };
}

export async function removeFromCart(
  cartItemId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function checkoutCart(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const paymentChannel = String(formData.get("paymentChannel") ?? "fiat") as "fiat" | "crypto";
  const itemIds = formData.getAll("itemIds").map(String);
  if (itemIds.length === 0) return { error: "Select at least one item to check out." };

  const { data: items } = await supabase
    .from("cart_items")
    .select("*")
    .eq("organizer_id", user.id)
    .in("id", itemIds);

  if (!items || items.length === 0) return { error: "Your cart is empty." };

  const { error: insertError } = await supabase.from("package_bookings").insert(
    items.map((item) => ({
      package_id: item.package_id,
      organizer_id: user.id,
      price_vnd: item.price_vnd,
      // The organizer's checkout price is the opening offer, mirrored on
      // both sides until either party counters — the talent owes the first
      // response.
      talent_offer_vnd: item.price_vnd,
      organizer_offer_vnd: item.price_vnd,
      awaiting_response_from: "talent",
      booked_date: item.booked_date,
      booked_time: item.booked_time,
      booked_end_time: item.booked_end_time,
      city_id: item.city_id,
      address: item.address,
      payment_method: "Prepaid",
      payment_channel: paymentChannel,
    }))
  );
  if (insertError) return { error: insertError.message };

  await supabase
    .from("cart_items")
    .delete()
    .in("id", items.map((i) => i.id));

  return { success: true };
}

/** Who the signed-in user is relative to this booking, or null if neither. */
async function actorRoleFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
  userId: string
): Promise<
  | { error: string }
  | {
      role: "talent" | "organizer";
      awaitingResponseFrom: "talent" | "organizer" | null;
      talentOfferVnd: number;
      organizerOfferVnd: number;
      paymentMethod: PaymentMethod;
    }
> {
  const { data: booking } = await supabase
    .from("package_bookings")
    .select(
      "organizer_id, awaiting_response_from, talent_offer_vnd, organizer_offer_vnd, payment_method, package:packages(talent_id)"
    )
    .eq("id", bookingId)
    .single();
  if (!booking) return { error: "Booking not found." };

  const packageTalentId = (booking.package as unknown as { talent_id: string } | null)?.talent_id;
  const role = booking.organizer_id === userId ? "organizer" : packageTalentId === userId ? "talent" : null;
  if (!role) return { error: "You are not part of this booking." };

  return {
    role,
    awaitingResponseFrom: booking.awaiting_response_from,
    talentOfferVnd: booking.talent_offer_vnd,
    organizerOfferVnd: booking.organizer_offer_vnd,
    paymentMethod: booking.payment_method,
  };
}

/** Accept the offer currently on the table — whichever party's turn it is. */
export async function confirmBookingOffer(
  bookingId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const actor = await actorRoleFor(supabase, bookingId, user.id);
  if ("error" in actor) return actor;
  if (actor.awaitingResponseFrom !== actor.role) return { error: "It's not your turn to respond to this offer." };

  // Confirming accepts the OTHER party's last offer.
  const agreedPrice = actor.role === "organizer" ? actor.talentOfferVnd : actor.organizerOfferVnd;
  // Postpaid bookings settle after the event, so there's nothing to collect
  // up front; Prepaid bookings stay 'pending' until the organizer pays.
  const paymentStatus = actor.paymentMethod === "Postpaid" ? "complete" : "pending";

  const { error } = await supabase
    .from("package_bookings")
    .update({ status: "confirmed", price_vnd: agreedPrice, awaiting_response_from: null, payment_status: paymentStatus })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  return { success: true };
}

/** Organizer confirms they've sent a Prepaid booking's bank transfer. */
export async function markBookingPaid(bookingId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const { data: booking } = await supabase
    .from("package_bookings")
    .select("organizer_id, status, payment_method, payment_status")
    .eq("id", bookingId)
    .single();
  if (!booking) return { error: "Booking not found." };
  if (booking.organizer_id !== user.id) return { error: "Only the organizer can confirm payment for this booking." };
  if (booking.status !== "confirmed" && booking.status !== "completed") {
    return { error: "This booking isn't confirmed yet." };
  }
  if (booking.payment_method !== "Prepaid") return { error: "This booking doesn't require prepayment." };
  if (booking.payment_status === "complete") return { success: true };

  const { error } = await supabase
    .from("package_bookings")
    .update({ payment_status: "complete" })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  return { success: true };
}

/** Talent flags that the event happened -- proof + a reminder notification, no status change. */
export async function talentMarkComplete(bookingId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const { data: booking } = await supabase
    .from("package_bookings")
    .select("status, booked_date, booked_end_time, package:packages(talent_id)")
    .eq("id", bookingId)
    .single();
  if (!booking) return { error: "Booking not found." };
  const packageTalentId = (booking.package as unknown as { talent_id: string } | null)?.talent_id;
  if (packageTalentId !== user.id) return { error: "Only the talent can mark this booking complete." };
  if (booking.status !== "confirmed") return { error: "This booking isn't confirmed yet." };
  if (!hasEndTimePassed(booking.booked_date, booking.booked_end_time)) {
    return { error: "This booking can't be marked complete until its end time has passed." };
  }

  const { error } = await supabase
    .from("package_bookings")
    .update({ talent_marked_complete_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  return { success: true };
}

/** Organizer marks the booking fully completed -- the only action that moves status to 'completed'. */
export async function organizerMarkComplete(bookingId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const { data: booking } = await supabase
    .from("package_bookings")
    .select("organizer_id, status, booked_date, booked_end_time")
    .eq("id", bookingId)
    .single();
  if (!booking) return { error: "Booking not found." };
  if (booking.organizer_id !== user.id) return { error: "Only the organizer can mark this booking completed." };
  if (booking.status !== "confirmed") return { error: "This booking isn't confirmed yet." };
  if (!hasEndTimePassed(booking.booked_date, booking.booked_end_time)) {
    return { error: "This booking can't be marked completed until its end time has passed." };
  }

  const { error } = await supabase.from("package_bookings").update({ status: "completed" }).eq("id", bookingId);
  if (error) return { error: error.message };
  return { success: true };
}

/** Propose a new price — whichever party's turn it is. Flips the turn to the other side. */
export async function submitCounterOffer(
  bookingId: string,
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const offerVnd = Number(formData.get("offerVnd") ?? 0);
  if (offerVnd <= 0) return { error: "Enter a valid offer amount." };

  const actor = await actorRoleFor(supabase, bookingId, user.id);
  if ("error" in actor) return actor;
  if (actor.awaitingResponseFrom !== actor.role) return { error: "It's not your turn to respond to this offer." };

  const update =
    actor.role === "talent"
      ? { talent_offer_vnd: offerVnd, awaiting_response_from: "organizer" as const }
      : { organizer_offer_vnd: offerVnd, awaiting_response_from: "talent" as const };

  const { error } = await supabase
    .from("package_bookings")
    .update({ ...update, status: "dealing" })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  return { success: true };
}

/** Either party can cancel a booking at any point before it's completed. */
export async function rejectBooking(
  bookingId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const kycError = await assertKycVerified(supabase, user.id);
  if (kycError) return kycError;

  const { error } = await supabase
    .from("package_bookings")
    .update({ status: "cancelled", awaiting_response_from: null })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  return { success: true };
}
