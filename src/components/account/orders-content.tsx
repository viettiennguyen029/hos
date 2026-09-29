"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockOrders } from "@/lib/mock-account";
import { ReviewDialog } from "@/components/shared/review-dialog";
import { Pagination } from "@/components/shared/pagination";
import type { BookingWithNames } from "@/lib/supabase/types";
import type { Role } from "@/lib/nav-items";

const todayIso = () => new Date().toISOString().slice(0, 10);
const SEARCH_DEBOUNCE_MS = 400;

const statusStyles: Record<string, string> = {
  Pending: "bg-amber-500/10 text-amber-500",
  Dealing: "bg-amber-500/10 text-amber-500",
  Confirmed: "bg-blue-500/10 text-blue-400",
  Completed: "bg-green-500/10 text-green-500",
  Cancelled: "bg-muted text-muted-foreground",
};

const SUB_FILTERS = ["All", "Upcoming", "Pending", "Dealing", "Confirmed", "Completed", "Cancelled"];

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface DisplayOrder {
  id: string;
  fullId?: string;
  counterpartName: string;
  packageName: string;
  date: string;
  price: string;
  status: string;
  rawStatus?: string;
  bookedDate?: string | null;
}

export function OrdersContent({
  role,
  bookings,
  reviewedBookingIds,
  currentPage,
  totalPages,
}: {
  role: Role;
  bookings?: BookingWithNames[];
  reviewedBookingIds?: Set<string>;
  currentPage?: number;
  totalPages?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Status/search now live in the URL (not local state) — real pagination
  // needs them applied server-side (see searchBookingsForRole), and a
  // sidebar/bookmark round trip re-resolves them the same way Discover's
  // category/subcategory do.
  const activeFilter = searchParams.get("status") ?? SUB_FILTERS[0];
  const urlSearch = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [reviewTarget, setReviewTarget] = useState<{ id: string; talentName: string } | null>(null);
  const counterpartLabel = role === "organizer" ? "Talent" : "Organizer";
  const isOrganizer = role === "organizer";

  const orders: DisplayOrder[] = bookings
    ? bookings.map((b) => ({
        id: b.id.slice(0, 8).toUpperCase(),
        fullId: b.id,
        counterpartName: role === "organizer" ? b.talent_name : b.organizer_name,
        packageName: b.package_title,
        date: b.booked_date ?? "Flexible",
        price: formatVnd(b.price_vnd),
        status: capitalize(b.status),
        rawStatus: b.status,
        bookedDate: b.booked_date,
      }))
    : mockOrders.map((o) => ({
        id: o.id,
        counterpartName: o.talentName,
        packageName: o.packageName,
        date: o.date,
        price: o.priceVnd,
        status: o.status,
      }));

  function navigate(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleFilterChange(filter: string) {
    navigate({ status: filter === SUB_FILTERS[0] ? null : filter, page: null });
  }

  // Debounce the search box so typing doesn't navigate on every keystroke —
  // same rationale as Discover's filter debounce, just via URL nav instead
  // of a fetch call.
  useEffect(() => {
    if (searchInput === urlSearch) return;
    const timer = setTimeout(() => navigate({ q: searchInput || null, page: null }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const hasActiveFilters = activeFilter !== SUB_FILTERS[0] || urlSearch !== "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="scrollbar-hide flex gap-2 overflow-x-auto">
          {SUB_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => handleFilterChange(filter)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                activeFilter === filter
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-input px-4 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or order ID..."
            className="w-56 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-md bg-muted">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 border-b border-border px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <span>Order</span>
          <span>{counterpartLabel}</span>
          <span>Date</span>
          <span>Price</span>
          <span>Status</span>
        </div>
        {orders.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            {hasActiveFilters ? "No orders match your filters." : "No orders yet."}
          </p>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-border px-5 py-4 text-sm last:border-b-0"
            >
              <span className="text-muted-foreground">{order.id}</span>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{order.counterpartName}</span>
                <span className="text-xs text-muted-foreground">{order.packageName}</span>
              </div>
              <span className="text-foreground">{order.date}</span>
              <span className="font-semibold text-foreground">{order.price}</span>
              <div className="flex items-center gap-2">
                <span
                  className={cn("w-fit rounded-full px-3 py-1 text-xs font-medium", statusStyles[order.status])}
                >
                  {order.status}
                </span>
                {order.fullId && (
                  <Link
                    href={`/${role}/account/orders/${order.fullId}`}
                    aria-label="View order details"
                    className="flex size-8 shrink-0 items-center justify-center rounded-[6px] bg-muted text-foreground hover:bg-accent"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                )}
                {isOrganizer &&
                  order.fullId &&
                  order.rawStatus === "confirmed" &&
                  order.bookedDate &&
                  order.bookedDate < todayIso() &&
                  !reviewedBookingIds?.has(order.fullId) && (
                    <button
                      type="button"
                      onClick={() => setReviewTarget({ id: order.fullId!, talentName: order.counterpartName })}
                      className="rounded-[6px] bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      Leave a Review
                    </button>
                  )}
              </div>
            </div>
          ))
        )}
      </div>

      {currentPage !== undefined && totalPages !== undefined && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          makeHref={(page) => {
            const params = new URLSearchParams(searchParams.toString());
            if (page <= 1) params.delete("page");
            else params.set("page", String(page));
            const qs = params.toString();
            return qs ? `${pathname}?${qs}` : pathname;
          }}
        />
      )}

      {reviewTarget && (
        <ReviewDialog
          open={reviewTarget !== null}
          onOpenChange={(open) => {
            if (!open) setReviewTarget(null);
          }}
          sourceType="booking"
          sourceId={reviewTarget.id}
          talentName={reviewTarget.talentName}
          onSubmitted={() => router.refresh()}
        />
      )}
    </div>
  );
}
