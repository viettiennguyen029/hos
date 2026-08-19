import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TopupStep } from "@/components/demo-flow/topup-step";
import { DemoFlowProvider } from "@/lib/demo-flow/context";

afterEach(() => cleanup());

function renderStep() {
  return render(
    <DemoFlowProvider>
      <TopupStep />
    </DemoFlowProvider>
  );
}

describe("TopupStep", () => {
  it("shows the deposit button and the from/to wallet addresses before funding", () => {
    renderStep();
    expect(screen.getByRole("button", { name: /deposit via crypto/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /continue/i })).not.toBeInTheDocument();
    expect(screen.getByText("0x7bbe8d…8035d5")).toBeInTheDocument();
    expect(screen.getByText("0xe94fab…2f1935")).toBeInTheDocument();
  });

  it(
    "deposits, shows the deposit tx hash, and reveals a Continue link to the Booked step",
    async () => {
      renderStep();
      fireEvent.click(screen.getByRole("button", { name: /deposit via crypto/i }));

      await screen.findByText(/funds locked in escrow/i, {}, { timeout: 3000 });
      expect(screen.getByText("0x5e78fc…d3e1de")).toBeInTheDocument();

      const continueLink = screen.getByRole("link", { name: /continue/i });
      expect(continueLink).toHaveAttribute("href", "/demo/booked");
    },
    5000
  );
});
