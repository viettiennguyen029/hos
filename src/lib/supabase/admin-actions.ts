"use server";

import { isCurrentUserAdmin } from "@/lib/supabase/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { releaseEscrowAsAdmin, refundEscrowAsAdmin } from "@/lib/chain/escrow";

async function getEscrowBookingId(bookingId: string): Promise<string> {
  const service = createServiceClient();
  const { data, error } = await service.from("package_bookings").select("escrow_booking_id").eq("id", bookingId).single();
  if (error || !data?.escrow_booking_id) throw new Error("This booking has no on-chain escrow to resolve.");
  return data.escrow_booking_id;
}

export async function resolveDisputeByRelease(bookingId: string): Promise<{ error: string } | { success: true }> {
  if (!(await isCurrentUserAdmin())) return { error: "Admin access required." };

  try {
    const escrowBookingId = await getEscrowBookingId(bookingId);
    await releaseEscrowAsAdmin(createServiceClient(), escrowBookingId as `0x${string}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to release funds." };
  }
  return { success: true };
}

export async function resolveDisputeByRefund(bookingId: string): Promise<{ error: string } | { success: true }> {
  if (!(await isCurrentUserAdmin())) return { error: "Admin access required." };

  try {
    const escrowBookingId = await getEscrowBookingId(bookingId);
    await refundEscrowAsAdmin(createServiceClient(), escrowBookingId as `0x${string}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to refund organizer." };
  }
  return { success: true };
}

export async function updateTalentCommission(
  talentId: string,
  commissionBps: number
): Promise<{ error: string } | { success: true }> {
  if (!(await isCurrentUserAdmin())) return { error: "Admin access required." };
  if (commissionBps < 0 || commissionBps > 10000) {
    return { error: "Commission must be between 0 and 10000 basis points." };
  }

  const { error } = await createServiceClient()
    .from("profiles")
    .update({ commission_bps: commissionBps })
    .eq("id", talentId);
  if (error) return { error: error.message };
  return { success: true };
}
