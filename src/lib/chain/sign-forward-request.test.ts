import { describe, expect, it } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyTypedData } from "viem";
import { signForwardRequest } from "@/lib/chain/sign-forward-request";

const FORWARDER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const TO_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const CHAIN_ID = 43113;

const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
} as const;

describe("signForwardRequest", () => {
  it("produces a signature that verifies against the same typed data via viem's verifyTypedData", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const requestCore = {
      from: account.address,
      to: TO_ADDRESS,
      value: 0n,
      gas: 500_000n,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    };
    const nonce = 0n;
    const data = "0xabcdef" as const;

    const signature = await signForwardRequest(account, {
      forwarderAddress: FORWARDER_ADDRESS,
      chainId: CHAIN_ID,
      requestCore,
      nonce,
      data,
    });

    const isValid = await verifyTypedData({
      address: account.address,
      domain: { name: "HosEscrowForwarder", version: "1", chainId: CHAIN_ID, verifyingContract: FORWARDER_ADDRESS },
      types: FORWARD_REQUEST_TYPES,
      primaryType: "ForwardRequest",
      message: { ...requestCore, nonce, data },
      signature,
    });

    expect(isValid).toBe(true);
  });

  it("produces a different signature for a different signer", async () => {
    const accountA = privateKeyToAccount(generatePrivateKey());
    const accountB = privateKeyToAccount(generatePrivateKey());
    const requestCore = {
      from: accountA.address,
      to: TO_ADDRESS,
      value: 0n,
      gas: 500_000n,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    };
    const sigA = await signForwardRequest(accountA, { forwarderAddress: FORWARDER_ADDRESS, chainId: CHAIN_ID, requestCore, nonce: 0n, data: "0x" });
    const sigB = await signForwardRequest(accountB, { forwarderAddress: FORWARDER_ADDRESS, chainId: CHAIN_ID, requestCore, nonce: 0n, data: "0x" });
    expect(sigA).not.toBe(sigB);
  });

  it("produces a different signature for a different nonce", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const requestCore = {
      from: account.address,
      to: TO_ADDRESS,
      value: 0n,
      gas: 500_000n,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    };
    const sig0 = await signForwardRequest(account, { forwarderAddress: FORWARDER_ADDRESS, chainId: CHAIN_ID, requestCore, nonce: 0n, data: "0x" });
    const sig1 = await signForwardRequest(account, { forwarderAddress: FORWARDER_ADDRESS, chainId: CHAIN_ID, requestCore, nonce: 1n, data: "0x" });
    expect(sig0).not.toBe(sig1);
  });
});
