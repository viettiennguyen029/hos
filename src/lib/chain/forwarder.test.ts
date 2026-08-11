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
    process.env.FORWARDER_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa";
    expect(getForwarderAddress()).toBe("0x5FbDB2315678afecb367f032d93F642f64180aa");
  });
});
