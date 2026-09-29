import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const svg = readFileSync(join(import.meta.dir, "logo.svg"), "utf-8");

describe("brand logo colors", () => {
  it("no longer uses the old red/pink star colors", () => {
    expect(svg).not.toContain("#DB382C");
    expect(svg).not.toContain("#db382c");
    expect(svg).not.toContain("#E89290");
    expect(svg).not.toContain("#e89290");
  });

  it("no longer uses the old off-white wordmark color", () => {
    expect(svg).not.toContain("#F5F5F5");
    expect(svg).not.toContain("#f5f5f5");
  });

  it("uses the new orange accent for the star mark", () => {
    expect(svg.toUpperCase()).toContain("#FF6B35");
  });

  it("uses a dark color for the wordmark", () => {
    expect(svg.toUpperCase()).toContain("#1A1512");
  });
});
