import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");

const FILES = [
  "src/app/admin/disputes/page.tsx",
  "src/app/organizer/account/events/page.tsx",
  "src/app/organizer/create/create-event-form.tsx",
  "src/components/account/billing-content.tsx",
  "src/components/account/event-applications-panel.tsx",
  "src/components/account/order-detail-content.tsx",
  "src/components/account/orders-content.tsx",
  "src/components/account/packages-content.tsx",
  "src/components/account/quotations-content.tsx",
  "src/components/account/schedule-content.tsx",
  "src/components/account/talents-content.tsx",
  "src/components/account/account-tabs.tsx",
  "src/components/admin/commission-row.tsx",
  "src/components/shared/pagination.tsx",
  "src/components/shared/step-indicator.tsx",
  "src/components/kyc/kyc-wizard.tsx",
];

const HARDCODED_PANEL_PATTERN = /bg-white\/|hover:bg-white\//;

describe("account/admin/organizer panels use theme tokens", () => {
  for (const file of FILES) {
    it(`${file} has no hardcoded white overlay classes`, () => {
      const source = readFileSync(join(ROOT, file), "utf-8");
      expect(HARDCODED_PANEL_PATTERN.test(source)).toBe(false);
    });
  }

  it("profile-content.tsx converts panel fills but keeps image-hover scrims", () => {
    const source = readFileSync(
      join(ROOT, "src/components/account/profile-content.tsx"),
      "utf-8"
    );
    expect(HARDCODED_PANEL_PATTERN.test(source)).toBe(false);
    // Cover/avatar/gallery hover-reveal scrims must remain untouched.
    expect(source).toContain("bg-black/50");
    expect(source).toContain("bg-black/60");
  });
});
