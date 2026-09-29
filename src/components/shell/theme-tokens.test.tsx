import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FILES = [
  "sidebar.tsx",
  "profile-menu.tsx",
  "cart-button.tsx",
  "notification-button.tsx",
  "search-bar.tsx",
  "category-tabs.tsx",
  "filter-pill.tsx",
  "hashtag-filter.tsx",
  "price-range-filter.tsx",
  "time-range-filter.tsx",
  "card-carousel.tsx",
];

const HARDCODED_PATTERN = /bg-white\/|hover:bg-white\/|border-white\/|border-\[rgba\(255/;

describe("shell nav/filter components use theme tokens, not hardcoded white overlays", () => {
  for (const file of FILES) {
    it(`${file} has no hardcoded white overlay classes`, () => {
      const source = readFileSync(join(import.meta.dir, file), "utf-8");
      expect(HARDCODED_PATTERN.test(source)).toBe(false);
    });
  }
});
