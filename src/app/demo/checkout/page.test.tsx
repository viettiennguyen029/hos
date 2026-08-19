import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

mock.module("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import DemoCheckoutPage from "@/app/demo/checkout/page";

afterEach(() => cleanup());

describe("DemoCheckoutPage", () => {
  it("renders the checkout step", () => {
    render(<DemoCheckoutPage />);
    expect(screen.getByRole("heading", { name: /check out/i })).toBeInTheDocument();
  });
});
