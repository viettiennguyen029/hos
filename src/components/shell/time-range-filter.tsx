"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface DateRange {
  start: string | null;
  end: string | null;
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TimeRangeFilter({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function handleDayClick(day: number) {
    const clickedIso = toIso(new Date(year, month, day));
    if (range.end !== null || range.start === null || clickedIso < range.start) {
      onChange({ start: clickedIso, end: null });
    } else {
      onChange({ start: range.start, end: clickedIso });
    }
  }

  const label = range.start && range.end ? "Custom Range" : "All Time";

  return (
    <Popover>
      <PopoverTrigger className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-4 py-2.5 text-sm text-foreground outline-none transition-colors hover:bg-accent">
        <span className="text-muted-foreground">Time</span>
        <span className="font-medium">{label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[320px]" align="start">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-base font-bold text-foreground">
              {MONTH_LABELS[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-2 text-center text-sm">
            {WEEKDAY_LABELS.map((d, i) => (
              <span key={i} className="text-xs text-muted-foreground">
                {d}
              </span>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {monthDays.map((day) => {
              const iso = toIso(new Date(year, month, day));
              const inRange = range.start !== null && range.end !== null && iso >= range.start && iso <= range.end;
              const isEndpoint = iso === range.start || iso === range.end;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "mx-auto flex size-7 items-center justify-center rounded-full text-foreground transition-colors",
                    inRange && "bg-primary/20",
                    isEndpoint && "bg-primary text-primary-foreground"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {(range.start || range.end) && (
            <button
              type="button"
              onClick={() => onChange({ start: null, end: null })}
              className="self-start text-xs text-muted-foreground underline"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
