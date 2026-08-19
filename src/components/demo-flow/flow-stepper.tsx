"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const FLOW_STEPS = [
  { href: "/demo", label: "Chat" },
  { href: "/demo/discover", label: "Discover" },
  { href: "/demo/checkout", label: "Checkout" },
  { href: "/demo/contract/create", label: "Contract" },
  { href: "/demo/contract/review", label: "Review & Agree" },
  { href: "/demo/topup", label: "Top-up" },
  { href: "/demo/booked", label: "Booked" },
  { href: "/demo/complete", label: "Complete Job" },
  { href: "/demo/release", label: "Release" },
] as const;

export function FlowStepper() {
  const pathname = usePathname();
  const activeIndex = FLOW_STEPS.findIndex((step) => step.href === pathname);

  return (
    <nav aria-label="Demo flow progress" className="scrollbar-hide flex items-center gap-1 overflow-x-auto pb-1">
      {FLOW_STEPS.map((step, i) => {
        const isActive = i === activeIndex;
        const isDone = activeIndex >= 0 && i < activeIndex;
        return (
          <div key={step.href} className="flex shrink-0 items-center gap-1">
            <Link
              href={step.href}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isDone
                    ? "bg-primary/15 text-primary"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
              )}
            >
              {isDone && <Check className="size-3" />}
              {i + 1}. {step.label}
            </Link>
            {i < FLOW_STEPS.length - 1 && <span className="h-px w-3 shrink-0 bg-white/10" />}
          </div>
        );
      })}
    </nav>
  );
}
