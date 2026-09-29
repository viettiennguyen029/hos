"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  acceptQuotation,
  declineQuotation,
  rejectQuotation,
  respondToQuotation,
} from "@/lib/supabase/quotation-actions";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuotationWithNames } from "@/lib/supabase/types";
import type { Role } from "@/lib/nav-items";
import { runAction } from "@/lib/toast-action";

const statusStyles: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500",
  quoted: "bg-blue-500/10 text-blue-400",
  accepted: "bg-green-500/10 text-green-500",
  rejected: "bg-muted text-muted-foreground",
  declined: "bg-muted text-muted-foreground",
};

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

export function QuotationsContent({
  role,
  quotations,
  currentPage,
  totalPages,
}: {
  role: Role;
  quotations: QuotationWithNames[];
  currentPage?: number;
  totalPages?: number;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [respondTarget, setRespondTarget] = useState<QuotationWithNames | null>(null);
  const isTalent = role === "talent";

  async function handle(
    action: () => Promise<{ error: string } | { success: true }>,
    id: string,
    successMessage: string
  ) {
    setError(undefined);
    setPendingId(id);
    const result = await runAction(action(), { success: successMessage });
    setPendingId(undefined);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {quotations.length === 0 ? (
        <p className="rounded-md bg-muted p-6 text-sm text-muted-foreground">
          {isTalent ? "No quote requests yet." : "No quote requests sent yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {quotations.map((q) => (
            <div key={q.id} className="flex flex-col gap-3 rounded-md bg-muted p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground">{q.event_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {isTalent ? `From ${q.organizer_name}` : `To ${q.talent_name}`}
                    {q.event_date ? ` · ${q.event_date}` : ""}
                    {q.event_start_time && q.event_end_time
                      ? ` · ${q.event_start_time}-${q.event_end_time}`
                      : ""}
                    {q.venue ? ` · ${q.venue}` : ""}
                  </span>
                  {(q.city_name || q.address) && (
                    <span className="text-xs text-muted-foreground">
                      {[q.address, q.city_name].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {q.description && <p className="text-xs text-muted-foreground">{q.description}</p>}
                  {(q.budget_min_vnd || q.budget_max_vnd) && (
                    <span className="text-xs text-muted-foreground">
                      Budget: {q.budget_min_vnd ? formatVnd(q.budget_min_vnd) : "?"} -{" "}
                      {q.budget_max_vnd ? formatVnd(q.budget_max_vnd) : "?"}
                    </span>
                  )}
                </div>
                <span className={cn("w-fit rounded-full px-3 py-1 text-xs font-medium capitalize", statusStyles[q.status])}>
                  {q.status}
                </span>
              </div>

              {q.status === "quoted" && q.quoted_price_vnd && (
                <div className="flex flex-col gap-1 rounded-[8px] bg-muted p-3">
                  <span className="text-sm font-semibold text-foreground">
                    Quoted: {formatVnd(q.quoted_price_vnd)}
                  </span>
                  {q.talent_note && <p className="text-xs text-muted-foreground">{q.talent_note}</p>}
                </div>
              )}

              <div className="flex justify-end gap-2">
                {isTalent && q.status === "pending" && (
                  <>
                    <button
                      type="button"
                      disabled={pendingId === q.id}
                      onClick={() => handle(() => declineQuotation(q.id), q.id, "Quotation declined.")}
                      className="rounded-[6px] bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => setRespondTarget(q)}
                      className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Respond with a Quote
                    </button>
                  </>
                )}
                {!isTalent && q.status === "quoted" && (
                  <>
                    <button
                      type="button"
                      disabled={pendingId === q.id}
                      onClick={() => handle(() => rejectQuotation(q.id), q.id, "Quotation rejected.")}
                      className="rounded-[6px] bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === q.id}
                      onClick={() => handle(() => acceptQuotation(q.id), q.id, "Quotation accepted.")}
                      className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Accept
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {currentPage !== undefined && totalPages !== undefined && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          makeHref={(page) => `/${role}/account/quotations?page=${page}`}
        />
      )}

      {respondTarget && (
        <RespondDialog
          quotation={respondTarget}
          onOpenChange={(open) => {
            if (!open) setRespondTarget(null);
          }}
          onSubmitted={() => {
            setRespondTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RespondDialog({
  quotation,
  onOpenChange,
  onSubmitted,
}: {
  quotation: QuotationWithNames;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit() {
    setError(undefined);
    setPending(true);
    const formData = new FormData();
    formData.set("quotationId", quotation.id);
    formData.set("quotedPriceVnd", price);
    formData.set("talentNote", note);
    const result = await runAction(respondToQuotation(formData), { success: "Quote sent." });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onSubmitted();
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Respond to {quotation.organizer_name}</DialogTitle>
          <DialogDescription>{quotation.event_name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label className="text-sm text-muted-foreground">Your Quote (VND)</Label>
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="5000000"
            className="h-11 rounded-[6px]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-sm text-muted-foreground">Note (optional)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="rounded-[6px]"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit} disabled={pending} className="h-11 w-full rounded-[6px]">
          {pending ? "Sending..." : "Send Quote"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
