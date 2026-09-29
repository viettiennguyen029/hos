import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

describe("RootLayout", () => {
  it("sets consistent Hustle of Stars metadata", () => {
    const layoutFile = readFileSync(join(import.meta.dir, "layout.tsx"), "utf-8");
    expect(layoutFile).toContain('title: "Hustle of Stars"');
    expect(layoutFile).toContain('description: "Turn your talent into extra income"');
  });

  it("does not force the dark class on <html>", () => {
    const layoutFile = readFileSync(join(import.meta.dir, "layout.tsx"), "utf-8");
    // Should NOT contain the dark class in the html element className
    expect(layoutFile).not.toContain('className={`dark ${beVietnamPro.variable}');
    // Should contain the corrected className without dark
    expect(layoutFile).toContain('className={`${beVietnamPro.variable} h-full antialiased`}');
  });
});
