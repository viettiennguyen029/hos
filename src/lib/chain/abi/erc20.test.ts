import { describe, it, expect } from "bun:test";
import { erc20Abi } from "./erc20";

describe("erc20Abi", () => {
  it("should export an array with allowance, approve, name, nonces, and permit functions", () => {
    expect(Array.isArray(erc20Abi)).toBe(true);
    expect(erc20Abi.length).toBe(5);
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

  it("should have name function", () => {
    const name = erc20Abi.find((fn: any) => fn.name === "name");
    expect(name).toBeDefined();
    expect(name?.type).toBe("function");
    expect(name?.stateMutability).toBe("view");
    expect(name?.inputs?.length).toBe(0);
  });

  it("should have nonces function", () => {
    const nonces = erc20Abi.find((fn: any) => fn.name === "nonces");
    expect(nonces).toBeDefined();
    expect(nonces?.type).toBe("function");
    expect(nonces?.stateMutability).toBe("view");
    expect(nonces?.inputs?.length).toBe(1);
  });

  it("should have permit function", () => {
    const permit = erc20Abi.find((fn: any) => fn.name === "permit");
    expect(permit).toBeDefined();
    expect(permit?.type).toBe("function");
    expect(permit?.stateMutability).toBe("nonpayable");
    expect(permit?.inputs?.length).toBe(7);
  });
});
