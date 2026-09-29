import { afterEach, describe, expect, it, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { toCardData } from "@/components/shell/home-content";
import type { PackageWithTalent } from "@/lib/supabase/types";

mock.module("@/lib/supabase/packages", () => ({
  listMostPopularPackages: async () => [
    {
      id: "pkg-1",
      talent_id: "talent-1",
      category_id: "cat-solo-singer",
      subcategory_id: null,
      title: "My Package",
      residency: null,
      city_id: "city-hcm",
      working_method: null,
      skill_tags: [],
      repeat_on: true,
      repeat_days: null,
      start_date: "2026-08-01",
      end_date: "2026-12-31",
      start_time: "18:00:00",
      end_time: "22:00:00",
      description: null,
      price_min_vnd: 1_000_000,
      price_max_vnd: 5_000_000,
      payment_method: "Prepaid",
      status: "active",
      is_most_popular: true,
      is_editor_choice: false,
      created_at: "2026-08-01T00:00:00Z",
      talent_name: "Some Talent",
      talent_slug: "some-talent-abc123",
      talent_keywords: [],
      talent_avatar_url: null,
      talent_genre_name: null,
      category_name: "Solo Singer",
      subcategory_name: null,
      city_name: "HCM City",
    },
  ],
  listEditorChoicePackages: async () => [],
  listRecentPackages: async () => [],
}));

import { HomeContent } from "@/components/shell/home-content";

function makePackage(overrides: Partial<PackageWithTalent> = {}): PackageWithTalent {
  return {
    id: "pkg-1",
    talent_id: "talent-1",
    category_id: "cat-solo-singer",
    subcategory_id: null,
    title: "My Package",
    residency: null,
    city_id: "city-hcm",
    working_method: null,
    skill_tags: [],
    repeat_on: true,
    repeat_days: null,
    start_date: "2026-08-01",
    end_date: "2026-12-31",
    start_time: "18:00:00",
    end_time: "22:00:00",
    description: null,
    price_min_vnd: 1_000_000,
    price_max_vnd: 5_000_000,
    payment_method: "Prepaid",
    status: "active",
    is_most_popular: false,
    is_editor_choice: false,
    created_at: "2026-08-01T00:00:00Z",
    talent_name: "Some Talent",
    talent_slug: "some-talent-abc123",
    talent_keywords: [],
    talent_avatar_url: null,
    talent_genre_name: null,
    category_name: "Solo Singer",
    subcategory_name: null,
    city_name: "HCM City",
    ...overrides,
  };
}

describe("toCardData", () => {
  test("uses the talent's name as the card title", () => {
    expect(toCardData(makePackage({ talent_name: "DJ Nova" })).title).toBe("DJ Nova");
  });

  test("combines category and subcategory when subcategory_name is set", () => {
    const card = toCardData(makePackage({ category_name: "Solo Singer", subcategory_name: "Rapper" }));
    expect(card.category).toBe("Solo Singer · Rapper");
  });

  test("falls back to just category when subcategory_name is null", () => {
    const card = toCardData(makePackage({ category_name: "Band", subcategory_name: null }));
    expect(card.category).toBe("Band");
  });

  test("always tags the card as VND currency", () => {
    expect(toCardData(makePackage()).currency).toBe("VND");
  });

  test("carries the real price range through", () => {
    const card = toCardData(makePackage({ price_min_vnd: 2_000_000, price_max_vnd: 6_000_000 }));
    expect(card.priceMin).toBe(2_000_000);
    expect(card.priceMax).toBe(6_000_000);
  });
});

afterEach(() => {
  cleanup();
});

describe("HomeContent branding copy", () => {
  it("does not reference the old Heart of Show name", async () => {
    const ui = await HomeContent({ role: "organizer" });
    render(ui);
    expect(screen.queryByText(/heart of show/i)).not.toBeInTheDocument();
  });
});
