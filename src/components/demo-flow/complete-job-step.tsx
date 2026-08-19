"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useDemoFlow } from "@/lib/demo-flow/context";
import { DEMO_BOOKING, DEMO_TALENT } from "@/lib/demo-flow/constants";
import { computeRelease } from "@/lib/demo-flow/payout";

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

export function CompleteJobStep() {
  const router = useRouter();
  const { criteria, completion, setCompletion } = useDemoFlow();

  const { releasedPct, releasedVnd } = computeRelease(criteria, DEMO_BOOKING.amountVnd, completion);

  function toggle(id: string) {
    setCompletion({ ...completion, [id]: !completion[id] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">8. Confirm Job Completion</h1>
        <p className="text-sm text-muted-foreground">
          Check off what {DEMO_TALENT.name} actually delivered against the contract.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-md bg-white/5 p-6">
        {criteria.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-3 rounded-[8px] bg-white/5 px-4 py-3 text-sm text-foreground"
          >
            <Checkbox checked={!!completion[c.id]} onCheckedChange={() => toggle(c.id)} />
            <span className="flex-1">{c.label}</span>
            <span className="text-xs font-semibold text-muted-foreground">{c.weightPct}%</span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-md bg-primary/10 p-5">
        <span className="text-sm text-foreground">Talent will receive</span>
        <span className="text-lg font-bold text-foreground">
          {releasedPct}% &middot; {formatVnd(releasedVnd)}
        </span>
      </div>

      <Button onClick={() => router.push("/demo/release")} className="h-11 w-full rounded-[6px]">
        Confirm &amp; Release Payment
      </Button>
    </div>
  );
}
