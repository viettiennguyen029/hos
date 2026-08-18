import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AiAssistantContent } from "@/components/ai-assistant/ai-assistant-content";

afterEach(() => cleanup());

describe("AiAssistantContent", () => {
  it("shows the welcome message and suggested prompts on load", () => {
    render(<AiAssistantContent />);
    expect(screen.getByText(/hi! i'm the hos ai assistant/i)).toBeInTheDocument();
    expect(
      screen.getByText(/live band for a 200-guest wedding in da nang/i)
    ).toBeInTheDocument();
  });

  it("walks the scripted conversation from a suggested prompt through to talent recommendations", async () => {
    render(<AiAssistantContent />);

    fireEvent.click(screen.getByText(/live band for a 200-guest wedding in da nang/i));
    await screen.findByText(/quick follow-up/i, {}, { timeout: 2000 });

    fireEvent.click(screen.getByText("Acoustic / Pop"));
    await screen.findByText(/best-matching talents i found/i, {}, { timeout: 2000 });

    expect(screen.getByText("The Acoustic Trio")).toBeInTheDocument();
    expect(screen.getByText("96% Match")).toBeInTheDocument();
  });

  it("confirms a booking request when the user clicks Book on a recommendation", async () => {
    render(<AiAssistantContent />);

    fireEvent.click(screen.getByText(/live band for a 200-guest wedding in da nang/i));
    await screen.findByText(/quick follow-up/i, {}, { timeout: 2000 });

    fireEvent.click(screen.getByText("Acoustic / Pop"));
    await screen.findByText("The Acoustic Trio", {}, { timeout: 2000 });

    fireEvent.click(screen.getAllByRole("button", { name: "Book" })[0]);

    await screen.findByText(/sent a booking request to the acoustic trio/i, {}, { timeout: 2000 });
  });

  it("disables the send button while input is empty", () => {
    render(<AiAssistantContent />);
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });
});
