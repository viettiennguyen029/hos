import { afterEach, describe, expect, it } from "bun:test";
import { getForwarderAddress } from "@/lib/chain/forwarder";

afterEach(() => {
  delete process.env.FORWARDER_ADDRESS;
});

describe("getForwarderAddress", () => {
  it("throws when FORWARDER_ADDRESS is not set", () => {
    delete process.env.FORWARDER_ADDRESS;
    expect(() => getForwarderAddress()).toThrow(/FORWARDER_ADDRESS/);
  });

  it("returns the configured address", () => {
    process.env.FORWARDER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    expect(getForwarderAddress()).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  });

  it("throws when FORWARDER_ADDRESS is not a valid address", () => {
    process.env.FORWARDER_ADDRESS = "not-an-address";
    expect(() => getForwarderAddress()).toThrow(/not a valid address/);
  });
});
