import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

const redirectCalls: string[] = [];
mock.module("next/navigation", () => ({
  redirect: (url: string) => {
    redirectCalls.push(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

let mockProfile: { role: string } | null = null;
mock.module("@/lib/supabase/server", () => ({
  getCurrentProfile: async () => mockProfile,
}));

import LandingPage from "@/app/(marketing)/page";

afterEach(() => {
  cleanup();
  redirectCalls.length = 0;
  mockProfile = null;
});

describe("Landing page", () => {
  it("renders marketing content for a signed-out visitor", async () => {
    mockProfile = null;
    const ui = await LandingPage();
    render(ui);
    expect(screen.getByText(/turn your talent into extra income/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/sign-up");
    expect(screen.getAllByRole("link", { name: /sign in/i })[0]).toHaveAttribute("href", "/sign-in");
  });

  it("redirects a signed-in visitor to their role dashboard instead of rendering", async () => {
    mockProfile = { role: "talent" };
    await expect(LandingPage()).rejects.toThrow("REDIRECT:/talent");
  });
});
