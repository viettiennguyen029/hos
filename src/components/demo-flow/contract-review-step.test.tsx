import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ContractReviewStep } from "@/components/demo-flow/contract-review-step";
import { DemoFlowProvider } from "@/lib/demo-flow/context";

afterEach(() => cleanup());

function renderStep() {
  return render(
    <DemoFlowProvider>
      <ContractReviewStep />
    </DemoFlowProvider>
  );
}

describe("ContractReviewStep", () => {
  it("shows the default criteria and amount before agreeing", () => {
    renderStep();
    expect(screen.getByText("Arrives and sets up on time")).toBeInTheDocument();
    expect(screen.getByText("20,000,000 VND")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /agree & sign/i })).toBeInTheDocument();
  });

  it("shows both signatures and a link to the top-up step after agreeing", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: /agree & sign/i }));

    expect(screen.getAllByText("Signed").length).toBe(2);
    const continueLink = screen.getByRole("link", { name: /continue to payment/i });
    expect(continueLink).toHaveAttribute("href", "/demo/topup");
  });
});
