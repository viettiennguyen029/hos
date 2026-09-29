import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { AccountShell } from "@/components/account/account-shell";
import { EventApplicationsPanel } from "@/components/account/event-applications-panel";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatEventDay } from "@/lib/format";
import { ACCOUNT_LIST_PAGE_SIZE, parsePageParam, totalPagesFor } from "@/lib/pagination";
import { listApplicationsForOrganizer, listOrganizerEventsPage } from "@/lib/supabase/events";
import { listReviewedSourceIds } from "@/lib/supabase/reviews";
import { getCurrentProfile } from "@/lib/supabase/server";
import type { EventStatus } from "@/lib/supabase/types";

const statusLabels: Record<EventStatus, string> = {
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusStyles: Record<EventStatus, string> = {
  upcoming: "bg-primary/10 text-primary",
  completed: "bg-green-500/10 text-green-500",
  cancelled: "bg-muted text-muted-foreground",
};

function formatBudget(minVnd: number | null, maxVnd: number | null) {
  if (!minVnd && !maxVnd) return "Budget TBD";
  const format = (n: number) => `${n.toLocaleString("en-US")} VND`;
  if (minVnd && maxVnd) return `${format(minVnd)} - ${format(maxVnd)}`;
  return format((minVnd ?? maxVnd)!);
}

export default async function OrganizerEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [profile, params] = await Promise.all([getCurrentProfile(), searchParams]);
  const page = parsePageParam(params.page);

  const [{ events, totalCount }, applications, reviewed] = profile
    ? await Promise.all([
        listOrganizerEventsPage(profile.id, page),
        listApplicationsForOrganizer(profile.id),
        listReviewedSourceIds(profile.id),
      ])
    : [{ events: [], totalCount: 0 }, [], { bookingIds: new Set<string>(), applicationIds: new Set<string>() }];

  return (
    <AccountShell role="organizer">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{totalCount} events created</p>
        <Button asChild className="h-10 rounded-[6px]">
          <Link href="/organizer/create">Create new Event</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex flex-col gap-3 rounded-md bg-muted p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-foreground">{event.name}</span>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-medium", statusStyles[event.status])}>
                    {statusLabels[event.status]}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    {formatEventDay(event.event_date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {event.venue}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    {event.filled_slots} {event.filled_slots === 1 ? "talent" : "talents"} booked
                  </span>
                </div>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {formatBudget(event.budget_min_vnd, event.budget_max_vnd)}
              </span>
            </div>

            <EventApplicationsPanel
              applications={applications.filter((a) => a.event_id === event.id)}
              reviewedApplicationIds={reviewed.applicationIds}
            />
          </div>
        ))}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPagesFor(totalCount, ACCOUNT_LIST_PAGE_SIZE)}
        makeHref={(p) => `/organizer/account/events?page=${p}`}
      />
    </AccountShell>
  );
}
