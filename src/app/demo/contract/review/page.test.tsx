import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import DemoContractReviewPage from "@/app/demo/contract/review/page";
import { DemoFlowProvider } from "@/lib/demo-flow/context";

afterEach(() => cleanup());

describe("DemoContractReviewPage", () => {
  it("renders the contract review step", () => {
    render(
      <DemoFlowProvider>
        <DemoContractReviewPage />
      </DemoFlowProvider>
    );
    expect(screen.getByRole("heading", { name: /review the contract/i })).toBeInTheDocument();
  });
});
