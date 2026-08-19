import { describe, expect, it } from "bun:test";
import { DEFAULT_CRITERIA } from "@/lib/demo-flow/constants";

describe("DEFAULT_CRITERIA", () => {
  it("weights sum to exactly 100%", () => {
    const total = DEFAULT_CRITERIA.reduce((sum, c) => sum + c.weightPct, 0);
    expect(total).toBe(100);
  });

  it("has a unique id per criterion", () => {
    const ids = DEFAULT_CRITERIA.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
