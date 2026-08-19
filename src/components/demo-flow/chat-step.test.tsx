import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChatStep } from "@/components/demo-flow/chat-step";

afterEach(() => cleanup());

describe("ChatStep", () => {
  it("shows the welcome message and suggested prompts on load", () => {
    render(<ChatStep />);
    expect(screen.getByText(/hi! i'm the hos ai assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/live band for a 200-guest wedding in da nang/i)).toBeInTheDocument();
  });

  it(
    "walks the full 4-turn scripted conversation (genre, venue, songs) to recommendations that link to the Discover step",
    async () => {
      render(<ChatStep />);

      fireEvent.click(screen.getByText(/live band for a 200-guest wedding in da nang/i));
      await screen.findByText(/quick follow-up/i, {}, { timeout: 3000 });

      fireEvent.click(screen.getByText("Acoustic / Pop"));
      await screen.findByText(/indoor or outdoor/i, {}, { timeout: 3000 });

      fireEvent.click(screen.getByText("Outdoor, ~200 guests"));
      await screen.findByText(/specific song list, or can they choose/i, {}, { timeout: 3000 });

      fireEvent.click(screen.getByText("Their choice is fine"));
      await screen.findByText("The Acoustic Trio", {}, { timeout: 3000 });

      const viewProfileLinks = screen.getAllByRole("link", { name: /view profile/i });
      expect(viewProfileLinks).toHaveLength(3);
      expect(viewProfileLinks[0]).toHaveAttribute("href", "/demo/discover");
    },
    12000
  );
});
