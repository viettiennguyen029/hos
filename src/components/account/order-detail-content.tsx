"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  confirmBookingOffer,
  depositBookingEscrow,
  markBookingPaid,
  organizerMarkComplete,
  rejectBooking,
  submitCounterOffer,
  talentMarkComplete,
} from "@/lib/supabase/package-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { buildIcsContent } from "@/lib/ics";
import { hasEndTimePassed } from "@/lib/booking-time";
import { runAction } from "@/lib/toast-action";
import type { BookingDetail, BookingParty } from "@/lib/supabase/types";
import type { Role } from "@/lib/nav-items";

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const NEGOTIATION_STATUSES = new Set(["pending", "dealing"]);

/** Not designed in Figma yet -- flip this once the check-in flow itself is ready. */
const CHECK_IN_QR_ENABLED = false;

export function OrderDetailContent({ role, booking }: { role: Role; booking: BookingDetail }) {
  const router = useRouter();
  const myRole: BookingParty = role === "organizer" ? "organizer" : "talent";
  const otherRole: BookingParty = myRole === "organizer" ? "talent" : "organizer";
  const [pending, setPending] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);

  const isMyTurn = booking.awaiting_response_from === myRole;
  const isNegotiating = NEGOTIATION_STATUSES.has(booking.status);
  const isConfirmed = booking.status === "confirmed" || booking.status === "completed";
  const needsPayment =
    isConfirmed && booking.payment_method === "Prepaid" && booking.payment_status === "pending" && booking.payment_channel !== "crypto";
  const needsCryptoDeposit =
    isConfirmed && booking.payment_channel === "crypto" && booking.escrow_state === "registered";
  const isPaid =
    isConfirmed &&
    (booking.payment_channel === "crypto"
      ? booking.escrow_state === "funded" || booking.escrow_state === "released"
      : !needsPayment);
  const isFullyCompleted = booking.status === "completed";
  const canMarkComplete =
    booking.status === "confirmed" && hasEndTimePassed(booking.booked_date, booking.booked_end_time);
  const agreedOffer = myRole === "organizer" ? booking.talent_offer_vnd : booking.organizer_offer_vnd;

  async function handleConfirm() {
    setPending(true);
    const result = await runAction(confirmBookingOffer(booking.id), { success: "Order confirmed." });
    setPending(false);
    if (!("error" in result)) router.refresh();
  }

  async function handleCancel() {
    setPending(true);
    const result = await runAction(rejectBooking(booking.id), { success: "Booking cancelled." });
    setPending(false);
    if (!("error" in result)) router.refresh();
  }

  async function handleMarkPaid() {
    setPending(true);
    const result = await runAction(markBookingPaid(booking.id), { success: "Payment confirmed." });
    setPending(false);
    if (!("error" in result)) {
      setPaymentOpen(false);
      router.refresh();
    }
  }

  async function handleTalentMarkComplete() {
    setPending(true);
    const result = await runAction(talentMarkComplete(booking.id), {
      success: "Marked complete. The organizer has been notified.",
    });
    setPending(false);
    if (!("error" in result)) router.refresh();
  }

  async function handleOrganizerMarkComplete() {
    setPending(true);
    const result = await runAction(organizerMarkComplete(booking.id), { success: "Booking completed." });
    setPending(false);
    if (!("error" in result)) router.refresh();
  }

  async function handleDeposit() {
    setPending(true);
    const result = await runAction(depositBookingEscrow(booking.id), { success: "Deposit submitted." });
    setPending(false);
    if (!("error" in result)) router.refresh();
  }

  function handleAddToCalendar() {
    if (!booking.booked_date || !booking.booked_time || !booking.booked_end_time) return;
    const ics = buildIcsContent({
      uid: booking.id,
      title: booking.package_title,
      date: booking.booked_date,
      startTime: booking.booked_time,
      endTime: booking.booked_end_time,
      location: booking.venue_address ?? booking.venue_city_name,
    });
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${booking.package_title.replace(/\s+/g, "-")}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-5 rounded-md bg-white/5 p-6">
        <h2 className="text-lg font-bold text-foreground">Booking Information</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Organizer</span>
            <span className="text-sm font-medium text-foreground">{booking.organizer_name}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Talent</span>
            <span className="text-sm font-medium text-foreground">{booking.talent_name}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Booking Status
            </span>
            <span className="text-sm font-medium text-foreground">{capitalize(booking.status)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Booking ID</span>
            <span className="text-sm font-medium text-foreground">#{booking.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Payment Method
            </span>
            <span className="text-sm font-medium text-foreground">{booking.payment_method}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-[8px] bg-white/5 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Talent Offer</span>
            <span className="font-medium text-foreground">{formatVnd(booking.talent_offer_vnd)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Organizer Offer</span>
            <span className="font-medium text-foreground">{formatVnd(booking.organizer_offer_vnd)}</span>
          </div>
          {!isNegotiating && (
            <div className="mt-1 flex justify-between border-t border-border pt-2">
              <span className="font-semibold text-foreground">Agreed Price</span>
              <span className="font-semibold text-foreground">{formatVnd(booking.price_vnd)}</span>
            </div>
          )}
        </div>

        {isNegotiating && (
          <div className="flex flex-col gap-2">
            <Button className="h-11 w-full rounded-[6px]" disabled={!isMyTurn || pending} onClick={handleConfirm}>
              Order Confirm
            </Button>
            <Button
              variant="secondary"
              className="h-11 w-full rounded-[6px]"
              disabled={!isMyTurn || pending}
              onClick={() => setCounterOpen(true)}
            >
              Add New Offer
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full rounded-[6px] text-muted-foreground"
              disabled={pending}
              onClick={handleCancel}
            >
              Cancel
            </Button>
            {!isMyTurn && (
              <p className="text-center text-xs text-muted-foreground">
                Waiting for {otherRole === "talent" ? "Talent" : "Organizer"}&apos;s Offer
              </p>
            )}
          </div>
        )}

        {needsPayment && (
          <div className="flex flex-col gap-2">
            {myRole === "organizer" ? (
              <Button
                className="h-11 w-full rounded-[6px]"
                disabled={pending}
                onClick={() => setPaymentOpen(true)}
              >
                Proceed to Payment
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Waiting for the organizer to complete payment.
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full rounded-[6px] text-muted-foreground"
              disabled={pending}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        )}

        {needsCryptoDeposit && myRole === "organizer" && (
          <Button disabled={pending} onClick={handleDeposit} className="h-11 w-full rounded-[6px]">
            {pending ? "Depositing..." : "Deposit"}
          </Button>
        )}

        {isPaid && (
          <div className="flex flex-col gap-2">
            {CHECK_IN_QR_ENABLED && myRole === "organizer" && (
              <Button className="h-11 w-full rounded-[6px]" onClick={() => setCheckInOpen(true)}>
                Generate check-in QR Code for Talent
              </Button>
            )}
            <Button variant="secondary" className="h-11 w-full rounded-[6px]" onClick={handleAddToCalendar}>
              Add to Calendar
            </Button>

            {!isFullyCompleted && myRole === "organizer" && (
              <Button
                className="h-11 w-full rounded-[6px]"
                disabled={!canMarkComplete || pending}
                onClick={handleOrganizerMarkComplete}
              >
                Mark as Completed
              </Button>
            )}
            {!isFullyCompleted && myRole === "organizer" && booking.talent_marked_complete_at && (
              <p className="text-center text-xs text-muted-foreground">
                Talent marked this complete on {new Date(booking.talent_marked_complete_at).toLocaleString()}.
              </p>
            )}

            {!isFullyCompleted && myRole === "talent" && !booking.talent_marked_complete_at && (
              <Button
                className="h-11 w-full rounded-[6px]"
                disabled={!canMarkComplete || pending}
                onClick={handleTalentMarkComplete}
              >
                Mark as Complete
              </Button>
            )}
            {!isFullyCompleted && myRole === "talent" && booking.talent_marked_complete_at && (
              <p className="text-center text-xs text-muted-foreground">
                You marked this complete — waiting for the organizer.
              </p>
            )}

            {isFullyCompleted && (
              <p className="text-center text-xs text-muted-foreground">This booking is complete.</p>
            )}

            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full rounded-[6px] text-muted-foreground"
              disabled={pending}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 rounded-md bg-white/5 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-foreground">Booking Detail</h2>
          <span className="text-xl font-bold text-foreground">{booking.package_title}</span>
          {booking.venue_city_name && (
            <span className="text-sm text-muted-foreground">{booking.venue_city_name}</span>
          )}
        </div>

        {booking.venue_address && (
          <div className="flex flex-col gap-1 border-t border-border pt-4">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Perform Address
            </span>
            <span className="text-sm text-foreground">{booking.venue_address}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Date</span>
            <span className="text-sm text-foreground">{booking.booked_date ?? "Flexible"}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Time</span>
            <span className="text-sm text-foreground">
              {booking.booked_time && booking.booked_end_time
                ? `${booking.booked_time} - ${booking.booked_end_time}`
                : "Flexible"}
            </span>
          </div>
        </div>

        {booking.package_description && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Note</span>
            <span className="text-sm text-foreground">{booking.package_description}</span>
          </div>
        )}

        {booking.package_working_method && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Working Method
            </span>
            <span className="text-sm text-foreground">{booking.package_working_method}</span>
          </div>
        )}

        {booking.package_skill_tags.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Skill Requirement
            </span>
            <div className="flex flex-wrap gap-2">
              {booking.package_skill_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {counterOpen && (
        <CounterOfferDialog
          bookingId={booking.id}
          currentOfferVnd={agreedOffer}
          onOpenChange={setCounterOpen}
          onSubmitted={() => {
            setCounterOpen(false);
            router.refresh();
          }}
        />
      )}

      {paymentOpen && (
        <PaymentDialog
          bookingId={booking.id}
          amountVnd={booking.price_vnd}
          pending={pending}
          onOpenChange={setPaymentOpen}
          onConfirmPaid={handleMarkPaid}
        />
      )}

      {checkInOpen && <CheckInQrDialog bookingId={booking.id} onOpenChange={setCheckInOpen} />}
    </div>
  );
}

function PaymentDialog({
  bookingId,
  amountVnd,
  pending,
  onOpenChange,
  onConfirmPaid,
}: {
  bookingId: string;
  amountVnd: number;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmPaid: () => void;
}) {
  const transferNote = `HOS${bookingId.slice(0, 8).toUpperCase()}`;
  const bankAccountNumber = "0000111222333";
  const bankName = "Heart of Show Bank";
  const qrValue = `Bank: ${bankName}\nAccount: ${bankAccountNumber}\nAmount: ${amountVnd}\nNote: ${transferNote}`;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Payment - Final step</DialogTitle>
          <DialogDescription>
            Please make payment by bank transfer to account number below. Carefully check the content of the
            transfer according to the instructions.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between rounded-[8px] bg-white/5 p-3">
            <span className="text-muted-foreground">Account number</span>
            <span className="font-semibold text-foreground">{bankAccountNumber}</span>
          </div>
          <div className="flex items-center justify-between rounded-[8px] bg-white/5 p-3">
            <span className="text-muted-foreground">Bank name</span>
            <span className="font-semibold text-foreground">{bankName}</span>
          </div>
          <div className="flex items-center justify-between rounded-[8px] bg-white/5 p-3">
            <span className="text-muted-foreground">Transfer note</span>
            <span className="font-semibold text-foreground">{transferNote}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 py-2">
          <span className="text-xs text-muted-foreground">Scan this QR</span>
          <QRCodeSVG value={qrValue} size={180} />
        </div>
        <Button onClick={onConfirmPaid} disabled={pending} className={cn("h-11 w-full rounded-[6px]")}>
          {pending ? "Confirming..." : "I already did that"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          *After completing the booking, we will send you a notification
        </p>
      </DialogContent>
    </Dialog>
  );
}

function CheckInQrDialog({
  bookingId,
  onOpenChange,
}: {
  bookingId: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Check-in QR Code</DialogTitle>
          <DialogDescription>Show this to the talent to check in at the event.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-2 py-4">
          <QRCodeSVG value={`HOS-CHECKIN:${bookingId}`} size={200} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CounterOfferDialog({
  bookingId,
  currentOfferVnd,
  onOpenChange,
  onSubmitted,
}: {
  bookingId: string;
  currentOfferVnd: number;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const [amount, setAmount] = useState(String(currentOfferVnd));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit() {
    setError(undefined);
    setPending(true);
    const formData = new FormData();
    formData.set("offerVnd", amount);
    const result = await runAction(submitCounterOffer(bookingId, formData), { success: "Offer sent." });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onSubmitted();
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add new Offer</DialogTitle>
          <DialogDescription>Your offer request</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="offer-vnd" className="text-sm text-muted-foreground">
            Your offer request (VND)
          </Label>
          <Input
            id="offer-vnd"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 rounded-[6px]"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit} disabled={pending} className={cn("h-11 w-full rounded-[6px]")}>
          {pending ? "Sending..." : "Send Offer Request"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
