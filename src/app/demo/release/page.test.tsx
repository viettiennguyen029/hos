import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

mock.module("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import DemoReleasePage from "@/app/demo/release/page";
import { DemoFlowProvider } from "@/lib/demo-flow/context";

afterEach(() => cleanup());

describe("DemoReleasePage", () => {
  it("renders the release step", () => {
    render(
      <DemoFlowProvider>
        <DemoReleasePage />
      </DemoFlowProvider>
    );
    expect(screen.getByRole("heading", { name: /payment released/i })).toBeInTheDocument();
  });
});
