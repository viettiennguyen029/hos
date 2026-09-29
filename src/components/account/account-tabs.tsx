"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAccountNavItems } from "@/lib/account-nav";
import type { Role } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

export function AccountTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = getAccountNavItems(role);

  // A nested route (e.g. an order's detail page under My Orders) should
  // keep its parent tab highlighted — but "My Profile" (the account base
  // path) is itself a string prefix of every other tab's href, so match
  // the single MOST SPECIFIC (longest) href rather than any prefix match.
  const activeHref = items.reduce<string | null>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) return best;
    if (!best || item.href.length > best.length) return item.href;
    return best;
  }, null);

  return (
    <div className="scrollbar-hide flex gap-3 overflow-x-auto">
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-[8px] px-6 py-3 text-sm font-medium tracking-[-0.03em] transition-colors",
              active ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-accent"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
