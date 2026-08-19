import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

mock.module("next/navigation", () => ({ usePathname: () => "/demo/checkout" }));

import { FlowStepper } from "@/components/demo-flow/flow-stepper";

afterEach(() => cleanup());

describe("FlowStepper", () => {
  it("marks the current step active and links every step to its route", () => {
    render(<FlowStepper />);

    const current = screen.getByRole("link", { name: /checkout/i });
    expect(current).toHaveAttribute("aria-current", "step");
    expect(current).toHaveAttribute("href", "/demo/checkout");

    const discover = screen.getByRole("link", { name: /discover/i });
    expect(discover).toHaveAttribute("href", "/demo/discover");
    expect(discover).not.toHaveAttribute("aria-current");
  });

  it("renders all 9 steps", () => {
    render(<FlowStepper />);
    expect(screen.getAllByRole("link")).toHaveLength(9);
  });
});
