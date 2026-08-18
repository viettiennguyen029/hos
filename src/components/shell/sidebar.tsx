"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Grid2x2, Headset, Home, Info, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { CreatePackageDialog } from "@/components/create-package/create-package-dialog";
import { SidebarLogo } from "@/components/shell/sidebar-logo";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
} from "@/components/shell/social-icons";
import { createEventCta, type Role } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import type { CategoryOption, KycStatus, LookupOption } from "@/lib/supabase/types";

export function Sidebar({
  role,
  kycStatus,
  categories,
  cities,
}: {
  role: Role;
  kycStatus: KycStatus;
  categories: CategoryOption[];
  cities: LookupOption[];
}) {
  const pathname = usePathname();
  const [categoryOpen, setCategoryOpen] = useState(role === "organizer");
  const [openSubcategory, setOpenSubcategory] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const isVerified = kycStatus === "verified";

  const isHome = pathname === `/${role}`;

  return (
    <aside className="scrollbar-hide sticky top-0 flex h-screen w-[310px] shrink-0 flex-col gap-8 overflow-y-auto border-r border-border px-6 py-8">
      <SidebarLogo href={`/${role}`} />

      {!isVerified ? (
        <Link
          href={`/${role}/kyc`}
          className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-[18px]" />
          Complete KYC to Continue
        </Link>
      ) : role === "organizer" ? (
        <Link
          href={`/${role}/create`}
          className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-[18px]" />
          {createEventCta[role]}
        </Link>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-[18px]" />
            {createEventCta[role]}
          </button>
          <CreatePackageDialog
            key={createOpen ? "create-open" : "create-closed"}
            role={role}
            open={createOpen}
            onOpenChange={setCreateOpen}
            categories={categories}
            cities={cities}
          />
        </>
      )}

      <nav className="flex flex-1 flex-col gap-1">
        <Link
          href={`/${role}`}
          className={cn(
            "relative flex items-center gap-3 rounded-[8px] px-4 py-3 text-sm font-medium tracking-[-0.03em] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground",
            isHome && "bg-primary/10 text-foreground"
          )}
        >
          <Home className={cn("size-5 shrink-0", isHome && "text-primary")} />
          <span className={cn(isHome && "font-semibold")}>Home</span>
          {isHome && (
            <span className="absolute right-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-l-full bg-primary" />
          )}
        </Link>

        {role === "organizer" && (
          <div className="mb-2 flex flex-col gap-1">
            <span className="px-4 pt-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Showcase
            </span>
            <Link
              href={`/${role}/ai-assistant`}
              className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-sm font-medium tracking-[-0.03em] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <Sparkles className="size-5 shrink-0" />
              <span className="flex-1">AI Talent Assistant</span>
            </Link>
            <Link
              href={`/${role}/smart-contract`}
              className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-sm font-medium tracking-[-0.03em] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <ShieldCheck className="size-5 shrink-0" />
              <span className="flex-1">Smart Contract Escrow</span>
            </Link>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCategoryOpen((open) => !open)}
          className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-sm font-medium tracking-[-0.03em] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <Grid2x2 className="size-5 shrink-0" />
          <span className="flex-1 text-left">Category</span>
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform", !categoryOpen && "-rotate-90")}
          />
        </button>

        {categoryOpen && (
          <div className="flex flex-col gap-1">
            {categories.map((category) => {
              const hasChildren = category.subcategories.length > 0;
              const isOpen = openSubcategory === category.id;
              return (
                <div key={category.id}>
                  <div className="flex w-full items-center gap-3 rounded-[8px] py-2.5 pl-8 pr-4 text-sm tracking-[-0.03em] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground">
                    <Link
                      href={`/${role}/discover?category=${encodeURIComponent(category.name)}`}
                      className="flex flex-1 items-center gap-3"
                    >
                      <span className="size-1.5 shrink-0 rounded-full bg-current" />
                      <span className="flex-1 text-left">{category.name}</span>
                    </Link>
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={() => setOpenSubcategory(isOpen ? null : category.id)}
                        aria-label={isOpen ? `Collapse ${category.name}` : `Expand ${category.name}`}
                        className="shrink-0"
                      >
                        {isOpen ? (
                          <ChevronDown className="size-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="size-3.5 shrink-0" />
                        )}
                      </button>
                    )}
                  </div>
                  {hasChildren && isOpen && (
                    <div className="flex flex-col gap-1">
                      {category.subcategories.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/${role}/discover?category=${encodeURIComponent(category.name)}&subcategory=${encodeURIComponent(sub.name)}`}
                          className="rounded-[8px] py-2 pl-14 pr-4 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 flex flex-col gap-1">
          <Link
            href={`/${role}/about`}
            className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-sm font-medium tracking-[-0.03em] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <Info className="size-5 shrink-0" />
            <span className="flex-1">About</span>
            <ChevronRight className="size-3.5 shrink-0" />
          </Link>
          <Link
            href={`/${role}/support`}
            className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-sm font-medium tracking-[-0.03em] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <Headset className="size-5 shrink-0" />
            <span className="flex-1">Support</span>
            <ChevronRight className="size-3.5 shrink-0" />
          </Link>
        </div>
      </nav>

      <footer className="flex flex-col gap-4 border-t border-border pt-5">
        <div className="flex items-center gap-3">
          {[FacebookIcon, TwitterIcon, InstagramIcon, LinkedinIcon].map((Icon, i) => (
            <span
              key={i}
              className="flex size-8 items-center justify-center rounded-full bg-white/5 text-foreground"
            >
              <Icon className="size-4" />
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Heart of Show Ltd. 2022</p>
      </footer>
    </aside>
  );
}
