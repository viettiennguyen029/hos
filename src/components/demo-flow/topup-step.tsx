"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoFlow } from "@/lib/demo-flow/context";
import { DEMO_BOOKING } from "@/lib/demo-flow/constants";

/** Demo fixture — the organizer's fabricated custodial wallet, and the resulting deposit tx once funded. */
const ORGANIZER_WALLET = "0x7bbe8d27a8ff1922dcdf31a24f5a360a6f8035d5";
const DEPOSIT_TX_HASH = "0x5e78fc3aaa1e8174357217e4b76cfeba6da404a30981459ad0708f08f6d3e1de";

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

function truncateAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function TopupStep() {
  const { funded, setFunded } = useDemoFlow();
  const [pending, setPending] = useState(false);

  function handleDeposit() {
    setPending(true);
    setTimeout(() => {
      setPending(false);
      setFunded(true);
    }, 1500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">6. Fund the Escrow</h1>
        <p className="text-sm text-muted-foreground">
          Lock the full amount into the contract — one signature, no gas fee for you.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-md bg-white/5 p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Amount to deposit</span>
          <span className="text-lg font-bold text-foreground">{formatVnd(DEMO_BOOKING.amountVnd)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Chain</span>
          <span className="font-semibold text-foreground">{DEMO_BOOKING.chain}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">From (your wallet)</span>
          <span className="font-mono font-semibold text-foreground">{truncateAddress(ORGANIZER_WALLET)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">To (escrow contract)</span>
          <span className="font-mono font-semibold text-foreground">
            {truncateAddress(DEMO_BOOKING.contractAddress)}
          </span>
        </div>

        {!funded ? (
          <Button disabled={pending} onClick={handleDeposit} className="h-11 w-full rounded-[6px]">
            {pending ? "Processing deposit..." : "Deposit via Crypto (gasless)"}
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 rounded-[8px] bg-green-500/10 p-3 text-sm text-green-500">
              <CheckCircle2 className="size-4 shrink-0" />
              Funds locked in escrow.
            </p>
            <div className="flex items-center justify-between rounded-[8px] bg-white/5 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Deposit transaction</span>
              <span className="font-mono text-foreground">{truncateAddress(DEPOSIT_TX_HASH)}</span>
            </div>
          </div>
        )}
      </div>

      {funded && (
        <Button asChild className="h-11 w-full rounded-[6px]">
          <Link href="/demo/booked">Continue</Link>
        </Button>
      )}
    </div>
  );
}
