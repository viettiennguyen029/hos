"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDemoFlow } from "@/lib/demo-flow/context";
import { DEMO_BOOKING, DEMO_TALENT } from "@/lib/demo-flow/constants";
import { cn } from "@/lib/utils";

let criterionSeq = 0;
function nextCriterionId() {
  criterionSeq += 1;
  return `criterion-${criterionSeq}`;
}

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

export function ContractCreateStep() {
  const router = useRouter();
  const { criteria, setCriteria } = useDemoFlow();
  const [error, setError] = useState<string | undefined>();

  const totalWeight = criteria.reduce((sum, c) => sum + c.weightPct, 0);
  const canContinue = totalWeight === 100 && criteria.every((c) => c.label.trim().length > 0);

  function updateCriterion(id: string, patch: Partial<{ label: string; weightPct: number }>) {
    setCriteria(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function addCriterion() {
    setCriteria([...criteria, { id: nextCriterionId(), label: "", weightPct: 0 }]);
  }

  function removeCriterion(id: string) {
    setCriteria(criteria.filter((c) => c.id !== id));
  }

  function handleContinue() {
    if (!canContinue) {
      setError("Every criterion needs a label, and the weights must add up to exactly 100%.");
      return;
    }
    setError(undefined);
    router.push("/demo/contract/review");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">4. Create the Contract</h1>
        <p className="text-sm text-muted-foreground">
          Define what &quot;job well done&quot; means. Each criterion carries a share of the payout.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-md bg-white/5 p-6 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Talent</span>
          <span className="font-semibold text-foreground">{DEMO_TALENT.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Amount to escrow</span>
          <span className="font-semibold text-foreground">{formatVnd(DEMO_BOOKING.amountVnd)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-[-0.03em] text-foreground">Completion Criteria</h2>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              totalWeight === 100 ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive"
            )}
          >
            {totalWeight}% of 100%
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {criteria.map((criterion) => (
            <div key={criterion.id} className="flex items-center gap-2">
              <Input
                value={criterion.label}
                onChange={(event) => updateCriterion(criterion.id, { label: event.target.value })}
                placeholder="e.g. Arrives on time"
                className="h-10 flex-1 rounded-[6px]"
              />
              <div className="flex h-10 w-24 items-center gap-1 rounded-[6px] border border-input bg-transparent px-2.5">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={criterion.weightPct}
                  onChange={(event) => updateCriterion(criterion.id, { weightPct: Number(event.target.value) })}
                  className="h-8 border-none p-0 text-right"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <button
                type="button"
                aria-label={`Remove ${criterion.label || "criterion"}`}
                onClick={() => removeCriterion(criterion.id)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-muted-foreground hover:bg-white/10"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        <Button type="button" variant="secondary" onClick={addCriterion} className="w-fit rounded-[6px]">
          <Plus className="size-4" />
          Add Criterion
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleContinue} className="h-11 w-full rounded-[6px]">
        Continue to Review
      </Button>
    </div>
  );
}
