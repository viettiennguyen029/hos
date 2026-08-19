import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const pushCalls: string[] = [];
mock.module("next/navigation", () => ({ useRouter: () => ({ push: (href: string) => pushCalls.push(href) }) }));

import { ContractCreateStep } from "@/components/demo-flow/contract-create-step";
import { DemoFlowProvider } from "@/lib/demo-flow/context";

afterEach(() => {
  cleanup();
  pushCalls.length = 0;
});

function renderStep() {
  return render(
    <DemoFlowProvider>
      <ContractCreateStep />
    </DemoFlowProvider>
  );
}

describe("ContractCreateStep", () => {
  it("starts with the 3 default criteria totalling 100%", () => {
    renderStep();
    expect(screen.getByText("100% of 100%")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Arrives and sets up on time")).toBeInTheDocument();
  });

  it("continues to the review step when weights already total 100%", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: /continue to review/i }));
    expect(pushCalls).toEqual(["/demo/contract/review"]);
  });

  it("blocks continuing and shows an error once weights no longer total 100%", () => {
    renderStep();
    const firstWeightInput = screen.getAllByDisplayValue("20")[0];
    fireEvent.change(firstWeightInput, { target: { value: "5" } });

    expect(screen.getByText("85% of 100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue to review/i }));

    expect(screen.getByText(/must add up to exactly 100%/i)).toBeInTheDocument();
    expect(pushCalls).toEqual([]);
  });

  it("adds a new blank criterion row and removes an existing one", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: /add criterion/i }));
    expect(screen.getAllByPlaceholderText(/e\.g\. arrives on time/i)).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: /remove arrives and sets up on time/i }));
    expect(screen.queryByDisplayValue("Arrives and sets up on time")).not.toBeInTheDocument();
  });
});
