import { describe, expect, it } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyTypedData } from "viem";
import { signPermit } from "@/lib/chain/sign-permit";

const TOKEN_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const SPENDER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const CHAIN_ID = 43113;
const TOKEN_NAME = "Mock USD";
const TOKEN_VERSION = "1";

const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

describe("signPermit", () => {
  it("produces a signature that verifies against the same typed data via viem's verifyTypedData", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const value = 100_000000n;
    const nonce = 0n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    const signature = await signPermit(account, {
      tokenAddress: TOKEN_ADDRESS,
      tokenName: TOKEN_NAME,
      tokenVersion: TOKEN_VERSION,
      chainId: CHAIN_ID,
      spender: SPENDER_ADDRESS,
      value,
      nonce,
      deadline,
    });

    const isValid = await verifyTypedData({
      address: account.address,
      domain: { name: TOKEN_NAME, version: TOKEN_VERSION, chainId: CHAIN_ID, verifyingContract: TOKEN_ADDRESS },
      types: PERMIT_TYPES,
      primaryType: "Permit",
      message: { owner: account.address, spender: SPENDER_ADDRESS, value, nonce, deadline },
      signature,
    });

    expect(isValid).toBe(true);
  });

  it("produces a different signature for a different signer", async () => {
    const accountA = privateKeyToAccount(generatePrivateKey());
    const accountB = privateKeyToAccount(generatePrivateKey());
    const params = {
      tokenAddress: TOKEN_ADDRESS,
      tokenName: TOKEN_NAME,
      tokenVersion: TOKEN_VERSION,
      chainId: CHAIN_ID,
      spender: SPENDER_ADDRESS,
      value: 100_000000n,
      nonce: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    };
    const sigA = await signPermit(accountA, params);
    const sigB = await signPermit(accountB, params);
    expect(sigA).not.toBe(sigB);
  });

  it("produces a different signature for a different nonce", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const baseParams = {
      tokenAddress: TOKEN_ADDRESS,
      tokenName: TOKEN_NAME,
      tokenVersion: TOKEN_VERSION,
      chainId: CHAIN_ID,
      spender: SPENDER_ADDRESS,
      value: 100_000000n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    };
    const sig0 = await signPermit(account, { ...baseParams, nonce: 0n });
    const sig1 = await signPermit(account, { ...baseParams, nonce: 1n });
    expect(sig0).not.toBe(sig1);
  });
});
