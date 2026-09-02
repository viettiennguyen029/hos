import { afterEach, describe, expect, it } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getPublicClient, getWalletClient } from "@/lib/chain/clients";

afterEach(() => {
  delete process.env.AVALANCHE_RPC_URL;
  delete process.env.AVALANCHE_NETWORK;
});

describe("getPublicClient", () => {
  it("throws when AVALANCHE_RPC_URL is not set", () => {
    delete process.env.AVALANCHE_RPC_URL;
    expect(() => getPublicClient()).toThrow(/AVALANCHE_RPC_URL/);
  });

  it("throws for an unknown AVALANCHE_NETWORK value", () => {
    process.env.AVALANCHE_RPC_URL = "https://example.com/rpc";
    process.env.AVALANCHE_NETWORK = "not-a-real-network";
    expect(() => getPublicClient()).toThrow(/AVALANCHE_NETWORK/);
  });

  it("defaults to Avalanche Fuji (chain id 43113) when AVALANCHE_NETWORK is unset", () => {
    process.env.AVALANCHE_RPC_URL = "https://example.com/rpc";
    const client = getPublicClient();
    expect(client.chain?.id).toBe(43113);
  });

  it("uses Avalanche mainnet (chain id 43114) when AVALANCHE_NETWORK=mainnet", () => {
    process.env.AVALANCHE_RPC_URL = "https://example.com/rpc";
    process.env.AVALANCHE_NETWORK = "mainnet";
    const client = getPublicClient();
    expect(client.chain?.id).toBe(43114);
  });
});

describe("getWalletClient", () => {
  it("creates a wallet client bound to the given account", () => {
    process.env.AVALANCHE_RPC_URL = "https://example.com/rpc";
    const account = privateKeyToAccount(generatePrivateKey());
    const client = getWalletClient(account);
    expect(client.account?.address).toBe(account.address);
  });
});
