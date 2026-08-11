import { describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import { AppLevelKeyProvider } from "@/lib/wallet/app-level-key-provider";

function testProvider() {
  return new AppLevelKeyProvider(randomBytes(32));
}

describe("AppLevelKeyProvider", () => {
  it("round-trips a plaintext through encrypt then decrypt", async () => {
    const provider = testProvider();
    const payload = await provider.encrypt("0xdeadbeef-private-key");
    expect(await provider.decrypt(payload)).toBe("0xdeadbeef-private-key");
  });

  it("produces different ciphertext for the same plaintext on repeated calls", async () => {
    const provider = testProvider();
    const a = await provider.encrypt("same-plaintext");
    const b = await provider.encrypt("same-plaintext");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it("fails to decrypt when the auth tag has been tampered with", async () => {
    const provider = testProvider();
    const payload = await provider.encrypt("secret");
    const tampered = { ...payload, authTag: Buffer.from("0".repeat(32), "hex").toString("base64") };
    await expect(provider.decrypt(tampered)).rejects.toThrow();
  });

  it("fails to decrypt with a different master key", async () => {
    const providerA = testProvider();
    const providerB = testProvider();
    const payload = await providerA.encrypt("secret");
    await expect(providerB.decrypt(payload)).rejects.toThrow();
  });

  it("rejects a master key that isn't 32 bytes", () => {
    expect(() => new AppLevelKeyProvider(randomBytes(16))).toThrow(/32 bytes/);
  });
});
