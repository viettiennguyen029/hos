import type { LocalAccount } from "viem/accounts";

export interface ForwardRequestCore {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  gas: bigint;
  deadline: number;
}

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

/**
 * Signs an EIP-712 ForwardRequest for OpenZeppelin's ERC2771Forwarder.
 * Domain name/version and the type definition here MUST match
 * contracts/test/EscrowManager.test.ts's "gas-sponsored
 * meta-transactions" test exactly -- that test proves this shape against
 * the real deployed forwarder.
 */
export async function signForwardRequest(
  account: LocalAccount,
  params: {
    forwarderAddress: `0x${string}`;
    chainId: number;
    requestCore: ForwardRequestCore;
    nonce: bigint;
    data: `0x${string}`;
  }
): Promise<`0x${string}`> {
  return account.signTypedData({
    domain: {
      name: "HosEscrowForwarder",
      version: "1",
      chainId: params.chainId,
      verifyingContract: params.forwarderAddress,
    },
    types: FORWARD_REQUEST_TYPES,
    primaryType: "ForwardRequest",
    message: {
      ...params.requestCore,
      nonce: params.nonce,
      data: params.data,
    },
  });
}
