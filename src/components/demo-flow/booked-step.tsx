import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_BOOKING, DEMO_TALENT } from "@/lib/demo-flow/constants";

export function BookedStep() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <CheckCircle2 className="size-14 text-green-500" />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">7. Booking Confirmed &amp; Escrowed</h1>
        <p className="text-sm text-muted-foreground">
          {DEMO_TALENT.name} is booked for {DEMO_BOOKING.eventDate}. Funds are safely locked until the job is done.
        </p>
      </div>

      <Button asChild className="h-11 w-fit rounded-[6px] px-6">
        <Link href="/demo/complete">Simulate: Jump to Event Day →</Link>
      </Button>
    </div>
  );
}
