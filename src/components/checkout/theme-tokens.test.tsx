import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");

const FILES = [
  "src/components/checkout/checkout-content.tsx",
  "src/components/create-package/create-package-dialog.tsx",
  "src/components/event-detail/apply-dialog.tsx",
  "src/components/event-detail/apply-panel.tsx",
  "src/components/talent-detail/booking-panel.tsx",
];

const HARDCODED_PATTERN = /bg-white\/|hover:bg-white\/|border-white\//;

describe("checkout/booking/dialog panels use theme tokens", () => {
  for (const file of FILES) {
    it(`${file} has no hardcoded white overlay classes`, () => {
      const source = readFileSync(join(ROOT, file), "utf-8");
      expect(HARDCODED_PATTERN.test(source)).toBe(false);
    });
  }

  it("rating-review-card.tsx converts the unfilled-star color to a token", () => {
    const source = readFileSync(
      join(ROOT, "src/components/talent-detail/rating-review-card.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("text-white/20");
    expect(source).toContain("text-muted-foreground");
  });

  it("upload-slot.tsx converts the empty-slot state but keeps the preview hover scrim", () => {
    const source = readFileSync(
      join(ROOT, "src/components/shared/upload-slot.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("border-white/15");
    expect(source).not.toContain("bg-white/5");
    expect(source).toContain("bg-black/60");
  });
});
