import Link from "next/link";
import { ArrowRight, ImageIcon, Star } from "lucide-react";

export interface ListingCardData {
  id: string;
  title: string;
  category: string;
  avatarUrl?: string | null;
  /** Omitted when there's no real rating data yet (ratings/reviews aren't modeled). */
  rating?: number;
  reviewCount?: number;
  priceMin: number;
  priceMax: number;
  currency?: "USD" | "VND";
  priceUnit?: string;
}

export function formatPriceRange(min: number, max: number, currency: "USD" | "VND" = "USD") {
  if (currency === "VND") {
    return `${min.toLocaleString("en-US")} - ${max.toLocaleString("en-US")} VND`;
  }
  return `$ ${min.toLocaleString()} - ${max.toLocaleString()}`;
}

export function ListingCard({ data, href }: { data: ListingCardData; href?: string }) {
  const content = (
    <>
      {data.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.avatarUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <ImageIcon className="size-8" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />

      {data.rating !== undefined && (
        <div className="relative flex items-center gap-1 self-start rounded-full bg-black/50 px-2.5 py-1.5 text-xs font-medium text-white m-3">
          <Star className="size-3.5 fill-primary text-primary" />
          {data.rating.toFixed(1)}
          <span className="text-white/60">({data.reviewCount} Reviews)</span>
        </div>
      )}

      <div className="relative flex flex-col gap-0.5 p-4">
        <span className="text-xl font-bold tracking-[-0.03em] text-white">{data.title}</span>
        <span className="text-sm text-white/60">{data.category}</span>
        <span className="mt-2 text-base font-bold text-white">
          {formatPriceRange(data.priceMin, data.priceMax, data.currency)}
        </span>
        <span className="text-[10px] tracking-wide text-white/50 uppercase">
          {data.priceUnit ?? "Per Performance"}
        </span>
      </div>
    </>
  );

  const className =
    "relative flex h-[486px] w-[289px] shrink-0 flex-col justify-between overflow-hidden rounded-md bg-muted";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

/**
 * Search/results-grid card ("Organizer - Find Talents" screen) — distinct from
 * ListingCard: image + rating badge + name/category on top, separate white
 * price panel with an arrow button underneath.
 */
export function SearchResultCard({ data, href }: { data: ListingCardData; href?: string }) {
  const content = (
    <>
      <div className="relative flex h-[389px] flex-col justify-between overflow-hidden">
        {data.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.avatarUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        {data.rating !== undefined && (
          <div className="relative m-3 flex items-center gap-1 self-start rounded-full bg-black/50 px-2.5 py-1.5 text-xs font-medium text-white">
            <Star className="size-3.5 fill-primary text-primary" />
            {data.rating.toFixed(1)}
            <span className="text-white/60">({data.reviewCount} Reviews)</span>
          </div>
        )}

        <div className="relative flex flex-col gap-0.5 p-4">
          <span className="text-xl font-bold tracking-[-0.03em] text-white">{data.title}</span>
          <span className="text-sm text-white/60">{data.category}</span>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white px-4 py-3">
        <div className="flex flex-col">
          <span className="text-base font-bold text-black">
            {formatPriceRange(data.priceMin, data.priceMax, data.currency)}
          </span>
          <span className="text-[10px] tracking-wide text-black/50 uppercase">
            {data.priceUnit ?? "Per Performance"}
          </span>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black text-white">
          <ArrowRight className="size-4" />
        </span>
      </div>
    </>
  );

  const className = "flex w-[289px] shrink-0 flex-col overflow-hidden rounded-md";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function ImagePlaceholder({ className, avatarUrl }: { className?: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" className={`object-cover ${className ?? ""}`} />;
  }
  return (
    <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}>
      <ImageIcon className="size-6" />
    </div>
  );
}

/**
 * Placeholder for the compact list-row card ("Frame 106"–"Frame 111" instances,
 * unresolved due to MCP rate limit — verify against Figma once access is available).
 */
export function ListingRow({ data, href }: { data: ListingCardData; href?: string }) {
  const content = (
    <>
      <ImagePlaceholder className="size-[52px] shrink-0 rounded-[6px]" avatarUrl={data.avatarUrl} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{data.title}</span>
        <span className="truncate text-xs text-muted-foreground">{data.category}</span>
      </div>
      <span className="shrink-0 text-sm font-semibold text-foreground">
        {data.currency === "VND"
          ? `${data.priceMin.toLocaleString("en-US")}+ VND`
          : `$${data.priceMin.toLocaleString()}+`}
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
