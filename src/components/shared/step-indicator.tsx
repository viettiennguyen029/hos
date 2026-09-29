import { cn } from "@/lib/utils";

export function StepIndicator({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              i <= activeIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {i + 1}
          </div>
          <span
            className={cn(
              "text-sm font-medium",
              i <= activeIndex ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
          {i < steps.length - 1 && <div className="h-px w-10 bg-border" />}
        </div>
      ))}
    </div>
  );
}
