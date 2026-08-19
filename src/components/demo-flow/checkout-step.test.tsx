import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const pushCalls: string[] = [];
mock.module("next/navigation", () => ({ useRouter: () => ({ push: (href: string) => pushCalls.push(href) }) }));

import { CheckoutStep } from "@/components/demo-flow/checkout-step";

afterEach(() => {
  cleanup();
  pushCalls.length = 0;
});

describe("CheckoutStep", () => {
  it("defaults to Crypto payment with Fiat disabled", () => {
    render(<CheckoutStep />);
    expect(screen.getByRole("button", { name: /fiat payment/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /crypto payment/i })).not.toBeDisabled();
  });

  it("shows the booking total and talent name", () => {
    render(<CheckoutStep />);
    expect(screen.getAllByText("The Acoustic Trio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20,000,000 VND").length).toBeGreaterThan(0);
  });

  it("navigates to the contract-creation step after sending the booking request", async () => {
    render(<CheckoutStep />);
    fireEvent.click(screen.getByRole("button", { name: /send booking request/i }));
    await screen.findByRole("button", { name: /sending/i });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(pushCalls).toEqual(["/demo/contract/create"]);
  });
});
