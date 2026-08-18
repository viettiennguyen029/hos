import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SmartContractContent } from "@/components/smart-contract/smart-contract-content";

afterEach(() => cleanup());

describe("SmartContractContent", () => {
  it("starts in the Funded state with both release/refund actions available on the organizer view", () => {
    render(<SmartContractContent />);
    expect(screen.getByText(/funded — awaiting performance/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm performance & release payment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /report no-show/i })).toBeInTheDocument();
  });

  it("releases payment when the organizer confirms performance, updating state on both views and the on-chain log", () => {
    render(<SmartContractContent />);

    fireEvent.click(screen.getByRole("button", { name: /confirm performance & release payment/i }));

    expect(screen.getByText(/payment released to the talent/i)).toBeInTheDocument();
    expect(screen.getByText(/payment released to talent/i)).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /talent view/i }));
    expect(screen.getByText(/has been released to your wallet/i)).toBeInTheDocument();
  });

  it("lets the talent claim payment directly from the Talent View tab", () => {
    render(<SmartContractContent />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: /talent view/i }));
    fireEvent.click(screen.getByRole("button", { name: /claim payment/i }));

    expect(screen.getByText(/has been released to your wallet/i)).toBeInTheDocument();
  });

  it("refunds the organizer on a reported no-show instead of releasing funds", () => {
    render(<SmartContractContent />);

    fireEvent.click(screen.getByRole("button", { name: /report no-show/i }));

    expect(screen.getByText(/funds refunded to you/i)).toBeInTheDocument();
    expect(screen.getByText(/booking refunded to organizer/i)).toBeInTheDocument();
  });
});
