import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

mock.module("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import DemoCompletePage from "@/app/demo/complete/page";
import { DemoFlowProvider } from "@/lib/demo-flow/context";

afterEach(() => cleanup());

describe("DemoCompletePage", () => {
  it("renders the complete-job step", () => {
    render(
      <DemoFlowProvider>
        <DemoCompletePage />
      </DemoFlowProvider>
    );
    expect(screen.getByRole("heading", { name: /confirm job completion/i })).toBeInTheDocument();
  });
});
