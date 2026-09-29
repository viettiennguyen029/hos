import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");

describe("image-hero cards convert panel fills but preserve caption scrims", () => {
  it("event-listing-card.tsx keeps the hover-flip chip and gradient scrim", () => {
    const source = readFileSync(
      join(ROOT, "src/components/shell/event-listing-card.tsx"),
      "utf-8"
    );
    expect(source).toContain("bg-gradient-to-t from-black");
    expect(source).toContain("group-hover:bg-white");
    expect(source).not.toMatch(/(?<!group-hover:)bg-white\/10/);
  });

  it("listing-card.tsx keeps the gradient scrim and light footer bar", () => {
    const source = readFileSync(
      join(ROOT, "src/components/shell/listing-card.tsx"),
      "utf-8"
    );
    expect(source).toContain("bg-gradient-to-t from-black");
    expect(source).toContain('bg-white px-4 py-3');
  });

  it("promo-card.tsx keeps the gradient scrim, converts the text-card variant", () => {
    const source = readFileSync(
      join(ROOT, "src/components/shell/promo-card.tsx"),
      "utf-8"
    );
    expect(source).toContain("bg-gradient-to-t from-black");
    expect(source).not.toContain("bg-white/5");
  });

  it("event-detail-content.tsx and talent-detail-content.tsx keep hero scrims, convert panels", () => {
    for (const file of [
      "src/components/event-detail/event-detail-content.tsx",
      "src/components/talent-detail/talent-detail-content.tsx",
    ]) {
      const source = readFileSync(join(ROOT, file), "utf-8");
      expect(source).toContain("bg-gradient-to-t from-black");
      expect(source).toContain("text-white");
      expect(source).not.toContain("bg-white/5");
    }
  });

  it("event-home-content.tsx converts its placeholder box", () => {
    const source = readFileSync(
      join(ROOT, "src/components/shell/event-home-content.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("bg-white/10");
    expect(source).toContain("bg-muted");
  });
});
