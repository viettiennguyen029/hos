"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, RefreshCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ContractState = "funded" | "released" | "refunded";

interface LogEntry {
  id: string;
  label: string;
  hash: string;
  timestamp: string;
}

/** Demo fixture data — visual only, no live chain connection. */
const CONTRACT_ADDRESS = "0x43Ce77962af1a02cf1789a12Ea9EC58b29A7d55d";
const AMOUNT_VND = 20_000_000;
const AMOUNT_AVAX = "38.4 AVAX";

const INITIAL_LOG: LogEntry[] = [
  {
    id: "log-1",
    label: "Contract Deployed",
    hash: "0xa63db725ed8dc4394955c713d6d227338c6e54dba1456c327ef5c043581b275e",
    timestamp: "Aug 10, 2026 – 09:12",
  },
  {
    id: "log-2",
    label: "Escrow Funded — 20,000,000 VND locked",
    hash: "0x92d1b6a59fd90894d18809a7009b736172511ca9c8b796631c9e494953c21a4a",
    timestamp: "Aug 10, 2026 – 09:14",
  },
];

const RELEASE_LOG_ENTRY: LogEntry = {
  id: "log-3",
  label: "Payment Released to Talent",
  hash: "0x738d0d6ec694daa61d928264ddb74dfb73c0f4ca4c6a4d38f1ebc0da7d73066a",
  timestamp: "Just now",
};

const REFUND_LOG_ENTRY: LogEntry = {
  id: "log-3",
  label: "Booking Refunded to Organizer",
  hash: "0x4ff6de7af4fb539e5f5d718545d44dba82709105ecb88ea732b3688d340c3e61",
  timestamp: "Just now",
};

const STEPS = ["Created", "Funded", "Released"];

function truncateHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function SmartContractContent() {
  const [state, setState] = useState<ContractState>("funded");
  const [log, setLog] = useState<LogEntry[]>(INITIAL_LOG);

  function handleRelease() {
    if (state !== "funded") return;
    setState("released");
    setLog((prev) => [...prev, RELEASE_LOG_ENTRY]);
  }

  function handleRefund() {
    if (state !== "funded") return;
    setState("refunded");
    setLog((prev) => [...prev, REFUND_LOG_ENTRY]);
  }

  const activeStepIndex = state === "funded" ? 1 : 2;

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground">Smart Contract Escrow</h1>
        <p className="text-sm text-muted-foreground">
          This booking&apos;s payment is held by an on-chain contract, not by either party.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5 rounded-md bg-white/5 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground">EscrowManager Contract</h2>
              <StateBadge state={state} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Booking" value="Wedding Live Performance — Da Nang" />
              <Field label="Organizer" value="Nguyen Van A" />
              <Field label="Talent" value="The Acoustic Trio" />
              <Field label="Chain" value="Avalanche C-Chain (Fuji Testnet)" />
              <Field label="Amount Locked" value={`${AMOUNT_VND.toLocaleString("en-US")} VND (≈ ${AMOUNT_AVAX})`} />
              <Field label="Platform Commission" value="8% (800 bps)" />
            </div>

            <div className="flex flex-col gap-1 border-t border-border pt-4">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Contract Address
              </span>
              <span className="break-all font-mono text-xs text-foreground">{CONTRACT_ADDRESS}</span>
            </div>

            <ContractStepper activeStepIndex={activeStepIndex} />
          </div>

          <Tabs defaultValue="organizer">
            <TabsList>
              <TabsTrigger value="organizer">Organizer View</TabsTrigger>
              <TabsTrigger value="talent">Talent View</TabsTrigger>
            </TabsList>

            <TabsContent value="organizer" className="mt-4">
              <OrganizerView state={state} onRelease={handleRelease} onRefund={handleRefund} />
            </TabsContent>
            <TabsContent value="talent" className="mt-4">
              <TalentView state={state} onClaim={handleRelease} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex flex-col gap-6">
          <TransparencyLog log={log} />
          <PenaltyExplainer />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function StateBadge({ state }: { state: ContractState }) {
  if (state === "released") {
    return <Badge className="bg-green-500/15 text-green-500">Released</Badge>;
  }
  if (state === "refunded") {
    return <Badge variant="outline">Refunded</Badge>;
  }
  return <Badge>Funded — Awaiting Performance</Badge>;
}

function ContractStepper({ activeStepIndex }: { activeStepIndex: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-2 last:flex-none">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              i <= activeStepIndex ? "bg-primary text-primary-foreground" : "bg-white/10 text-muted-foreground"
            )}
          >
            {i + 1}
          </div>
          <span
            className={cn("text-xs font-medium", i <= activeStepIndex ? "text-foreground" : "text-muted-foreground")}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <span className={cn("h-px flex-1", i < activeStepIndex ? "bg-primary" : "bg-white/10")} />
          )}
        </div>
      ))}
    </div>
  );
}

