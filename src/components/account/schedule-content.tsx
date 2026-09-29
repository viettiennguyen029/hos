"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, getMonthGrid, monthFetchWindow, startOfWeekMonday, toIsoDate } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { fetchScheduleEntries } from "@/lib/supabase/schedule-actions";
import type { ScheduleEntry } from "@/lib/supabase/schedule";

const FIRST_HOUR = 8;
const LAST_HOUR = 23;
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 36;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatHour(hour: number) {
  const h = hour % 24;
  const wholeHour = Math.floor(h);
  const minutes = Math.round((h - wholeHour) * 60);
  const period = wholeHour < 12 ? "AM" : "PM";
  const displayHour = wholeHour % 12 === 0 ? 12 : wholeHour % 12;
  return minutes === 0 ? `${displayHour}${period}` : `${displayHour}:${String(minutes).padStart(2, "0")}${period}`;
}

export function ScheduleContent({
  initialEntries,
  initialToday,
}: {
  initialEntries: ScheduleEntry[];
  initialToday: { year: number; month: number; day: number };
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [selectedDate, setSelectedDate] = useState(
    () => new Date(initialToday.year, initialToday.month, initialToday.day)
  );
  const [viewYear, setViewYear] = useState(initialToday.year);
  const [viewMonth, setViewMonth] = useState(initialToday.month);

  // initialEntries only ever seeds the very first render — every viewYear/viewMonth
  // change after that (prev/next month, or Today jumping to a different month) goes
  // through the fetch effect below, which always requests the freshly-computed window.
  const requestIdRef = useRef(0);
  const isFirstRunRef = useRef(true);
  useEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }
    const requestId = ++requestIdRef.current;
    const { start, end } = monthFetchWindow(viewYear, viewMonth);
    fetchScheduleEntries(start, end).then((result) => {
      if (requestId !== requestIdRef.current) return;
      setEntries(result);
    });
  }, [viewYear, viewMonth]);

  const monday = startOfWeekMonday(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label: WEEKDAY_LABELS[i], date: d.getDate(), iso: toIsoDate(d) };
  });

  const weekEvents = weekDays.flatMap((day, dayIndex) =>
    entries.filter((e) => e.date === day.iso).map((e) => ({ ...e, dayIndex }))
  );

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekRangeLabel =
    monday.getMonth() === sunday.getMonth()
      ? `${MONTH_LABELS[monday.getMonth()]} ${monday.getDate()}–${sunday.getDate()}, ${sunday.getFullYear()}`
      : `${MONTH_LABELS[monday.getMonth()]} ${monday.getDate()} – ${MONTH_LABELS[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`;

  const { leadingBlanks, days: monthDays } = getMonthGrid(viewYear, viewMonth);

  // `entries` covers the whole padded month window (past days included, for
  // whichever week is on screen) — the sidebar's own "Upcoming" label needs
  // just the from-today-forward slice of that same window.
  const upcomingEntries = entries.filter((e) => e.date >= toIsoDate(new Date()));

  function goToPrevMonth() {
    const next = addMonths(viewYear, viewMonth, -1);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  function goToNextMonth() {
    const next = addMonths(viewYear, viewMonth, 1);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  function goToToday() {
    // Computed fresh on click (not from initialToday) so a tab left open across
    // midnight still jumps to the real current date, not the day it was loaded.
    const today = new Date();
    setSelectedDate(today);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  function selectDay(day: number) {
    setSelectedDate(new Date(viewYear, viewMonth, day));
  }

  const gridHeight = HOURS.length * ROW_HEIGHT;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4 rounded-md bg-muted p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-foreground">Schedule</h2>
          <p className="text-xs text-muted-foreground">{weekRangeLabel}</p>
        </div>
        <div className="overflow-x-auto">
          <div className="relative min-w-[680px]" style={{ paddingLeft: 56 }}>
            {/* Day headers */}
            <div className="flex" style={{ height: HEADER_HEIGHT }}>
              {weekDays.map((day) => (
                <div
                  key={day.label}
                  className="flex flex-1 items-center justify-center text-xs font-medium text-muted-foreground"
                >
                  {day.label} {day.date}
                </div>
              ))}
            </div>

            {/* Grid body: hour labels (absolutely placed to the left) + row lines + day column dividers */}
            <div className="relative" style={{ height: gridHeight }}>
              <div
                className="absolute top-0 left-[-56px] flex w-14 flex-col text-right"
                aria-hidden
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="shrink-0 pr-2 text-xs text-muted-foreground"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {formatHour(hour)}
                  </div>
                ))}
              </div>

              {/* horizontal hour lines */}
              {HOURS.map((hour, i) => (
                <div
                  key={hour}
                  className="absolute right-0 left-0 border-t border-border"
                  style={{ top: i * ROW_HEIGHT }}
                />
              ))}

              {/* vertical day dividers */}
              <div className="absolute inset-0 flex">
                {weekDays.map((day) => (
                  <div key={day.label} className="flex-1 border-l border-border first:border-l-0" />
                ))}
              </div>

              {/* event blocks */}
              {weekEvents.map((event, i) => {
                const top = (event.startHour - FIRST_HOUR) * ROW_HEIGHT;
                const height = (event.endHour - event.startHour) * ROW_HEIGHT;
                return (
                  <div
                    key={i}
                    className="absolute overflow-hidden rounded-[6px] bg-primary p-2 text-xs text-primary-foreground shadow-sm"
                    style={{
                      top: top + 2,
                      height: height - 4,
                      left: `calc(${event.dayIndex} * (100% / 7) + 4px)`,
                      width: `calc(100% / 7 - 8px)`,
                    }}
                  >
                    <p className="font-semibold">{event.title}</p>
                    <p className="opacity-80">
                      {formatHour(event.startHour)} - {formatHour(event.endHour)}
                    </p>
                    <p className="opacity-70">{event.venue}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-md bg-muted p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToPrevMonth}
                aria-label="Previous month"
                className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={goToNextMonth}
                aria-label="Next month"
                className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent"
              >
                <ChevronRight className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-accent"
              >
                Today
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-2 text-center text-xs">
            {WEEKDAY_LABELS.map((d) => (
              <span key={d} className="text-muted-foreground">
                {d}
              </span>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {monthDays.map((d) => {
              const isSelected =
                viewYear === selectedDate.getFullYear() &&
                viewMonth === selectedDate.getMonth() &&
                d === selectedDate.getDate();
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => selectDay(d)}
                  className={cn(
                    "mx-auto flex size-6 items-center justify-center rounded-full",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Upcoming Events</h3>
          {upcomingEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No confirmed engagements yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingEntries.map((entry, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-muted p-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{entry.title}</span>
                    <span className="text-xs text-muted-foreground">{entry.venue}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
