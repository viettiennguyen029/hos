import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import SmartContractPage from "@/app/organizer/smart-contract/page";

afterEach(() => cleanup());

describe("SmartContractPage", () => {
  it("renders the Smart Contract Escrow heading", () => {
    render(<SmartContractPage />);
    expect(screen.getByRole("heading", { name: /smart contract escrow/i })).toBeInTheDocument();
  });
});
