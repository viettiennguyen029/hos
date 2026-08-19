"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DEMO_BOOKING, DEMO_TALENT } from "@/lib/demo-flow/constants";
import { cn } from "@/lib/utils";

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

export function CheckoutStep() {
  const router = useRouter();
  const [paymentChannel, setPaymentChannel] = useState<"fiat" | "crypto">("crypto");
  const [pending, setPending] = useState(false);

  function handleSubmit() {
    setPending(true);
    setTimeout(() => router.push("/demo/contract/create"), 900);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">3. Check Out</h1>
        <p className="text-sm text-muted-foreground">Review your booking details before sending the request.</p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col rounded-md bg-white/5 p-6">
          <span className="text-sm font-semibold text-foreground">{DEMO_TALENT.name}</span>
          <span className="mt-1 text-sm text-foreground">
            {DEMO_BOOKING.packageTitle} &middot; {DEMO_TALENT.category}
          </span>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-foreground">
              {DEMO_BOOKING.eventDate}
            </span>
            <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-foreground">
              {DEMO_BOOKING.eventTime}
            </span>
            <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-foreground">
              {DEMO_BOOKING.venueCity}
            </span>
          </div>
        </div>

        <aside className="flex h-fit w-full shrink-0 flex-col gap-5 rounded-md bg-white/5 p-6 md:w-[380px]">
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold tracking-[-0.03em] text-foreground">Payment Method</h2>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: "fiat" as const, label: "Fiat Payment", disabled: true },
                  { value: "crypto" as const, label: "Crypto Payment", disabled: false },
                ]
              ).map(({ value, label, disabled }) => (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setPaymentChannel(value)}
                  className={cn(
                    "flex items-center gap-2 rounded-[8px] border border-transparent bg-white/5 px-4 py-3 text-sm font-medium text-foreground transition-colors",
                    paymentChannel === value && "border-primary bg-primary/5",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      paymentChannel === value ? "border-primary" : "border-white/30"
                    )}
                  >
                    {paymentChannel === value && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  <span className="flex flex-col items-start">
                    {label}
                    {disabled && <span className="text-[10px] font-normal text-muted-foreground">Coming soon</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold tracking-[-0.03em] text-foreground">Order Detail</h2>
            <div className="flex flex-col gap-1 rounded-[8px] bg-white/5 p-5">
              <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                <span>{DEMO_TALENT.name}</span>
                <span>{formatVnd(DEMO_BOOKING.amountVnd)}</span>
              </div>
              <span className="text-xs text-muted-foreground">x1 {DEMO_BOOKING.packageTitle}</span>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-foreground">Payment Total</span>
              <span className="text-lg font-bold text-foreground">{formatVnd(DEMO_BOOKING.amountVnd)}</span>
            </div>
          </div>

          <Button disabled={pending} onClick={handleSubmit} className="h-[52px] w-full rounded-[6px] text-base font-semibold">
            {pending ? "Sending..." : "Send Booking Request"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
