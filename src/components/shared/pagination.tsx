import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPageNumbers } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export function Pagination({
  currentPage,
  totalPages,
  makeHref,
}: {
  currentPage: number;
  totalPages: number;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5">
      <PageLink page={currentPage - 1} makeHref={makeHref} disabled={currentPage === 1} aria-label="Previous page">
        <ChevronLeft className="size-4" />
      </PageLink>

      {getPageNumbers(currentPage, totalPages).map((page, i) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <PageLink key={page} page={page} makeHref={makeHref} current={page === currentPage}>
            {page}
          </PageLink>
        )
      )}

      <PageLink
        page={currentPage + 1}
        makeHref={makeHref}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  page,
  makeHref,
  current,
  disabled,
  children,
  "aria-label": ariaLabel,
}: {
  page: number;
  makeHref: (page: number) => string;
  current?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={makeHref(page)}
      aria-label={ariaLabel}
      aria-current={current ? "page" : undefined}
      aria-disabled={disabled ? "true" : undefined}
      tabIndex={disabled ? -1 : undefined}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[6px] text-sm font-medium transition-colors",
        current ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-accent",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      {children}
    </Link>
  );
}
