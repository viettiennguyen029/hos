"use client";

import { useState } from "react";
import { ImageIcon, Link as LinkIcon, MapPin } from "lucide-react";
import { ApplyPanel } from "@/components/event-detail/apply-panel";
import { CardCarousel } from "@/components/shell/card-carousel";
import { EventListingCard } from "@/components/shell/event-listing-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatEventDay, formatTimeRange } from "@/lib/format";
import type { EventListingSummary, EventWithSlots } from "@/lib/supabase/types";
import type { Role } from "@/lib/nav-items";

const TABS = ["Overview", "About Organizer"] as const;
type Tab = (typeof TABS)[number];

export function EventDetailContent({
  role,
  event,
  moreEvents,
}: {
  role: Role;
  event: EventWithSlots;
  moreEvents: EventListingSummary[];
}) {
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="relative flex h-[280px] w-full flex-col justify-end overflow-hidden rounded-md">
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
          {event.photo_urls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.photo_urls[0]} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-10" />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="relative flex flex-col gap-2 p-8">
          <h1 className="text-4xl font-bold tracking-[-0.03em] text-white">{event.name}</h1>
          <span className="text-sm text-white/60">
            {event.venue} &middot; {event.address}
          </span>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white">
              DAY <span className="font-semibold">{formatEventDay(event.event_date)}</span>
            </span>
            <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white">
              TIME <span className="font-semibold">{formatTimeRange(event.start_time, event.end_time)}</span>
            </span>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="h-auto w-fit gap-3 rounded-none bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-[8px] border-none bg-muted px-6 py-3 text-sm font-medium text-foreground shadow-none data-active:bg-foreground data-active:text-background dark:data-active:bg-foreground dark:data-active:text-background"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          {tab === "Overview" && (
            <>
              {event.tagline && (
                <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">{event.tagline}</h2>
              )}

              <div className="flex flex-col gap-3">
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                  {event.photo_urls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.photo_urls[0]}
                      alt={`${event.name} photo 1`}
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="size-10" />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground"
                    >
                      {event.photo_urls[i] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.photo_urls[i]}
                          alt={`${event.name} photo ${i + 1}`}
                          className="size-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-6" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {event.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">{event.description}</p>
              )}

              <CardCarousel title="More Upcoming Events" viewAllHref={`/${role}/discover`}>
                {moreEvents.map((item) => (
                  <EventListingCard key={item.id} data={item} href={`/${role}/events/${item.slug}`} />
                ))}
              </CardCarousel>
            </>
          )}

          {tab === "About Organizer" && (
            <div className="flex gap-6">
              <div className="aspect-square w-[220px] shrink-0 overflow-hidden rounded-md bg-muted">
                {event.organizer.gallery_urls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={event.organizer.gallery_urls[0]} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-8" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-4">
                <h2 className="text-xl font-bold tracking-[-0.03em] text-foreground">
                  {event.organizer.full_name || "Organizer"}
                </h2>
                <div className="flex flex-col gap-3 rounded-md bg-muted p-5">
                  {event.organizer.city_name && (
                    <div className="flex items-center gap-3 text-sm text-foreground">
                      <MapPin className="size-4 shrink-0 text-muted-foreground" />
                      {event.organizer.city_name}
                    </div>
                  )}
                  {event.contact_phone && (
                    <div className="text-sm text-muted-foreground">Contact: {event.contact_phone}</div>
                  )}
                </div>
                {event.organizer.bio && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{event.organizer.bio}</p>
                )}
                {event.organizer.social_links.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {event.organizer.social_links.map((link) => (
                      <a
                        key={`${link.platform}-${link.url}`}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-foreground hover:bg-accent"
                      >
                        <LinkIcon className="size-4" />
                        {link.platform}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <ApplyPanel event={event} role={role} />
      </div>
    </div>
  );
}
