import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// Mock the next/font/google module BEFORE any dynamic imports
mock.module("next/font/google", () => ({
  Be_Vietnam_Pro: () => ({
    variable: "--font-sans",
  }),
}));

describe("RootLayout", () => {
  it("sets consistent Hustle of Stars metadata and does not force the dark class", async () => {
    // Dynamic import AFTER mock is registered
    const { default: RootLayout, metadata } = await import("@/app/layout");

    // Verify metadata
    expect(metadata.title).toBe("Hustle of Stars");
    expect(metadata.description).toBe("Turn your talent into extra income");

    // Render and verify no dark class
    const html = renderToStaticMarkup(
      <RootLayout>
        <div>child</div>
      </RootLayout>
    );
    expect(html).not.toContain('class="dark');
  });
});
