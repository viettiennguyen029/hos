import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import DemoDiscoverPage from "@/app/demo/discover/page";

afterEach(() => cleanup());

describe("DemoDiscoverPage", () => {
  it("renders the discover step", () => {
    render(<DemoDiscoverPage />);
    expect(screen.getByRole("heading", { name: /discover the talent/i })).toBeInTheDocument();
  });
});
