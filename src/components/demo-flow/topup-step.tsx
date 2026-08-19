"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoFlow } from "@/lib/demo-flow/context";
import { DEMO_BOOKING } from "@/lib/demo-flow/constants";

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

export function TopupStep() {
  const { funded, setFunded } = useDemoFlow();
  const [pending, setPending] = useState(false);

  function handleDeposit() {
    setPending(true);
    setTimeout(() => {
      setPending(false);
      setFunded(true);
    }, 1500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">6. Fund the Escrow</h1>
        <p className="text-sm text-muted-foreground">
          Lock the full amount into the contract — one signature, no gas fee for you.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-md bg-white/5 p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Amount to deposit</span>
          <span className="text-lg font-bold text-foreground">{formatVnd(DEMO_BOOKING.amountVnd)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Chain</span>
          <span className="font-semibold text-foreground">{DEMO_BOOKING.chain}</span>
        </div>

        {!funded ? (
          <Button disabled={pending} onClick={handleDeposit} className="h-11 w-full rounded-[6px]">
            {pending ? "Processing deposit..." : "Deposit via Crypto (gasless)"}
          </Button>
        ) : (
          <p className="flex items-center gap-2 rounded-[8px] bg-green-500/10 p-3 text-sm text-green-500">
            <CheckCircle2 className="size-4 shrink-0" />
            Funds locked in escrow.
          </p>
        )}
      </div>

      {funded && (
        <Button asChild className="h-11 w-full rounded-[6px]">
          <Link href="/demo/booked">Continue</Link>
        </Button>
      )}
    </div>
  );
}
