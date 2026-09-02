import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";

mock.module("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

let talentsResult: unknown[] = [];
mock.module("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: talentsResult, error: null }),
        }),
      }),
    }),
  }),
}));

import AdminCommissionsPage from "@/app/admin/commissions/page";

describe("AdminCommissionsPage", () => {
  it("renders each talent with their name and current commission_bps as the input's default value", async () => {
    talentsResult = [
      { id: "talent-1", full_name: "Nova Events", commission_bps: 500 },
      { id: "talent-2", full_name: "Bao Nguyen", commission_bps: 1000 },
    ];

    render(await AdminCommissionsPage());

    expect(screen.getByText("Nova Events")).toBeInTheDocument();
    expect(screen.getByText("Bao Nguyen")).toBeInTheDocument();
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(inputs.map((input) => input.value)).toEqual(["500", "1000"]);
  });

  it("renders without crashing when there are no talents", async () => {
    talentsResult = [];

    render(await AdminCommissionsPage());

    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
  });
});
