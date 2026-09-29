"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export function HashtagFilter({
  selected,
  onChange,
  suggestions,
}: {
  selected: string[];
  onChange: (selected: string[]) => void;
  suggestions: string[];
}) {
  const [query, setQuery] = useState("");

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setQuery("");
  }

  function removeTag(tag: string) {
    onChange(selected.filter((t) => t !== tag));
  }

  const label = selected.length > 0 ? `${selected.length} selected` : "None";

  return (
    <Popover>
      <PopoverTrigger className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-4 py-2.5 text-sm text-foreground outline-none transition-colors hover:bg-accent">
        <span className="text-muted-foreground">Hashtag</span>
        <span className="font-medium">{label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[340px]" align="start">
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Search/Input for hashtag"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(query);
              }
            }}
            className="h-10 rounded-[6px]"
          />
          <div className="flex flex-wrap gap-2">
            {selected.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                {tag}
                <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {suggestions
              .filter((s) => !selected.includes(s))
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  {tag}
                </button>
              ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
