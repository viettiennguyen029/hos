import Link from "next/link";
import { ImageIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPriceRange } from "@/components/shell/listing-card";
import { DEMO_TALENT } from "@/lib/demo-flow/constants";

export function DiscoverStep() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">2. Discover the Talent</h1>
        <p className="text-sm text-muted-foreground">Full profile for the talent the AI recommended.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr]">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex aspect-square items-center justify-center rounded-[8px] bg-white/10 text-muted-foreground"
            >
              <ImageIcon className="size-6" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-md bg-white/5 p-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{DEMO_TALENT.name}</h2>
              <span className="flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-xs font-medium text-foreground">
                <Star className="size-3.5 fill-primary text-primary" />
                {DEMO_TALENT.rating.toFixed(1)}
                <span className="text-muted-foreground">({DEMO_TALENT.reviewCount} Reviews)</span>
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {DEMO_TALENT.category} &middot; {DEMO_TALENT.city}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">{DEMO_TALENT.bio}</p>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Price range</span>
            <span className="text-base font-semibold text-foreground">
              {formatPriceRange(DEMO_TALENT.priceMin, DEMO_TALENT.priceMax, "VND")}
            </span>
          </div>

          <Button asChild className="h-11 w-full rounded-[6px]">
            <Link href="/demo/checkout">Book Now</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
