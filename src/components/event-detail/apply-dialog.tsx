"use client";

import { useState } from "react";
import { CheckCircle2, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatEventDay, formatTimeRange } from "@/lib/format";
import { applyToSlot } from "@/lib/supabase/event-actions";
import type { EventWithSlots } from "@/lib/supabase/types";
import { runAction } from "@/lib/toast-action";
import type { Role } from "@/lib/nav-items";
import { mockRoster, mockRosterByCategory } from "@/lib/mock-roster";

type Step = "choose-talent" | "confirm" | "success";

export function ApplyDialog({
  event,
  slot,
  role,
  open,
  onOpenChange,
}: {
  event: EventWithSlots;
  slot: EventWithSlots["slots"][number];
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isAgency = role === "agency";
  const [step, setStep] = useState<Step>(isAgency ? "choose-talent" : "confirm");
  const [selectedTalentId, setSelectedTalentId] = useState(mockRoster[0]?.id ?? "");
  const [offerAmount, setOfferAmount] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const selectedTalent = mockRoster.find((t) => t.id === selectedTalentId);

  async function handleApply() {
    setError(undefined);
    setPending(true);
    const formData = new FormData();
    formData.set("slotId", slot.id);
    if (offerAmount) formData.set("offerAmountUsd", offerAmount);
    const result = await runAction(applyToSlot(formData), { success: "Application submitted." });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStep("success");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        {step === "choose-talent" && (
          <>
            <DialogHeader>
              <DialogTitle>Choose a Talent</DialogTitle>
              <DialogDescription>Choose a Talent to go to the next step</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2.5 rounded-full border border-input px-4 py-2.5">
              <Search className="size-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search for Artist, Band or everything..."
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex max-h-[360px] flex-col gap-5 overflow-y-auto">
              {Object.entries(mockRosterByCategory).map(([category, talents]) => (
                <div key={category} className="flex flex-col gap-3">
                  <span className="text-sm font-medium text-foreground">{category}</span>
                  <div className="grid grid-cols-3 gap-3">
                    {talents.map((talent) => (
                      <button
                        key={talent.id}
                        type="button"
                        onClick={() => setSelectedTalentId(talent.id)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-[8px] border border-transparent bg-muted p-3 text-left transition-colors",
                          selectedTalentId === talent.id && "border-primary bg-primary/5"
                        )}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                          <User className="size-4" />
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{talent.name}</span>
                          <span className="text-xs text-muted-foreground">{talent.category}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="h-11 flex-1 rounded-[6px]" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="h-11 flex-1 rounded-[6px]" onClick={() => setStep("confirm")}>
                Next Step
              </Button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle>{slot.category_name}</DialogTitle>
                <span className="text-lg font-bold text-foreground">${slot.price_usd}</span>
              </div>
            </DialogHeader>

            {isAgency && selectedTalent && (
              <div className="flex items-center gap-3 rounded-[8px] bg-muted p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  <User className="size-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{selectedTalent.name}</span>
                  <span className="text-xs text-muted-foreground">{selectedTalent.category}</span>
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-[8px] bg-muted p-3 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase">Date</span>
                <span className="font-medium text-foreground">{formatEventDay(event.event_date)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase">Time</span>
                <span className="font-medium text-foreground">
                  {formatTimeRange(event.start_time, event.end_time)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase">Available Slot</span>
                <span className="font-medium text-foreground">{slot.quantity_total} Slots</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase">Working Type</span>
                <span className="font-medium text-foreground">{slot.slot_type}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-[8px] bg-muted p-3 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase">Location</span>
                <span className="font-medium text-foreground">
                  {event.organizer.city_name || event.address}
                </span>
              </div>
              {event.contact_phone && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground uppercase">Contact Info</span>
                  <span className="font-medium text-foreground">{event.contact_phone}</span>
                </div>
              )}
            </div>

            {event.description && (
              <p className="rounded-[8px] bg-muted p-3 text-xs text-muted-foreground">
                {event.description}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="offer" className="text-sm text-muted-foreground">
                Your Offer (Optional)
              </Label>
              <Input
                id="offer"
                placeholder="e.g. 2200"
                type="number"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                className="h-11 rounded-[6px]"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="flex gap-3">
              {isAgency && (
                <Button
                  variant="secondary"
                  className="h-11 flex-1 rounded-[6px]"
                  onClick={() => setStep("choose-talent")}
                >
                  Back
                </Button>
              )}
              <Button disabled={pending} className="h-11 flex-1 rounded-[6px]" onClick={handleApply}>
                {pending ? "Applying..." : "Apply"}
              </Button>
            </div>
          </>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="size-12 text-green-500" />
            <div className="flex flex-col gap-1">
              <DialogTitle>Request was Sent</DialogTitle>
              <DialogDescription>We will notify for request status and update</DialogDescription>
            </div>
            <Button className="h-11 w-full rounded-[6px]" onClick={() => onOpenChange(false)}>
              Continue
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
