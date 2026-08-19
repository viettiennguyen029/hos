import { describe, expect, it } from "bun:test";
import { computeRelease } from "@/lib/demo-flow/payout";
import type { Criterion } from "@/lib/demo-flow/types";

const CRITERIA: Criterion[] = [
  { id: "a", label: "Arrives on time", weightPct: 20 },
  { id: "b", label: "Performs full 2-hour set", weightPct: 50 },
  { id: "c", label: "Follows agreed song list", weightPct: 30 },
];

describe("computeRelease", () => {
  it("releases the full amount when every criterion is met", () => {
    const result = computeRelease(CRITERIA, 20_000_000, { a: true, b: true, c: true });
    expect(result.releasedPct).toBe(100);
    expect(result.releasedVnd).toBe(20_000_000);
    expect(result.refundedVnd).toBe(0);
  });

  it("releases nothing and refunds everything when no criterion is met", () => {
    const result = computeRelease(CRITERIA, 20_000_000, { a: false, b: false, c: false });
    expect(result.releasedPct).toBe(0);
    expect(result.releasedVnd).toBe(0);
    expect(result.refundedVnd).toBe(20_000_000);
  });

  it("releases only the weight of the criteria actually met", () => {
    const result = computeRelease(CRITERIA, 20_000_000, { a: true, b: false, c: true });
    expect(result.releasedPct).toBe(50);
    expect(result.releasedVnd).toBe(10_000_000);
    expect(result.refundedVnd).toBe(10_000_000);
  });

  it("treats a criterion missing from the completion map as not met", () => {
    const result = computeRelease(CRITERIA, 20_000_000, { a: true });
    expect(result.releasedPct).toBe(20);
    expect(result.releasedVnd).toBe(4_000_000);
  });

  it("returns zero for an empty criteria list", () => {
    const result = computeRelease([], 20_000_000, {});
    expect(result.releasedPct).toBe(0);
    expect(result.releasedVnd).toBe(0);
    expect(result.refundedVnd).toBe(20_000_000);
  });
});
