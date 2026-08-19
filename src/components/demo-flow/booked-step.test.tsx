import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { BookedStep } from "@/components/demo-flow/booked-step";

afterEach(() => cleanup());

describe("BookedStep", () => {
  it("shows the confirmation and a link to the complete-job step", () => {
    render(<BookedStep />);
    expect(screen.getByRole("heading", { name: /booking confirmed/i })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /jump to event day/i });
    expect(link).toHaveAttribute("href", "/demo/complete");
  });
});
