"use client";

import { useState } from "react";
import { ChevronDown, DollarSign, Ticket } from "lucide-react";
import { FilterPill } from "@/components/shell/filter-pill";
import { TimeRangeFilter, type DateRange } from "@/components/shell/time-range-filter";
import { cn } from "@/lib/utils";
import { mockBillingSummary, mockInvoiceGroups } from "@/lib/mock-account";
import type { BillingGroup, BillingSummary } from "@/lib/supabase/billing";
import type { Role } from "@/lib/nav-items";

function formatVnd(n: number) {
  return `${Math.round(n).toLocaleString("en-US")} VND`;
}

export function BillingContent({
  role,
  summary,
  groups,
}: {
  role: Role;
  summary?: BillingSummary;
  groups?: BillingGroup[];
}) {
  const isReal = summary !== undefined && groups !== undefined;
  const totalLabel = role === "talent" ? "Total Income" : "Total Spend";

  const displayGroups = isReal ? groups! : mockInvoiceGroups.map((g) => ({ title: g.event, venue: g.venue, lines: g.lines.map((l) => ({ name: l.name, date: l.date, amountVnd: 0 })) }));
  const [openGroups, setOpenGroups] = useState<string[]>(displayGroups.map((g) => g.title));
  const [category, setCategory] = useState("All");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  function toggleGroup(title: string) {
    setOpenGroups((g) => (g.includes(title) ? g.filter((x) => x !== title) : [...g, title]));
  }

  const allDates = displayGroups.flatMap((g) => g.lines.map((l) => l.date)).sort();
  const bookingFrom = allDates[0];
  const bookingTo = allDates[allDates.length - 1];

  const totalBookings = isReal ? summary!.totalBookings : mockBillingSummary.totalBooking;
  const totalDisplay = isReal ? formatVnd(summary!.totalVnd) : mockBillingSummary.totalIncome;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-md bg-muted p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <Ticket className="size-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Total Booking</span>
            <span className="text-lg font-bold text-foreground">{totalBookings}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md bg-muted p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <DollarSign className="size-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{totalLabel}</span>
            <span className="text-lg font-bold text-foreground">{totalDisplay}</span>
          </div>
        </div>
        {bookingFrom && bookingTo && (
          <div className="flex flex-col gap-3 rounded-md bg-muted p-4">
            <span className="text-sm font-semibold text-foreground">Booking Information</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">DATE FROM</span>
              <span className="text-foreground">
                {bookingFrom} - {bookingTo}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          {isReal ? `${totalBookings} bookings` : `Booking from ${mockBillingSummary.bookingFrom} - ${mockBillingSummary.bookingTo}`}
        </h2>

        <div className="flex gap-3">
          <FilterPill label="Category" value={category} onChange={setCategory} options={["All", "Solo Singer", "Band", "DJ"]} />
          <TimeRangeFilter range={dateRange} onChange={setDateRange} />
        </div>

        {displayGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No billing activity yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {displayGroups.map((group) => {
              const isOpen = openGroups.includes(group.title);
              const groupTotal = group.lines.reduce((sum, l) => sum + l.amountVnd, 0);
              return (
                <div key={group.title} className="overflow-hidden rounded-md bg-muted">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-foreground"
                  >
                    {group.title} / {group.venue}
                    <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="flex flex-col border-t border-border">
                      {group.lines.map((line, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-5 py-3 text-sm last:border-b-0"
                        >
                          <span className="text-foreground">{line.name}</span>
                          <span className="text-muted-foreground">{line.date}</span>
                          <span className="font-medium text-foreground">
                            {isReal ? formatVnd(line.amountVnd) : "—"}
                          </span>
                        </div>
                      ))}
                      {isReal && (
                        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
                          <span className="font-semibold text-foreground">Subtotal</span>
                          <span className="font-semibold text-foreground">{formatVnd(groupTotal)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between rounded-md bg-muted p-5">
          <span className="text-base font-semibold text-foreground">Total {role === "talent" ? "Income" : "Cost"}</span>
          <span className="text-lg font-bold text-foreground">{totalDisplay}</span>
        </div>
      </div>
    </div>
  );
}
