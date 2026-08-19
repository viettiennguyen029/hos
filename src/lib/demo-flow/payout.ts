import type { CompletionMap, Criterion } from "@/lib/demo-flow/types";

export function computeRelease(criteria: Criterion[], totalVnd: number, completion: CompletionMap) {
  const releasedPct = criteria.reduce((sum, c) => sum + (completion[c.id] ? c.weightPct : 0), 0);
  const releasedVnd = Math.round((totalVnd * releasedPct) / 100);
  return { releasedPct, releasedVnd, refundedVnd: totalVnd - releasedVnd };
}
