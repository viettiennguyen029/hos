import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { DiscoverStep } from "@/components/demo-flow/discover-step";

afterEach(() => cleanup());

describe("DiscoverStep", () => {
  it("shows the talent's profile details and a Book Now link to checkout", () => {
    render(<DiscoverStep />);
    expect(screen.getByRole("heading", { name: "The Acoustic Trio" })).toBeInTheDocument();
    expect(screen.getByText(/12 weddings performed in da nang/i)).toBeInTheDocument();

    const bookNow = screen.getByRole("link", { name: /book now/i });
    expect(bookNow).toHaveAttribute("href", "/demo/checkout");
  });
});
