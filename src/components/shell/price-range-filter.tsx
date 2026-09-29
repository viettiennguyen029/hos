"use client";

import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

export const PRICE_FILTER_MAX = 5_000_000_000;

function formatVnd(n: number) {
  return n.toLocaleString("en-US");
}

export function PriceRangeFilter({
  range,
  onChange,
}: {
  range: [number, number];
  onChange: (range: [number, number]) => void;
}) {
  const label = range[0] === 0 && range[1] === PRICE_FILTER_MAX ? "$0+" : `${formatVnd(range[0])}+`;

  return (
    <Popover>
      <PopoverTrigger className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-4 py-2.5 text-sm text-foreground outline-none transition-colors hover:bg-accent">
        <span className="text-muted-foreground">Price Range</span>
        <span className="font-medium">{label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[380px]" align="start">
        <div className="flex flex-col gap-4">
          <span className="text-sm font-medium text-foreground">Price Slider</span>
          <Slider
            value={range}
            min={0}
            max={PRICE_FILTER_MAX}
            step={1_000_000}
            onValueChange={(v) => onChange(v as [number, number])}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-[6px] border border-input px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">VND</span>
              <span className="font-medium text-foreground">{formatVnd(range[0])}</span>
            </div>
            <div className="flex items-center gap-2 rounded-[6px] border border-input px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">VND</span>
              <span className="font-medium text-foreground">{formatVnd(range[1])}</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
