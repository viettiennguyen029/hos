"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoFlow } from "@/lib/demo-flow/context";
import { DEMO_BOOKING, DEMO_TALENT } from "@/lib/demo-flow/constants";

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

export function ContractReviewStep() {
  const { criteria, agreed, setAgreed } = useDemoFlow();

  if (agreed) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">5. Contract Agreed</h1>
          <p className="text-sm text-muted-foreground">Both parties have signed. Next, fund the escrow.</p>
        </div>

        <div className="flex flex-col gap-3 rounded-md bg-white/5 p-6">
          <div className="flex items-center justify-between rounded-[8px] bg-green-500/10 p-3 text-sm text-green-500">
            <span>Organizer</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="size-4" /> Signed
            </span>
          </div>
          <div className="flex items-center justify-between rounded-[8px] bg-green-500/10 p-3 text-sm text-green-500">
            <span>{DEMO_TALENT.name}</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="size-4" /> Signed
            </span>
          </div>
        </div>

        <Button asChild className="h-11 w-full rounded-[6px]">
          <Link href="/demo/topup">Continue to Payment</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">5. Review the Contract</h1>
        <p className="text-sm text-muted-foreground">
          Confirm the terms before locking funds into the smart contract.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-md bg-white/5 p-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Talent" value={DEMO_TALENT.name} />
          <Field label="Booking" value={DEMO_BOOKING.packageTitle} />
          <Field label="Amount to escrow" value={formatVnd(DEMO_BOOKING.amountVnd)} />
          <Field label="Chain" value={DEMO_BOOKING.chain} />
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Completion Criteria
          </span>
          {criteria.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{c.label}</span>
              <span className="font-semibold text-foreground">{c.weightPct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md bg-white/5 p-6 text-sm text-muted-foreground">
        <p>Funds release automatically for whatever share of criteria are met once the job is marked complete.</p>
        <p>If the organizer goes silent after the event, funds auto-release to the talent after a grace period.</p>
      </div>

      <div className="flex gap-3">
        <Button asChild variant="ghost" className="h-11 flex-1 rounded-[6px] text-muted-foreground">
          <Link href="/demo/contract/create">Back to Edit</Link>
        </Button>
        <Button onClick={() => setAgreed(true)} className="h-11 flex-[2] rounded-[6px]">
          Agree &amp; Sign
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
