"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CardCarouselProps {
  title: string;
  viewAllHref: string;
  children: ReactNode;
}

export function CardCarousel({ title, viewAllHref, children }: CardCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByAmount(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * 620, behavior: "smooth" });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium tracking-[-0.03em] text-foreground">{title}</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Scroll back"
            onClick={() => scrollByAmount(-1)}
            className="flex size-8 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Scroll forward"
            onClick={() => scrollByAmount(1)}
            className="flex size-8 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent"
          >
            <ChevronRight className="size-4" />
          </button>
          <Link href={viewAllHref} className="ml-1 text-sm font-medium text-muted-foreground">
            View All
          </Link>
        </div>
      </div>
      <div ref={trackRef} className="scrollbar-hide flex gap-6 overflow-x-auto scroll-smooth pb-2">
        {children}
      </div>
    </section>
  );
}
