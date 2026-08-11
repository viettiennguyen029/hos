import { isAddress } from "viem";

const SETTLEMENT_TOKEN_DECIMALS = 6;

export function getEscrowManagerAddress(): `0x${string}` {
  const address = process.env.ESCROW_MANAGER_ADDRESS;
  if (!address) throw new Error("ESCROW_MANAGER_ADDRESS is not set");
  if (!isAddress(address)) throw new Error(`ESCROW_MANAGER_ADDRESS "${address}" is not a valid address`);
  return address;
}

export function getSettlementTokenAddress(): `0x${string}` {
  const address = process.env.SETTLEMENT_TOKEN_ADDRESS;
  if (!address) throw new Error("SETTLEMENT_TOKEN_ADDRESS is not set");
  if (!isAddress(address)) throw new Error(`SETTLEMENT_TOKEN_ADDRESS "${address}" is not a valid address`);
  return address;
}

/**
 * Converts a Supabase booking UUID into the bytes32 key EscrowManager
 * uses, matching the scheme documented in the contract plan: the UUID's
 * 16 bytes right-padded into bytes32.
 */
export function bookingIdToBytes32(bookingUuid: string): `0x${string}` {
  const hex = bookingUuid.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw new Error(`bookingUuid "${bookingUuid}" is not a valid UUID`);
  }
  return `0x${hex.padEnd(64, "0")}` as `0x${string}`;
}

/**
 * Converts a VND price into the settlement token's smallest-unit amount,
 * using a fixed VND_PER_USDT env var. This is an explicit, acknowledged
 * placeholder for a real exchange-rate service -- see this plan's design
 * doc. Do not treat this as a bug to silently work around; it's a known,
 * documented simplification for this phase.
 */
export function vndToTokenAmount(priceVnd: number): bigint {
  const rateRaw = process.env.VND_PER_USDT;
  if (!rateRaw) throw new Error("VND_PER_USDT is not set");
  const rate = Number(rateRaw);
  const tokenAmount = priceVnd / rate;
  return BigInt(Math.round(tokenAmount * 10 ** SETTLEMENT_TOKEN_DECIMALS));
}
