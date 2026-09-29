"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { CreatePackageDialog } from "@/components/create-package/create-package-dialog";
import { FilterPill } from "@/components/shell/filter-pill";
import { PriceRangeFilter, PRICE_FILTER_MAX } from "@/components/shell/price-range-filter";
import { TimeRangeFilter, type DateRange } from "@/components/shell/time-range-filter";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { mockPackages } from "@/lib/mock-account";
import { deletePackage } from "@/lib/supabase/package-actions";
import type { Role } from "@/lib/nav-items";
import type { CategoryOption, LookupOption, PackageRow } from "@/lib/supabase/types";
import { runAction } from "@/lib/toast-action";

const statusStyles: Record<string, string> = {
  Active: "text-green-500",
  Closed: "text-destructive",
};

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

interface DisplayPackage {
  id: string;
  name: string;
  bookingCount: number;
  priceRange: string;
  status: "Active" | "Closed";
}

export function PackagesContent({
  role,
  packages,
  categories,
  cities,
  currentPage,
  totalPages,
}: {
  role: Role;
  packages?: (PackageRow & { bookingCount: number })[];
  categories: CategoryOption[];
  cities: LookupOption[];
  currentPage?: number;
  totalPages?: number;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [location, setLocation] = useState(cities[0]?.name ?? "");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, PRICE_FILTER_MAX]);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [editingPackage, setEditingPackage] = useState<PackageRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this package? This can't be undone.")) return;
    setDeleteError(null);
    setDeletingId(id);
    const result = await runAction(deletePackage(id), { success: "Package deleted." });
    setDeletingId(null);
    if ("error" in result) {
      setDeleteError(result.error);
      return;
    }
    router.refresh();
  }

  const rows: DisplayPackage[] = packages
    ? packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.title,
        bookingCount: pkg.bookingCount,
        priceRange: `${formatVnd(pkg.price_min_vnd)} - ${formatVnd(pkg.price_max_vnd)}`,
        status: pkg.status === "active" ? "Active" : "Closed",
      }))
    : mockPackages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        bookingCount: pkg.bookingCount,
        priceRange: pkg.priceRange,
        status: pkg.status,
      }));

  const packageById = new Map((packages ?? []).map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <FilterPill
            label="Category"
            value={category}
            onChange={setCategory}
            options={["All", ...categories.map((c) => c.name)]}
          />
          <FilterPill label="Location" value={location} onChange={setLocation} options={cities.map((c) => c.name)} />
          <PriceRangeFilter range={priceRange} onChange={setPriceRange} />
          <TimeRangeFilter range={dateRange} onChange={setDateRange} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-input px-4 py-2.5">
            <Search className="size-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by package, location..."
              className="w-56 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button onClick={() => setCreateOpen(true)} className="h-10 shrink-0 rounded-[6px]">
            <Plus className="size-4" />
            Create new Package
          </Button>
          <CreatePackageDialog
            key={createOpen ? "create-open" : "create-closed"}
            role={role}
            open={createOpen}
            onOpenChange={setCreateOpen}
            categories={categories}
            cities={cities}
          />
          <CreatePackageDialog
            key={editingPackage ? editingPackage.id : "edit-closed"}
            role={role}
            open={editingPackage !== null}
            onOpenChange={(open) => {
              if (!open) {
                setEditingPackage(null);
                router.refresh();
              }
            }}
            editingPackage={editingPackage ?? undefined}
            categories={categories}
            cities={cities}
          />
        </div>
      </div>

      {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

      <div className="overflow-hidden rounded-md bg-muted">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Package name</TableHead>
              <TableHead>Bookings Count</TableHead>
              <TableHead>Price Range</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((pkg) => (
              <TableRow key={pkg.id} className="hover:bg-transparent">
                <TableCell className="font-medium text-foreground">{pkg.name}</TableCell>
                <TableCell>{pkg.bookingCount} Booked</TableCell>
                <TableCell>{pkg.priceRange}</TableCell>
                <TableCell>
                  <span className={cn("font-medium", statusStyles[pkg.status])}>{pkg.status}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={!packageById.has(pkg.id)}
                      onClick={() => setEditingPackage(packageById.get(pkg.id) ?? null)}
                      className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete package"
                      disabled={!packageById.has(pkg.id) || deletingId === pkg.id}
                      onClick={() => handleDelete(pkg.id)}
                      className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {currentPage !== undefined && totalPages !== undefined && (
        <Pagination currentPage={currentPage} totalPages={totalPages} makeHref={(page) => `/${role}/account/packages?page=${page}`} />
      )}
    </div>
  );
}
