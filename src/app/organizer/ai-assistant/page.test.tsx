import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import AiAssistantPage from "@/app/organizer/ai-assistant/page";

afterEach(() => cleanup());

describe("AiAssistantPage", () => {
  it("renders the AI Talent Assistant heading", () => {
    render(<AiAssistantPage />);
    expect(screen.getByRole("heading", { name: /ai talent assistant/i })).toBeInTheDocument();
  });
});
