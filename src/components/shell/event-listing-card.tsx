import Link from "next/link";
import { ArrowRight, ImageIcon } from "lucide-react";
import { formatEventDay, formatTimeRange } from "@/lib/format";
import type { EventListingSummary } from "@/lib/supabase/types";

function JobsBadge({ data }: { data: EventListingSummary }) {
  return (
    <span className="rounded-full bg-black/50 px-2.5 py-1.5 text-xs font-medium text-white">
      {String(data.filled_slots).padStart(2, "0")}/{data.total_slots} Jobs Offered
    </span>
  );
}

export function EventListingCard({ data, href }: { data: EventListingSummary; href?: string }) {
  const content = (
    <>
      <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
        {data.photo_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.photo_urls[0]} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-8" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />

      <div className="relative m-3 self-start">
        <JobsBadge data={data} />
      </div>

      <div className="relative flex flex-col gap-2 p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-bold tracking-[-0.03em] text-white">{data.name}</span>
          <span className="text-sm text-white/60">{data.venue}</span>
          <span className="text-xs text-white/50">{data.address}</span>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-[8px] bg-black/40 px-3 py-2 transition-colors group-hover:bg-white">
          <div className="flex flex-col gap-1 text-xs">
            <span>
              <span className="text-white/50 group-hover:text-black/50">DAY </span>
              <span className="font-medium text-white group-hover:text-black">
                {formatEventDay(data.event_date)}
              </span>
            </span>
            <span>
              <span className="text-white/50 group-hover:text-black/50">TIME </span>
              <span className="font-medium text-white group-hover:text-black">
                {formatTimeRange(data.start_time, data.end_time)}
              </span>
            </span>
          </div>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-white opacity-0 transition-opacity group-hover:bg-black group-hover:text-white group-hover:opacity-100">
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </>
  );

  const className =
    "group relative flex h-[420px] w-[289px] shrink-0 flex-col justify-between overflow-hidden rounded-md bg-muted";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

export function EventListingRow({ data, href }: { data: EventListingSummary; href?: string }) {
  const content = (
    <>
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
        {data.photo_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.photo_urls[0]} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-5" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{data.name}</span>
        <span className="truncate text-xs text-muted-foreground">{data.venue}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
        <span className="text-foreground">{formatEventDay(data.event_date)}</span>
        <span className="text-muted-foreground">{formatTimeRange(data.start_time, data.end_time)}</span>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground">
        {String(data.filled_slots).padStart(2, "0")}/{data.total_slots} Jobs Offered
      </span>
    </>
  );

  const className = "flex h-[76px] w-full items-center gap-4 rounded-md bg-muted px-3";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
