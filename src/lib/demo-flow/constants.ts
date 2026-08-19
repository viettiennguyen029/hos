import type { Criterion } from "@/lib/demo-flow/types";

/** Fixed demo booking data — fabricated, carried across every step of the flow. */
export const DEMO_TALENT = {
  name: "The Acoustic Trio",
  category: "Live Band – Acoustic",
  city: "Da Nang",
  rating: 4.9,
  reviewCount: 38,
  bio: "A 3-piece acoustic band specializing in wedding and gala sets — guitar, cello, and vocals. 12 weddings performed in Da Nang this year.",
  priceMin: 15_000_000,
  priceMax: 22_000_000,
};

export const DEMO_BOOKING = {
  packageTitle: "Wedding Live Performance",
  eventDate: "2026-09-12",
  eventTime: "18:00 – 20:00",
  venueCity: "Da Nang",
  amountVnd: 20_000_000,
  amountAvax: "38.4 AVAX",
  chain: "Avalanche C-Chain (Fuji Testnet)",
  contractAddress: "0xe94fab976c8c1d0c6f8e574dfd8e8c2a772f1935",
  commissionBps: 800,
};

export const DEFAULT_CRITERIA: Criterion[] = [
  { id: "on-time", label: "Arrives and sets up on time", weightPct: 20 },
  { id: "full-set", label: "Performs the full 2-hour set", weightPct: 50 },
  { id: "song-list", label: "Follows the agreed song list", weightPct: 30 },
];
