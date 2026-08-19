"use client";

import { useRouter } from "next/navigation";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoFlow } from "@/lib/demo-flow/context";
import { DEMO_BOOKING, DEMO_TALENT } from "@/lib/demo-flow/constants";
import { computeRelease } from "@/lib/demo-flow/payout";
import { cn } from "@/lib/utils";

const RELEASE_TX_HASH = "0x3fea1da034499c44ebe46075631e7e7113967a382de9b8538a103e0123e23ed9";
const REFUND_TX_HASH = "0xac8d3d440e74e4031d67bbaddbb995262f0923c65da8dc48136e46b1e9ebe8f7";

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function ReleaseStep() {
  const router = useRouter();
  const { criteria, completion, reset } = useDemoFlow();
  const { releasedPct, releasedVnd, refundedVnd } = computeRelease(criteria, DEMO_BOOKING.amountVnd, completion);

  function handleRestart() {
    reset();
    router.push("/demo");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">9. Payment Released</h1>
        <p className="text-sm text-muted-foreground">
          The contract paid out exactly according to which criteria were met — nobody had to negotiate it.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-md bg-white/5 p-6">
        {criteria.map((c) => {
          const met = !!completion[c.id];
          return (
            <div key={c.id} className="flex items-center justify-between rounded-[8px] bg-white/5 px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    met ? "bg-green-500/15 text-green-500" : "bg-destructive/10 text-destructive"
                  )}
                >
                  {met ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                </span>
                <span className="text-foreground">{c.label}</span>
              </div>
              <span className="font-semibold text-foreground">{met ? c.weightPct : 0}%</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-md bg-primary/10 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Released to {DEMO_TALENT.name}</span>
          <span className="text-lg font-bold text-foreground">
            {releasedPct}% &middot; {formatVnd(releasedVnd)}
          </span>
        </div>
        {refundedVnd > 0 && (
          <div className="flex items-center justify-between border-t border-primary/20 pt-3">
            <span className="text-sm text-muted-foreground">Refunded to organizer</span>
            <span className="text-sm font-semibold text-foreground">{formatVnd(refundedVnd)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-md bg-white/5 p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">On-Chain Settlement</h2>
        </div>
        {releasedVnd > 0 && (
          <div className="flex flex-col gap-0.5 border-l-2 border-primary/40 pl-3">
            <span className="text-sm font-medium text-foreground">
              Released {formatVnd(releasedVnd)} to Talent
            </span>
            <span className="font-mono text-xs text-muted-foreground">{truncateHash(RELEASE_TX_HASH)}</span>
          </div>
        )}
        {refundedVnd > 0 && (
          <div className="flex flex-col gap-0.5 border-l-2 border-primary/40 pl-3">
            <span className="text-sm font-medium text-foreground">
              Refunded {formatVnd(refundedVnd)} to Organizer
            </span>
            <span className="font-mono text-xs text-muted-foreground">{truncateHash(REFUND_TX_HASH)}</span>
          </div>
        )}
      </div>

      <Button onClick={handleRestart} variant="secondary" className="h-11 w-full rounded-[6px]">
        Restart Demo
      </Button>
    </div>
  );
}
