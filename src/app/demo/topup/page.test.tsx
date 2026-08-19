import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import DemoTopupPage from "@/app/demo/topup/page";
import { DemoFlowProvider } from "@/lib/demo-flow/context";

afterEach(() => cleanup());

describe("DemoTopupPage", () => {
  it("renders the top-up step", () => {
    render(
      <DemoFlowProvider>
        <DemoTopupPage />
      </DemoFlowProvider>
    );
    expect(screen.getByRole("heading", { name: /fund the escrow/i })).toBeInTheDocument();
  });
});
