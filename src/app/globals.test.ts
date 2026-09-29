import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(import.meta.dir, "globals.css"), "utf-8");

function rootBlock(): string {
  const match = css.match(/:root\s*\{([^}]*)\}/);
  if (!match) throw new Error(":root block not found in globals.css");
  return match[1];
}

describe("globals.css :root theme", () => {
  it("uses a white background and dark foreground", () => {
    const root = rootBlock();
    expect(root).toContain("--background: #FFFFFF");
    expect(root).toContain("--foreground: #1A1512");
  });

  it("uses the new orange primary color", () => {
    expect(rootBlock()).toContain("--primary: #FF6B35");
  });

  it("keeps destructive distinct from primary", () => {
    const root = rootBlock();
    const primaryMatch = root.match(/--primary:\s*(#[0-9a-fA-F]{6})/);
    const destructiveMatch = root.match(/--destructive:\s*(#[0-9a-fA-F]{6})/);
    expect(primaryMatch).not.toBeNull();
    expect(destructiveMatch).not.toBeNull();
    expect(destructiveMatch![1]).not.toBe(primaryMatch![1]);
  });

  it("keeps accent distinct from muted so hover states are visible", () => {
    const root = rootBlock();
    const mutedMatch = root.match(/--muted:\s*(#[0-9a-fA-F]{6})/);
    const accentMatch = root.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
    expect(mutedMatch).not.toBeNull();
    expect(accentMatch).not.toBeNull();
    expect(accentMatch![1]).not.toBe(mutedMatch![1]);
  });
});
