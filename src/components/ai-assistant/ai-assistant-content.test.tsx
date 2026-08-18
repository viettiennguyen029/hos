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

  // The scripted "thinking" delays add up to several seconds by design, so these two
  // conversation-walking tests need more than bun's 5s default per-test timeout.
  it("walks the scripted conversation from a suggested prompt through to talent recommendations", async () => {
    render(<AiAssistantContent />);

    fireEvent.click(screen.getByText(/live band for a 200-guest wedding in da nang/i));
    expect(screen.getByText(/reading your event details/i)).toBeInTheDocument();
    await screen.findByText(/quick follow-up/i, {}, { timeout: 3000 });

    fireEvent.click(screen.getByText("Acoustic / Pop"));
    expect(screen.getByText(/searching matching talents/i)).toBeInTheDocument();
    await screen.findByText(/best-matching talents i found/i, {}, { timeout: 3000 });

    expect(screen.getByText("The Acoustic Trio")).toBeInTheDocument();
    expect(screen.getByText("96% Match")).toBeInTheDocument();
  }, 8000);

  it(
    "confirms a booking request when the user clicks Book on a recommendation",
    async () => {
      render(<AiAssistantContent />);

      fireEvent.click(screen.getByText(/live band for a 200-guest wedding in da nang/i));
      await screen.findByText(/quick follow-up/i, {}, { timeout: 3000 });

      fireEvent.click(screen.getByText("Acoustic / Pop"));
      await screen.findByText("The Acoustic Trio", {}, { timeout: 3000 });

      fireEvent.click(screen.getAllByRole("button", { name: "Book" })[0]);

      await screen.findByText(/sent a booking request to the acoustic trio/i, {}, { timeout: 3000 });

      const contractLink = screen.getByRole("link", { name: /smart contract escrow/i });
      expect(contractLink).toHaveAttribute("href", "/organizer/smart-contract");
    },
    8000
  );

  it("disables the send button while input is empty", () => {
    render(<AiAssistantContent />);
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });
});
