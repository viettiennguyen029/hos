import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { CardCarousel } from "@/components/shell/card-carousel";
import { EventListingCard, EventListingRow } from "@/components/shell/event-listing-card";
import { PromoCard } from "@/components/shell/promo-card";
import { listEventListings } from "@/lib/supabase/events";
import type { Role } from "@/lib/nav-items";

export async function EventHomeContent({ role }: { role: Role }) {
  const listings = await listEventListings(10);
  const upcoming = listings.slice(0, 4);
  const recent = listings.slice(4);

  return (
    <div className="flex flex-col gap-14 py-8">
      <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
        <ImageIcon className="size-10" />
      </div>

      <CardCarousel title="Hot Up-Coming Events" viewAllHref={`/${role}/discover`}>
        {upcoming.map((item) => (
          <EventListingCard key={item.id} data={item} href={`/${role}/events/${item.slug}`} />
        ))}
      </CardCarousel>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[606px_1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium tracking-[-0.03em] text-foreground">Recently Added</h2>
            <Link href={`/${role}/discover`} className="text-sm font-medium text-muted-foreground">
              View All
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {recent.map((item) => (
              <EventListingRow key={item.id} data={item} href={`/${role}/events/${item.slug}`} />
            ))}
          </div>
        </div>
        <PromoCard
          imageBackground
          title="Let's become our Talent"
          ctaLabel="Post a Job"
          ctaHref={`/${role}/create`}
        />
      </section>
    </div>
  );
}
