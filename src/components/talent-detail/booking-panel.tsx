"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { addToCart } from "@/lib/supabase/package-actions";
import type { BusySlot, LookupOption, PackageRow, PackageWithLookupNames } from "@/lib/supabase/types";
import { runAction } from "@/lib/toast-action";
import { timeRangesOverlap } from "@/lib/time-overlap";

function formatVnd(amount: number) {
  return `${amount.toLocaleString("en-US")} VND`;
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Whether a chosen date falls on one of the package's repeat days (always true for one-time packages). */
function allowedWeekday(pkg: PackageRow, dateStr: string): boolean {
  if (!pkg.repeat_on || !pkg.repeat_days || pkg.repeat_days.length === 0) return true;
  const weekday = WEEKDAYS[new Date(`${dateStr}T00:00:00`).getDay()];
  return pkg.repeat_days.includes(weekday);
}

export function BookingPanel({
  talentName,
  packages,
  cities,
  busySlots,
}: {
  talentName: string;
  packages: PackageWithLookupNames[];
  cities: LookupOption[];
  busySlots: BusySlot[];
}) {
  const router = useRouter();
  const [selectedPackage, setSelectedPackage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [bookedDate, setBookedDate] = useState("");
  const [bookedTime, setBookedTime] = useState("");
  const [bookedEndTime, setBookedEndTime] = useState("");
  const [cityId, setCityId] = useState("");
  const [address, setAddress] = useState("");

  const busySlotsForDate = bookedDate ? busySlots.filter((slot) => slot.date === bookedDate) : [];

  const visiblePackages = showAll ? packages : packages.slice(0, 3);
  const hasPackages = packages.length > 0;
  const priceMin = hasPackages ? Math.min(...packages.map((p) => p.price_min_vnd)) : 0;
  const priceMax = hasPackages ? Math.max(...packages.map((p) => p.price_max_vnd)) : 0;
  const selectedPkg = packages[selectedPackage];

  function handleSelectPackage(index: number) {
    setSelectedPackage(index);
    setBookedDate("");
    setBookedTime(packages[index]?.start_time.slice(0, 5) ?? "");
    setBookedEndTime("");
  }

  async function handleAddToCart() {
    if (!selectedPkg) return;
    if (!bookedDate) {
      setError("Choose a date for this booking.");
      return;
    }
    if (!allowedWeekday(selectedPkg, bookedDate)) {
      setError(`This package is only available on: ${selectedPkg.repeat_days?.join(", ")}.`);
      return;
    }
    if (!bookedEndTime) {
      setError("Enter an end time for this booking.");
      return;
    }
    if (bookedEndTime <= bookedTime) {
      setError("End time must be after start time.");
      return;
    }
    const conflict = busySlotsForDate.find((slot) =>
      timeRangesOverlap(bookedTime, bookedEndTime, slot.startTime, slot.endTime)
    );
    if (conflict) {
      setError(
        `${talentName} is already booked ${conflict.startTime.slice(0, 5)}-${conflict.endTime.slice(0, 5)} on ${bookedDate}.`
      );
      return;
    }
    if (!cityId) {
      setError("Select the perform city.");
      return;
    }
    if (!address.trim()) {
      setError("Enter the perform address.");
      return;
    }
    setError(undefined);
    setPending(true);
    const formData = new FormData();
    formData.set("packageId", selectedPkg.id);
    formData.set("priceVnd", String(selectedPkg.price_min_vnd));
    formData.set("bookedDate", bookedDate);
    formData.set("bookedTime", bookedTime);
    formData.set("bookedEndTime", bookedEndTime);
    formData.set("cityId", cityId);
    formData.set("address", address);
    const result = await runAction(addToCart(formData), { success: "Added to cart." });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.push("/organizer/checkout");
  }

  return (
    <aside className="flex h-fit w-[380px] shrink-0 flex-col gap-5 rounded-md border border-border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-[-0.03em] text-foreground">
          {talentName}&rsquo;s Performance Packages
        </h2>
        <p className="text-sm text-muted-foreground">Choose a package that fits your event</p>
      </div>

      <Separator />

      {hasPackages ? (
        <>
          <div className="flex items-baseline gap-2 text-foreground">
            <span className="text-sm text-muted-foreground">VND</span>
            <span className="text-lg font-bold">
              {formatVnd(priceMin)} - {formatVnd(priceMax)}
            </span>
          </div>

          <RadioGroup
            value={String(selectedPackage)}
            onValueChange={(v) => handleSelectPackage(Number(v))}
            className="flex flex-col gap-3"
          >
            {visiblePackages.map((pkg, i) => (
              <Label
                key={pkg.id}
                htmlFor={`package-${pkg.id}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[8px] border border-transparent bg-muted p-4 transition-colors",
                  selectedPackage === i && "border-primary bg-primary/5"
                )}
              >
                <RadioGroupItem value={String(i)} id={`package-${pkg.id}`} className="mt-0.5" />
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">{pkg.title}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">LOCATION</span>
                    <span className="font-medium text-foreground">{pkg.city_name}</span>
                  </div>
                </div>
              </Label>
            ))}
          </RadioGroup>

          {packages.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="flex items-center gap-1 self-start text-sm text-muted-foreground"
            >
              {showAll ? "Show less" : "Show more"}
              <ChevronDown className={cn("size-4 transition-transform", showAll && "rotate-180")} />
            </button>
          )}

          {selectedPkg && (
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Booking Date</Label>
              <Input
                type="date"
                value={bookedDate}
                min={selectedPkg.start_date}
                max={selectedPkg.end_date}
                onChange={(e) => setBookedDate(e.target.value)}
                className="h-11 rounded-[6px]"
                aria-label="Booking date"
              />
              {selectedPkg.repeat_on && selectedPkg.repeat_days && selectedPkg.repeat_days.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Available on: {selectedPkg.repeat_days.join(", ")}
                </p>
              )}
              {busySlotsForDate.length > 0 && (
                <p className="text-xs text-destructive">
                  Already booked on this date: {busySlotsForDate
                    .map((slot) => `${slot.startTime.slice(0, 5)}-${slot.endTime.slice(0, 5)}`)
                    .join(", ")}
                  &mdash; pick a window outside these.
                </p>
              )}

              <Label className="mt-1 text-sm text-muted-foreground">
                Start Time &ndash; End Time<span className="text-primary">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                {talentName} is available {selectedPkg.start_time.slice(0, 5)}&ndash;
                {selectedPkg.end_time.slice(0, 5)} — pick the specific window you need them for.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="time"
                  value={bookedTime}
                  min={selectedPkg.start_time.slice(0, 5)}
                  max={selectedPkg.end_time.slice(0, 5)}
                  onChange={(e) => setBookedTime(e.target.value)}
                  className="h-11 rounded-[6px]"
                  aria-label="Booking start time"
                />
                <Input
                  type="time"
                  value={bookedEndTime}
                  min={bookedTime || selectedPkg.start_time.slice(0, 5)}
                  max={selectedPkg.end_time.slice(0, 5)}
                  onChange={(e) => setBookedEndTime(e.target.value)}
                  className="h-11 rounded-[6px]"
                  aria-label="Booking end time"
                />
              </div>
            </div>
          )}

          {selectedPkg && (
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">
                Perform Location<span className="text-primary">*</span>
              </Label>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                aria-label="Perform city"
                className="h-11 rounded-[6px] border border-input bg-transparent px-3 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="" disabled>
                  Select a city
                </option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id} className="bg-background text-foreground">
                    {city.name}
                  </option>
                ))}
              </select>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Perform address"
                aria-label="Perform address"
                className="h-11 rounded-[6px]"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            disabled={pending}
            onClick={handleAddToCart}
            className="h-[52px] w-full rounded-[6px] text-base font-semibold"
          >
            {pending ? "Adding..." : "Add to Cart"}
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">This talent hasn&rsquo;t published any packages yet.</p>
      )}
    </aside>
  );
}
