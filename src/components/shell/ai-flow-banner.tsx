import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AiFlowBanner() {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-md border border-primary/30 bg-primary/5 p-6 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="size-5" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-wide text-primary uppercase">Advanced · AI-Powered</span>
          <h2 className="text-lg font-bold tracking-[-0.03em] text-foreground">
            Let AI find and book your talent — escrow-protected, start to finish
          </h2>
          <p className="text-sm text-muted-foreground">
            Chat your event details, get matched instantly, and see the smart-contract payment guarantee in action.
          </p>
        </div>
      </div>
      <Button asChild className="h-11 w-fit shrink-0 rounded-[6px] px-6">
        <Link href="/demo">Try the AI Flow</Link>
      </Button>
    </div>
  );
}
