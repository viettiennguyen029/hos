import type { LocalAccount } from "viem/accounts";

const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/**
 * Signs an EIP-2612 Permit for the settlement token, so the organizer's
 * spending approval can be submitted by the platform's relayer wallet
 * directly (not via the ERC2771Forwarder) -- a plain ERC20's approve()
 * has no concept of a trusted forwarder, so relaying it there grants
 * allowance to the forwarder's own address instead of the organizer's.
 * permit()'s explicit `owner` parameter carries the authorization
 * instead, so who submits the transaction doesn't matter.
 */
export async function signPermit(
  account: LocalAccount,
  params: {
    tokenAddress: `0x${string}`;
    tokenName: string;
    tokenVersion: string;
    chainId: number;
    spender: `0x${string}`;
    value: bigint;
    nonce: bigint;
    deadline: bigint;
  }
): Promise<`0x${string}`> {
  return account.signTypedData({
    domain: {
      name: params.tokenName,
      version: params.tokenVersion,
      chainId: params.chainId,
      verifyingContract: params.tokenAddress,
    },
    types: PERMIT_TYPES,
    primaryType: "Permit",
    message: {
      owner: account.address,
      spender: params.spender,
      value: params.value,
      nonce: params.nonce,
      deadline: params.deadline,
    },
  });
}
