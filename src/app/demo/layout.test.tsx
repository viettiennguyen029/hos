import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

mock.module("next/navigation", () => ({ usePathname: () => "/demo" }));

import DemoLayout from "@/app/demo/layout";

afterEach(() => cleanup());

describe("DemoLayout", () => {
  it("renders the flow stepper and the page content", () => {
    render(
      <DemoLayout>
        <div>Step Content</div>
      </DemoLayout>
    );
    expect(screen.getByText("Step Content")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /demo flow progress/i })).toBeInTheDocument();
  });
});
