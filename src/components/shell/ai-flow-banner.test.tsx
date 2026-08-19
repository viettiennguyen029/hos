import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { AiFlowBanner } from "@/components/shell/ai-flow-banner";

afterEach(() => cleanup());

describe("AiFlowBanner", () => {
  it("links to the /demo flow", () => {
    render(<AiFlowBanner />);
    const cta = screen.getByRole("link", { name: /try the ai flow/i });
    expect(cta).toHaveAttribute("href", "/demo");
  });
});
