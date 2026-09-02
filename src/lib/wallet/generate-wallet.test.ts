import { describe, expect, it } from "bun:test";
import { generateWallet } from "@/lib/wallet/generate-wallet";

describe("generateWallet", () => {
  it("returns a checksummed EVM address and a matching private key", () => {
    const wallet = generateWallet();
    expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it("generates a different keypair on every call", () => {
    const a = generateWallet();
    const b = generateWallet();
    expect(a.address).not.toBe(b.address);
    expect(a.privateKey).not.toBe(b.privateKey);
  });
});
