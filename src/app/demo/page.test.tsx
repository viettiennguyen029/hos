import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import DemoChatPage from "@/app/demo/page";

afterEach(() => cleanup());

describe("DemoChatPage", () => {
  it("renders the chat step", () => {
    render(<DemoChatPage />);
    expect(screen.getByRole("heading", { name: /chat with the ai assistant/i })).toBeInTheDocument();
  });
});
