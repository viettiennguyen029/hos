"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, ImageIcon, Link as LinkIcon } from "lucide-react";
import { CardCarousel } from "@/components/shell/card-carousel";
import { ListingCard } from "@/components/shell/listing-card";
import { BookingPanel } from "@/components/talent-detail/booking-panel";
import { RatingReviewCard } from "@/components/talent-detail/rating-review-card";
import { RequestQuoteDialog } from "@/components/talent-detail/request-quote-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TalentReviewSummary } from "@/lib/supabase/reviews";
import type {
  BusySlot,
  LookupOption,
  PackageWithLookupNames,
  PackageWithTalent,
  ProfileWithLookupNames,
} from "@/lib/supabase/types";

const TABS = ["Overview", "Schedules", "Reviews", "About Talent"] as const;
type Tab = (typeof TABS)[number];

export function TalentDetailContent({
  talent,
  packages,
  relatedPackages,
  reviewSummary,
  cities,
  busySlots,
}: {
  talent: ProfileWithLookupNames;
  packages: PackageWithLookupNames[];
  relatedPackages: PackageWithTalent[];
  reviewSummary: TalentReviewSummary;
  cities: LookupOption[];
  busySlots: BusySlot[];
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  // Tagline/category have no real schema yet — kept as generic mock flavor
  // text alongside the real name/bio/packages/reviews/media/social data.
  const categoryLabel = [...new Set(packages.map((pkg) => pkg.category_name))].join(", ");
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingBusySlots = busySlots
    .filter((slot) => slot.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const overviewTitle = packages.find((pkg) => pkg.description?.trim())?.description?.trim();

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="relative flex h-[280px] w-full flex-col justify-end overflow-hidden rounded-md">
        {talent.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={talent.cover_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
            <ImageIcon className="size-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="relative flex flex-col gap-1 p-8">
          <h1 className="text-4xl font-bold tracking-[-0.03em] text-white">{talent.full_name}</h1>
          {(categoryLabel || talent.genre_name) && (
            <span className="text-sm text-white/60">{categoryLabel || talent.genre_name}</span>
          )}
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
              <RatingReviewCard
                avgRating={reviewSummary.avgRating}
                count={reviewSummary.count}
                reviews={reviewSummary.reviews}
              />

              {overviewTitle && (
                <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
                  {overviewTitle}
                </h2>
              )}

              <div className="flex flex-col gap-3">
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                  {talent.gallery_urls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={talent.gallery_urls[0]} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-10" />
                  )}
                </div>
                {talent.gallery_urls.length > 1 && (
                  <div className="grid grid-cols-3 gap-3">
                    {talent.gallery_urls.slice(1, 4).map((url) => (
                      <div
                        key={url}
                        className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="size-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {talent.bio ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{talent.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground">This talent has not added a bio yet.</p>
              )}

              {talent.keywords.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-xl font-bold tracking-[-0.03em] text-foreground">Keyword</h3>
                  <div className="flex flex-wrap gap-2">
                    {talent.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full bg-muted px-4 py-2 text-sm text-foreground"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {talent.services.length > 0 && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-xl font-bold tracking-[-0.03em] text-foreground">
                    Service Provided
                  </h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-md bg-muted p-6">
                    {talent.services.map((service, index) => (
                      <div key={`${service}-${index}`} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
                        <span className="text-sm text-foreground">{service}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {relatedPackages.length > 0 && (
                <CardCarousel title="More Related Talents" viewAllHref="/organizer/discover">
                  {relatedPackages.map((pkg) => (
                    <ListingCard
                      key={pkg.id}
                      data={{
                        id: pkg.id,
                        title: pkg.talent_name,
                        category: pkg.subcategory_name
                          ? `${pkg.category_name} / ${pkg.subcategory_name}`
                          : pkg.category_name,
                        avatarUrl: pkg.talent_avatar_url,
                        priceMin: pkg.price_min_vnd,
                        priceMax: pkg.price_max_vnd,
                        currency: "VND",
                      }}
                      href={`/organizer/talents/${pkg.talent_slug}`}
                    />
                  ))}
                </CardCarousel>
              )}
            </>
          )}

          {tab === "Schedules" && (
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-bold tracking-[-0.03em] text-foreground">
                Already Booked
              </h2>
              <p className="text-sm text-muted-foreground">
                {talent.full_name}&rsquo;s confirmed engagements — avoid booking a colliding time.
              </p>
              {upcomingBusySlots.length === 0 && (
                <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                  No upcoming bookings on record.
                </p>
              )}
              {upcomingBusySlots.map((slot, i) => (
                <div
                  key={`${slot.date}-${slot.startTime}-${i}`}
                  className="flex items-center justify-between rounded-md bg-muted p-4"
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays className="size-5 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{slot.date}</span>
                      <span className="text-xs text-muted-foreground">
                        {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    Booked
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === "Reviews" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-bold tracking-[-0.03em] text-foreground">
                {reviewSummary.count} Review{reviewSummary.count === 1 ? "" : "s"}
              </h2>
              {reviewSummary.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                reviewSummary.reviews.map((review) => (
                  <div key={review.id} className="flex flex-col gap-2 rounded-md bg-muted p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                          {review.reviewer_name
                            .split(" ")
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <span className="text-sm font-medium text-foreground">{review.reviewer_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString("en-US")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{review.comment || "No comment left."}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "About Talent" && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <h2 className="text-xl font-bold tracking-[-0.03em] text-foreground">
                  About {talent.full_name}
                </h2>
                {talent.bio ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">{talent.bio}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">This talent has not added a bio yet.</p>
                )}
                {talent.social_links.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {talent.social_links.map((link) => (
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
                <div className="flex flex-wrap gap-8">
                  {talent.city_name && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase text-muted-foreground">Location</span>
                      <span className="text-sm text-foreground">{talent.city_name}</span>
                    </div>
                  )}
                  {talent.date_of_birth && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase text-muted-foreground">DOB</span>
                      <span className="text-sm text-foreground">
                        {new Date(`${talent.date_of_birth}T00:00:00`).toLocaleDateString("en-US", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {talent.genre_name && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase text-muted-foreground">Genre</span>
                      <span className="text-sm text-foreground">{talent.genre_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {talent.services.length > 0 && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-xl font-bold tracking-[-0.03em] text-foreground">
                    Service Provided
                  </h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-md bg-muted p-6">
                    {talent.services.map((service, index) => (
                      <div key={`${service}-${index}`} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
                        <span className="text-sm text-foreground">{service}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {talent.achievements.length > 0 && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-xl font-bold tracking-[-0.03em] text-foreground">Achievement</h3>
                  <div className="flex flex-col gap-3 rounded-md bg-muted p-6">
                    {talent.achievements.map((item, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex h-fit w-[380px] shrink-0 flex-col gap-4">
          <BookingPanel talentName={talent.full_name} packages={packages} cities={cities} busySlots={busySlots} />
          <RequestQuoteDialog talentId={talent.id} talentName={talent.full_name} cities={cities} />
        </div>
      </div>
    </div>
  );
}
