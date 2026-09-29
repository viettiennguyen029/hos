"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CreditCard, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markNotificationsRead } from "@/lib/supabase/notification-actions";
import { runAction } from "@/lib/toast-action";
import type { NotificationItem, NotificationKind } from "@/lib/supabase/types";
import type { Role } from "@/lib/nav-items";

const PERSON_KINDS = new Set([
  "application_received",
  "application_status",
  "booking_marked_complete_by_talent",
  "booking_received",
  "counter_offer_received",
  "quotation_received",
  "quotation_responded",
]);

/** Where clicking a notification of this kind should take the viewer. */
function hrefForNotification(kind: NotificationKind, role: Role): string {
  const base = `/${role}/account`;
  switch (kind) {
    case "application_received":
      return `${base}/events`;
    case "application_status":
      return `${base}/schedule`;
    case "booking_received":
      return `${base}/orders`;
    case "booking_status":
      return `${base}/orders`;
    case "booking_marked_complete_by_talent":
      return `${base}/orders`;
    case "counter_offer_received":
      return `${base}/orders`;
    case "quotation_received":
      return `${base}/quotations`;
    case "quotation_responded":
      return `${base}/quotations`;
    case "kyc_status":
      return `/${role}/kyc`;
  }
}

export function NotificationButton({ role, notifications }: { role: Role; notifications: NotificationItem[] }) {
  const [items, setItems] = useState(notifications);
  const hasUnread = items.some((n) => n.unread);

  async function handleOpenChange(open: boolean) {
    if (open && hasUnread) {
      setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
      await runAction(markNotificationsRead());
    }
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-[46px] shrink-0 items-center justify-center rounded-full bg-muted transition-colors hover:bg-accent"
        >
          <Bell className="size-[22px] text-foreground" />
          {hasUnread && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-primary" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex max-h-[420px] flex-col divide-y divide-border overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            items.map((n) => (
              <Link
                key={n.id}
                href={hrefForNotification(n.kind, role)}
                className="flex items-start gap-3 p-4 transition-colors hover:bg-accent"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  {PERSON_KINDS.has(n.kind) ? <User className="size-4" /> : <CreditCard className="size-4" />}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{n.time}</p>
                </div>
                {n.unread && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
