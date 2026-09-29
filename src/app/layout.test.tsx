import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// Mock the next/font/google module to avoid font loading issues in tests
mock.module("next/font/google", () => ({
  Be_Vietnam_Pro: () => ({
    variable: "--font-sans",
  }),
}));

// Now import RootLayout after mocking the font module
import RootLayout, { metadata } from "@/app/layout";

describe("RootLayout", () => {
  it("sets consistent Hustle of Stars metadata", () => {
    expect(metadata.title).toBe("Hustle of Stars");
    expect(metadata.description).toBe("Turn your talent into extra income");
  });

  it("does not force the dark class on <html>", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <div>child</div>
      </RootLayout>
    );
    expect(html).not.toContain('class="dark');
  });
});
