"use client";

import { cn } from "@/lib/utils";

export function CategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string;
  onChange: (category: string) => void;
}) {
  return (
    <div className="scrollbar-hide flex gap-3 overflow-x-auto">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onChange(category)}
          className={cn(
            "shrink-0 rounded-[8px] px-6 py-3 text-sm font-medium tracking-[-0.03em] transition-colors",
            active === category
              ? "bg-foreground text-background"
              : "bg-muted text-foreground hover:bg-accent"
          )}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
