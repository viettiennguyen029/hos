import Link from "next/link";
import { AiFlowBanner } from "@/components/shell/ai-flow-banner";
import { CardCarousel } from "@/components/shell/card-carousel";
import { ListingCard, ListingRow } from "@/components/shell/listing-card";
import { PromoCard } from "@/components/shell/promo-card";
import {
  listEditorChoicePackages,
  listMostPopularPackages,
  listRecentPackages,
} from "@/lib/supabase/packages";
import type { PackageWithTalent } from "@/lib/supabase/types";
import type { Role } from "@/lib/nav-items";

export function toCardData(pkg: PackageWithTalent) {
  return {
    id: pkg.id,
    title: pkg.talent_name,
    category: pkg.subcategory_name ? `${pkg.category_name} · ${pkg.subcategory_name}` : pkg.category_name,
    avatarUrl: pkg.talent_avatar_url,
    priceMin: pkg.price_min_vnd,
    priceMax: pkg.price_max_vnd,
    currency: "VND" as const,
  };
}

// HomeContent is only ever rendered for role="organizer" — talent/agency use
// EventHomeContent instead, which is wired to real event data.
export async function HomeContent({ role }: { role: Role }) {
  const [mostPopular, editorChoice, recent] = await Promise.all([
    listMostPopularPackages(10),
    listEditorChoicePackages(10),
    listRecentPackages(6),
  ]);

  return (
    <div className="flex flex-col gap-14 py-8">
      <AiFlowBanner />

      {mostPopular.length > 0 && (
        <CardCarousel title="Most Popular Talents in Heart of Show" viewAllHref={`/${role}/discover`}>
          {mostPopular.map((pkg) => (
            <ListingCard key={pkg.id} data={toCardData(pkg)} href={`/${role}/talents/${pkg.talent_slug}`} />
          ))}
        </CardCarousel>
      )}

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[606px_1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium tracking-[-0.03em] text-foreground">Recently Added</h2>
            <Link href={`/${role}/discover`} className="text-sm font-medium text-muted-foreground">
              View All
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No packages yet.</p>
            ) : (
              recent.map((pkg) => (
                <ListingRow key={pkg.id} data={toCardData(pkg)} href={`/${role}/talents/${pkg.talent_slug}`} />
              ))
            )}
          </div>
        </div>
        <PromoCard
          title="Are you looking for Talent for your Event?"
          ctaLabel="Create new Event"
          ctaHref="/organizer/create"
        />
      </section>

      {editorChoice.length > 0 && (
        <CardCarousel title="Editor Choice" viewAllHref={`/${role}/discover`}>
          {editorChoice.map((pkg) => (
            <ListingCard
              key={`editor-${pkg.id}`}
              data={toCardData(pkg)}
              href={`/${role}/talents/${pkg.talent_slug}`}
            />
          ))}
        </CardCarousel>
      )}
    </div>
  );
}
