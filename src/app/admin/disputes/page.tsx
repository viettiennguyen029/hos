import { createServiceClient } from "@/lib/supabase/service";
import { resolveDisputeByRelease, resolveDisputeByRefund } from "@/lib/supabase/admin-actions";
import { Button } from "@/components/ui/button";

export default async function AdminDisputesPage() {
  const supabase = createServiceClient();
  const { data: bookings } = await supabase
    .from("package_bookings")
    .select("id, price_vnd, status, escrow_state, organizer:profiles!package_bookings_organizer_id_fkey(full_name)")
    .eq("payment_channel", "crypto")
    .eq("escrow_state", "funded")
    .eq("status", "cancelled");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Escrow Disputes</h1>
      <p className="text-sm text-muted-foreground">
        Cancelled bookings with funds still locked on-chain. Choose whether the talent gets paid or the organizer gets refunded.
      </p>
      <div className="flex flex-col gap-3">
        {(bookings ?? []).map((booking) => (
          <form
            key={booking.id}
            className="flex items-center justify-between gap-4 rounded-md bg-white/5 p-4"
          >
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-foreground">Booking {booking.id}</span>
              <span className="text-muted-foreground">{booking.price_vnd.toLocaleString("en-US")} VND</span>
            </div>
            <div className="flex gap-2">
              <Button
                formAction={async () => {
                  "use server";
                  await resolveDisputeByRelease(booking.id);
                }}
              >
                Release to Talent
              </Button>
              <Button
                variant="outline"
                formAction={async () => {
                  "use server";
                  await resolveDisputeByRefund(booking.id);
                }}
              >
                Refund Organizer
              </Button>
            </div>
          </form>
        ))}
        {(bookings ?? []).length === 0 && <p className="text-sm text-muted-foreground">No open disputes.</p>}
      </div>
    </div>
  );
}
