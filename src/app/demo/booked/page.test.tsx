import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import DemoBookedPage from "@/app/demo/booked/page";

afterEach(() => cleanup());

describe("DemoBookedPage", () => {
  it("renders the booked step", () => {
    render(<DemoBookedPage />);
    expect(screen.getByRole("heading", { name: /booking confirmed/i })).toBeInTheDocument();
  });
});
