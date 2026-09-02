import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";

mock.module("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

let isAdminToReturn = true;
mock.module("@/lib/supabase/admin", () => ({ isCurrentUserAdmin: async () => isAdminToReturn }));

import AdminLayout from "@/app/admin/layout";

describe("AdminLayout", () => {
  it("renders children inside the wrapper for an admin user", async () => {
    isAdminToReturn = true;
    const jsx = await AdminLayout({ children: <span>child</span> });
    render(jsx);
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("calls notFound for a non-admin user", async () => {
    isAdminToReturn = false;
    await expect(AdminLayout({ children: <span /> })).rejects.toThrow("NOT_FOUND");
  });
});
