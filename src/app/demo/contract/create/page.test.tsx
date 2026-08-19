import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

mock.module("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import DemoContractCreatePage from "@/app/demo/contract/create/page";
import { DemoFlowProvider } from "@/lib/demo-flow/context";

afterEach(() => cleanup());

describe("DemoContractCreatePage", () => {
  it("renders the contract-creation step", () => {
    render(
      <DemoFlowProvider>
        <DemoContractCreatePage />
      </DemoFlowProvider>
    );
    expect(screen.getByRole("heading", { name: /create the contract/i })).toBeInTheDocument();
  });
});