function OrganizerView({
  state,
  onRelease,
  onRefund,
}: {
  state: ContractState;
  onRelease: () => void;
  onRefund: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-md bg-white/5 p-6">
      <p className="text-sm text-muted-foreground">
        You&apos;ve locked 100% of the payment in the contract. The talent can only be paid after you confirm the
        performance — or automatically after the grace period.
      </p>

      {state === "funded" && (
        <div className="flex flex-col gap-2">
          <Button onClick={onRelease} className="h-11 w-full rounded-[6px]">
            Confirm Performance & Release Payment
          </Button>
          <Button onClick={onRefund} variant="destructive" className="h-11 w-full rounded-[6px]">
            Report No-Show (Request Refund)
          </Button>
        </div>
      )}

      {state === "released" && (
        <p className="flex items-center gap-2 rounded-[8px] bg-green-500/10 p-3 text-sm text-green-500">
          <CheckCircle2 className="size-4 shrink-0" />
          Payment released to the talent. This transaction is final and recorded on-chain.
        </p>
      )}

      {state === "refunded" && (
        <p className="flex items-center gap-2 rounded-[8px] bg-white/5 p-3 text-sm text-foreground">
          <RefreshCcw className="size-4 shrink-0" />
          Funds refunded to you. The talent did not fulfill the performance.
        </p>
      )}
    </div>
  );
}

function TalentView({ state, onClaim }: { state: ContractState; onClaim: () => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-md bg-white/5 p-6">
      <p className="text-sm text-muted-foreground">
        Your payment is locked in the smart contract, not with the organizer. Once the event is marked complete, you
        can claim it directly — no invoices, no chasing payment.
      </p>

      {state === "funded" && (
        <div className="flex flex-col gap-2">
          <Button onClick={onClaim} className="h-11 w-full rounded-[6px]">
            Claim Payment
          </Button>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-3.5 shrink-0" />
            If the organizer doesn&apos;t respond within 48h after the event, funds release to you automatically.
          </p>
        </div>
      )}

      {state === "released" && (
        <p className="flex items-center gap-2 rounded-[8px] bg-green-500/10 p-3 text-sm text-green-500">
          <CheckCircle2 className="size-4 shrink-0" />
          {AMOUNT_VND.toLocaleString("en-US")} VND has been released to your wallet.
        </p>
      )}

      {state === "refunded" && (
        <p className="rounded-[8px] bg-white/5 p-3 text-sm text-foreground">
          This booking was refunded to the organizer due to a reported no-show.
        </p>
      )}
    </div>
  );
}

function TransparencyLog({ log }: { log: LogEntry[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-md bg-white/5 p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">On-Chain Transparency Log</h2>
      </div>
      <div className="flex flex-col gap-3">
        {log.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-0.5 border-l-2 border-primary/40 pl-3">
            <span className="text-sm font-medium text-foreground">{entry.label}</span>
            <span className="text-xs text-muted-foreground">{entry.timestamp}</span>
            <span className="font-mono text-xs text-muted-foreground">{truncateHash(entry.hash)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PenaltyExplainer() {
  return (
    <div className="flex flex-col gap-3 rounded-md bg-white/5 p-6 text-sm">
      <h2 className="text-sm font-bold text-foreground">How the guarantee works</h2>
      <ul className="flex flex-col gap-2 text-muted-foreground">
        <li>
          Performance completed as agreed → funds release to the talent, automatically or after a quick organizer
          confirmation.
        </li>
        <li>
          Talent no-shows or cancels late → the organizer can claim a full refund directly from the contract. No
          support ticket needed.
        </li>
        <li>
          Organizer goes silent after the event → the contract auto-releases funds to the talent after a 48-hour
          grace period. Nobody can hold funds hostage.
        </li>
        <li>Every step is recorded on-chain and publicly verifiable — not stored in a spreadsheet someone could edit.</li>
      </ul>
    </div>
  );
}
