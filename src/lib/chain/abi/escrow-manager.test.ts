import { describe, it, expect } from "bun:test";
import { escrowManagerAbi } from "./escrow-manager";

describe("escrowManagerAbi", () => {
  it("should export a non-empty array of ABI entries", () => {
    expect(Array.isArray(escrowManagerAbi)).toBe(true);
    expect(escrowManagerAbi.length).toBeGreaterThan(0);
  });

  it("should contain constructor, functions, events, and errors", () => {
    const types = new Set(escrowManagerAbi.map((entry: any) => entry.type));
    expect(types.has("constructor")).toBe(true);
    expect(types.has("function")).toBe(true);
    expect(types.has("event")).toBe(true);
    expect(types.has("error")).toBe(true);
  });
});
