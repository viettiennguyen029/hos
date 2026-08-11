"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveDisputeByRelease, resolveDisputeByRefund } from "@/lib/supabase/admin-actions";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/toast-action";

export function DisputeRowActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleRelease() {
    setPending(true);
    const result = await runAction(resolveDisputeByRelease(bookingId), { success: "Funds released to talent." });
    setPending(false);
    if (!("error" in result)) router.refresh();
  }

  async function handleRefund() {
    setPending(true);
    const result = await runAction(resolveDisputeByRefund(bookingId), { success: "Organizer refunded." });
    setPending(false);
    if (!("error" in result)) router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button disabled={pending} onClick={handleRelease}>
        Release to Talent
      </Button>
      <Button variant="outline" disabled={pending} onClick={handleRefund}>
        Refund Organizer
      </Button>
    </div>
  );
}
