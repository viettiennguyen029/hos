import { isAddress } from "viem";

/**
 * Minimal ABI slice of OpenZeppelin's ERC2771Forwarder -- only the two
 * functions this app calls. See contracts/node_modules/@openzeppelin/
 * contracts/metatx/ERC2771Forwarder.sol for the full contract.
 */
export const forwarderAbi = [
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

export function getForwarderAddress(): `0x${string}` {
  const address = process.env.FORWARDER_ADDRESS;
  if (!address) throw new Error("FORWARDER_ADDRESS is not set");
  if (!isAddress(address)) throw new Error(`FORWARDER_ADDRESS "${address}" is not a valid address`);
  return address;
}
