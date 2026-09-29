import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export function SearchBar({ className, placeholder, ...props }: ComponentProps<"input">) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[636px] items-center gap-3.5 rounded-full border border-border px-5 py-3.5",
        className
      )}
    >
      <Search className="size-[18px] shrink-0 text-foreground" />
      <input
        type="search"
        placeholder={placeholder ?? "Search for Artist, Band or everything..."}
        className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground/60 outline-none"
        {...props}
      />
    </div>
  );
}
