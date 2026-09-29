"use client";

import { useRef } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function UploadSlot({
  label,
  filled,
  pending,
  error,
  previewUrl,
  onFileSelected,
  onRemove,
  className,
}: {
  label: string;
  filled: boolean;
  pending?: boolean;
  error?: string;
  previewUrl?: string;
  onFileSelected: (file: File) => void;
  onRemove?: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => !filled && inputRef.current?.click()}
          disabled={pending}
          className={cn(
            "relative flex size-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[8px] border border-dashed text-muted-foreground transition-colors",
            filled
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border bg-muted hover:bg-accent"
          )}
        >
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          <span
            className={cn(
              "relative flex flex-col items-center gap-2",
              previewUrl && "rounded-md bg-black/60 px-3 py-2 text-white"
            )}
          >
            {pending ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              !previewUrl && <ImagePlus className="size-6" />
            )}
            <span className="text-xs">{label}</span>
          </span>
        </button>
        {filled && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            aria-label={`Remove ${label}`}
            className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-black/60 disabled:opacity-50"
          >
            <X className="size-3" />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
