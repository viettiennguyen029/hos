import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const pushCalls: string[] = [];
mock.module("next/navigation", () => ({ useRouter: () => ({ push: (href: string) => pushCalls.push(href) }) }));

import { CompleteJobStep } from "@/components/demo-flow/complete-job-step";
import { DemoFlowProvider } from "@/lib/demo-flow/context";

afterEach(() => {
  cleanup();
  pushCalls.length = 0;
});

function renderStep() {
  return render(
    <DemoFlowProvider>
      <CompleteJobStep />
    </DemoFlowProvider>
  );
}

describe("CompleteJobStep", () => {
  it("starts with nothing checked, so the talent receives 0%", () => {
    renderStep();
    expect(screen.getByText(/0% ·/i)).toBeInTheDocument();
  });

  it("updates the live payout preview as criteria are checked", () => {
    renderStep();
    fireEvent.click(screen.getByText("Arrives and sets up on time"));
    expect(screen.getByText(/20% ·/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Performs the full 2-hour set"));
    expect(screen.getByText(/70% ·/i)).toBeInTheDocument();
  });

  it("navigates to the release step on confirm", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: /confirm & release payment/i }));
    expect(pushCalls).toEqual(["/demo/release"]);
  });
});
