"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ApplyDialog } from "@/components/event-detail/apply-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { EventWithSlots } from "@/lib/supabase/types";
import type { Role } from "@/lib/nav-items";

function formatVnd(amount: number) {
  return `${amount.toLocaleString("en-US")} VND`;
}

export function ApplyPanel({ event, role }: { event: EventWithSlots; role: Role }) {
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const visibleSlots = showAll ? event.slots : event.slots.slice(0, 5);
  const hasSlots = event.slots.length > 0;

  return (
    <aside className="flex h-fit w-[380px] shrink-0 flex-col gap-5 rounded-md bg-muted p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-[-0.03em] text-foreground">
          {`${event.name} Event's Available Slot`}
        </h2>
        <p className="text-sm text-muted-foreground">Use filter for better search experience</p>
      </div>

      {(event.budget_min_vnd || event.budget_max_vnd) && (
        <div className="flex items-baseline gap-2 text-foreground">
          <span className="text-sm text-muted-foreground">VND</span>
          <span className="text-base font-bold">
            {formatVnd(event.budget_min_vnd ?? 0)} - {formatVnd(event.budget_max_vnd ?? 0)}
          </span>
        </div>
      )}

      {hasSlots ? (
        <RadioGroup
          value={String(selectedSlot)}
          onValueChange={(v) => setSelectedSlot(Number(v))}
          className="flex flex-col gap-3"
        >
          {visibleSlots.map((slot, i) => (
            <Label
              key={slot.id}
              htmlFor={`slot-${slot.id}`}
              className={cn(
                "flex cursor-pointer items-start justify-between gap-3 rounded-[8px] border border-transparent bg-muted p-4 transition-colors",
                selectedSlot === i && "border-primary bg-primary/5"
              )}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value={String(i)} id={`slot-${slot.id}`} className="mt-0.5" />
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">{slot.category_name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">TYPE</span>
                    <span className="text-foreground">{slot.slot_type}</span>
                    <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                      QUANTITY
                    </span>
                    <span className="font-medium text-foreground">{slot.quantity_total} slots</span>
                  </div>
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">${slot.price_usd}</span>
            </Label>
          ))}
        </RadioGroup>
      ) : (
        <p className="text-sm text-muted-foreground">No open slots for this event yet.</p>
      )}

      {event.slots.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex items-center gap-1 self-start text-sm text-muted-foreground"
        >
          {showAll ? "Show less" : "Show more"}
          <ChevronDown className={cn("size-4 transition-transform", showAll && "rotate-180")} />
        </button>
      )}

      <Button
        disabled={!hasSlots}
        onClick={() => {
          setDialogKey((k) => k + 1);
          setDialogOpen(true);
        }}
        className="h-[52px] w-full rounded-[6px] text-base font-semibold"
      >
        Apply
      </Button>

      {hasSlots && (
        <ApplyDialog
          key={dialogKey}
          event={event}
          slot={event.slots[selectedSlot]}
          role={role}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </aside>
  );
}
