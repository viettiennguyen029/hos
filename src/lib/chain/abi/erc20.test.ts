import { describe, it, expect } from "bun:test";
import { erc20Abi } from "./erc20";

describe("erc20Abi", () => {
  it("should export an array with allowance and approve functions", () => {
    expect(Array.isArray(erc20Abi)).toBe(true);
    expect(erc20Abi.length).toBe(2);
  });

  it("should have allowance function", () => {
    const allowance = erc20Abi.find((fn: any) => fn.name === "allowance");
    expect(allowance).toBeDefined();
    expect(allowance?.type).toBe("function");
    expect(allowance?.stateMutability).toBe("view");
    expect(allowance?.inputs?.length).toBe(2);
  });

  it("should have approve function", () => {
    const approve = erc20Abi.find((fn: any) => fn.name === "approve");
    expect(approve).toBeDefined();
    expect(approve?.type).toBe("function");
    expect(approve?.stateMutability).toBe("nonpayable");
    expect(approve?.inputs?.length).toBe(2);
  });
});
