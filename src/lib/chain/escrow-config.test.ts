import { afterEach, describe, expect, it } from "bun:test";
import {
  bookingIdToBytes32,
  getEscrowManagerAddress,
  getSettlementTokenAddress,
  vndToTokenAmount,
} from "@/lib/chain/escrow-config";

afterEach(() => {
  delete process.env.ESCROW_MANAGER_ADDRESS;
  delete process.env.SETTLEMENT_TOKEN_ADDRESS;
  delete process.env.VND_PER_USDT;
});

describe("getEscrowManagerAddress", () => {
  it("throws when ESCROW_MANAGER_ADDRESS is not set", () => {
    delete process.env.ESCROW_MANAGER_ADDRESS;
    expect(() => getEscrowManagerAddress()).toThrow(/ESCROW_MANAGER_ADDRESS/);
  });

  it("throws when ESCROW_MANAGER_ADDRESS is not a valid address", () => {
    process.env.ESCROW_MANAGER_ADDRESS = "not-an-address";
    expect(() => getEscrowManagerAddress()).toThrow(/not a valid address/);
  });

  it("returns a valid configured address", () => {
    process.env.ESCROW_MANAGER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    expect(getEscrowManagerAddress()).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  });
});

describe("getSettlementTokenAddress", () => {
  it("throws when SETTLEMENT_TOKEN_ADDRESS is not set", () => {
    delete process.env.SETTLEMENT_TOKEN_ADDRESS;
    expect(() => getSettlementTokenAddress()).toThrow(/SETTLEMENT_TOKEN_ADDRESS/);
  });

  it("throws when SETTLEMENT_TOKEN_ADDRESS is not a valid address", () => {
    process.env.SETTLEMENT_TOKEN_ADDRESS = "not-an-address";
    expect(() => getSettlementTokenAddress()).toThrow(/not a valid address/);
  });

  it("returns a valid configured address", () => {
    process.env.SETTLEMENT_TOKEN_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    expect(getSettlementTokenAddress()).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  });
});

describe("bookingIdToBytes32", () => {
  it("right-pads a UUID's 16 bytes into a bytes32 hex string", () => {
    const result = bookingIdToBytes32("11111111-2222-3333-4444-555555555555");
    expect(result).toBe("0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66));
  });

  it("throws for a malformed UUID", () => {
    expect(() => bookingIdToBytes32("not-a-uuid")).toThrow(/not a valid UUID/);
  });
});

describe("vndToTokenAmount", () => {
  it("converts a VND price into smallest-unit token amount using VND_PER_USDT", () => {
    process.env.VND_PER_USDT = "25000";
    // 2,500,000 VND / 25,000 VND-per-USDT = 100 USDT = 100_000000 (6 decimals)
    expect(vndToTokenAmount(2_500_000)).toBe(100_000000n);
  });

  it("throws when VND_PER_USDT is not set", () => {
    delete process.env.VND_PER_USDT;
    expect(() => vndToTokenAmount(1000)).toThrow(/VND_PER_USDT/);
  });
});
