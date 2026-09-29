"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { acceptApplication, rejectApplication } from "@/lib/supabase/event-actions";
import { ReviewDialog } from "@/components/shared/review-dialog";
import type { EventApplicationWithDetails } from "@/lib/supabase/types";
import { runAction } from "@/lib/toast-action";

const statusStyles: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500",
  accepted: "bg-green-500/10 text-green-500",
  rejected: "bg-muted text-muted-foreground",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function EventApplicationsPanel({
  applications,
  reviewedApplicationIds,
}: {
  applications: EventApplicationWithDetails[];
  reviewedApplicationIds?: Set<string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [reviewTarget, setReviewTarget] = useState<{ id: string; talentName: string } | null>(null);

  if (applications.length === 0) return null;

  async function handle(action: "accept" | "reject", id: string) {
    setError(undefined);
    setPendingId(id);
    const result = await runAction(action === "accept" ? acceptApplication(id) : rejectApplication(id), {
      success: action === "accept" ? "Application accepted." : "Application rejected.",
    });
    setPendingId(undefined);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <div className="w-full border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {applications.length} application{applications.length === 1 ? "" : "s"}
        {pendingCount > 0 && ` (${pendingCount} pending)`}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {applications.map((app) => (
            <div
              key={app.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] bg-muted p-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{app.applicant_name}</span>
                <span className="text-xs text-muted-foreground">
                  {app.slot_category}
                  {app.offer_amount_usd ? ` · Offered $${app.offer_amount_usd}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("rounded-full px-3 py-1 text-xs font-medium", statusStyles[app.status])}>
                  {app.status}
                </span>
                {app.status === "pending" && (
                  <>
                    <button
                      type="button"
                      disabled={pendingId === app.id}
                      onClick={() => handle("reject", app.id)}
                      className="rounded-[6px] bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === app.id}
                      onClick={() => handle("accept", app.id)}
                      className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Accept
                    </button>
                  </>
                )}
                {app.status === "accepted" &&
                  app.event_date < todayIso() &&
                  !reviewedApplicationIds?.has(app.id) && (
                    <button
                      type="button"
                      onClick={() => setReviewTarget({ id: app.id, talentName: app.applicant_name })}
                      className="rounded-[6px] bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      Leave a Review
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewTarget && (
        <ReviewDialog
          open={reviewTarget !== null}
          onOpenChange={(open) => {
            if (!open) setReviewTarget(null);
          }}
          sourceType="application"
          sourceId={reviewTarget.id}
          talentName={reviewTarget.talentName}
          onSubmitted={() => router.refresh()}
        />
      )}
    </div>
  );
}
