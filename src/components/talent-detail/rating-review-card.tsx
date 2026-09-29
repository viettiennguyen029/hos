"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewWithReviewer } from "@/lib/supabase/types";

function StarRow({ count, size = "size-4" }: { count: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(size, i < count ? "fill-primary text-primary" : "text-muted-foreground/40")}
        />
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function RatingReviewCard({
  avgRating,
  count,
  reviews,
}: {
  avgRating: number | null;
  count: number;
  reviews: ReviewWithReviewer[];
}) {
  const [index, setIndex] = useState(0);

  if (count === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-md bg-muted p-6 text-center">
        <span className="text-sm font-medium text-foreground">No reviews yet</span>
        <span className="text-xs text-muted-foreground">
          Reviews appear here once an organizer rates a completed booking.
        </span>
      </div>
    );
  }

  const review = reviews[index];

  function go(direction: 1 | -1) {
    setIndex((i) => (i + direction + reviews.length) % reviews.length);
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-6 rounded-md bg-muted p-6">
      <div className="flex w-[160px] flex-col items-center justify-center gap-2 rounded-[8px] bg-muted px-6 py-4 text-center">
        <span className="text-5xl font-bold text-foreground">{avgRating?.toFixed(1)}</span>
        <StarRow count={Math.round(avgRating ?? 0)} />
        <span className="text-sm text-muted-foreground">{count} review{count === 1 ? "" : "s"}</span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
              {review.reviewer_name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{review.reviewer_name}</span>
              <StarRow count={review.rating} size="size-3" />
            </div>
          </div>
          {reviews.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous review"
                onClick={() => go(-1)}
                className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground hover:bg-accent"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next review"
                onClick={() => go(1)}
                className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground hover:bg-accent"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{formatDate(review.created_at)}</span>
          <p className="text-sm text-muted-foreground">{review.comment || "No comment left."}</p>
        </div>
      </div>
    </div>
  );
}
