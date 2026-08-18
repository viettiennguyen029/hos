import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

mock.module("next/navigation", () => ({ usePathname: () => "/organizer" }));
mock.module("@/components/create-package/create-package-dialog", () => ({
  CreatePackageDialog: () => null,
}));

import { Sidebar } from "@/components/shell/sidebar";

afterEach(() => cleanup());

const CATEGORIES = [
  { id: "cat-solo", name: "Solo Singer", subcategories: [{ id: "cat-rapper", name: "Rapper" }] },
  { id: "cat-dj", name: "DJ", subcategories: [] },
];

describe("Sidebar", () => {
  it("renders category names from the categories prop", () => {
    render(<Sidebar role="organizer" kycStatus="verified" categories={CATEGORIES} cities={[]} />);
    expect(screen.getByText("Solo Singer")).toBeInTheDocument();
    expect(screen.getByText("DJ")).toBeInTheDocument();
  });

  it("links a top-level category (even with no children) straight to Discover filtered by its name", () => {
    render(<Sidebar role="organizer" kycStatus="verified" categories={CATEGORIES} cities={[]} />);
    const link = screen.getByRole("link", { name: "DJ" });
    expect(link).toHaveAttribute("href", "/organizer/discover?category=DJ");
  });

  it("links a top-level category that has children straight to Discover filtered by its own name too", () => {
    render(<Sidebar role="organizer" kycStatus="verified" categories={CATEGORIES} cities={[]} />);
    const link = screen.getByRole("link", { name: "Solo Singer" });
    expect(link).toHaveAttribute("href", "/organizer/discover?category=Solo%20Singer");
  });

  it("expands a category via its chevron toggle to show subcategories, linking by parent+own name", () => {
    render(<Sidebar role="organizer" kycStatus="verified" categories={CATEGORIES} cities={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /expand solo singer/i }));
    const link = screen.getByRole("link", { name: "Rapper" });
    expect(link).toHaveAttribute("href", "/organizer/discover?category=Solo%20Singer&subcategory=Rapper");
  });

  it("shows the showcase links (AI Assistant, Smart Contract Escrow) for organizers", () => {
    render(<Sidebar role="organizer" kycStatus="verified" categories={CATEGORIES} cities={[]} />);
    expect(screen.getByRole("link", { name: /ai talent assistant/i })).toHaveAttribute(
      "href",
      "/organizer/ai-assistant"
    );
    expect(screen.getByRole("link", { name: /smart contract escrow/i })).toHaveAttribute(
      "href",
      "/organizer/smart-contract"
    );
  });

  it("hides the showcase links for non-organizer roles", () => {
    render(<Sidebar role="talent" kycStatus="verified" categories={CATEGORIES} cities={[]} />);
    expect(screen.queryByText(/ai talent assistant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/smart contract escrow/i)).not.toBeInTheDocument();
  });
});
