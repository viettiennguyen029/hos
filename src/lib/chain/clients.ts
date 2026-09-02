import { createPublicClient, createWalletClient, http, type Account, type Chain, type PublicClient, type WalletClient } from "viem";
import { avalanche, avalancheFuji } from "viem/chains";

function resolveChain(): Chain {
  const network = process.env.AVALANCHE_NETWORK ?? "fuji";
  if (network === "mainnet") return avalanche;
  if (network === "fuji") return avalancheFuji;
  throw new Error(`Unknown AVALANCHE_NETWORK "${network}" -- expected "fuji" or "mainnet"`);
}

function resolveRpcUrl(): string {
  const url = process.env.AVALANCHE_RPC_URL;
  if (!url) throw new Error("AVALANCHE_RPC_URL is not set");
  return url;
}

export function getPublicClient(): PublicClient {
  return createPublicClient({ chain: resolveChain(), transport: http(resolveRpcUrl()) });
}

export function getWalletClient(account: Account): WalletClient {
  return createWalletClient({ account, chain: resolveChain(), transport: http(resolveRpcUrl()) });
}
