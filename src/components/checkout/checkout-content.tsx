"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { checkoutCart, removeFromCart } from "@/lib/supabase/package-actions";
import type { CartItemWithPackage } from "@/lib/supabase/types";
import { runAction } from "@/lib/toast-action";

function formatVnd(amount: number) {
  return `${amount.toLocaleString("en-US")} VND`;
}

export function CheckoutContent({ cartItems }: { cartItems: CartItemWithPackage[] }) {
  const router = useRouter();
  const groups = useMemo(() => {
    const byTalent = new Map<string, { talentName: string; items: CartItemWithPackage[] }>();
    for (const item of cartItems) {
      const g = byTalent.get(item.talent.id) ?? { talentName: item.talent.full_name, items: [] };
      g.items.push(item);
      byTalent.set(item.talent.id, g);
    }
    return [...byTalent.values()];
  }, [cartItems]);

  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(cartItems.map((i) => [i.id, true]))
  );
  const [paymentChannel, setPaymentChannel] = useState<"fiat" | "crypto">("fiat");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  function toggleItem(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleGroup(groupItemIds: string[], nextValue: boolean) {
    setChecked((prev) => {
      const next = { ...prev };
      groupItemIds.forEach((id) => (next[id] = nextValue));
      return next;
    });
  }

  async function handleRemove(id: string) {
    const result = await runAction(removeFromCart(id), { success: "Removed from cart." });
    if ("error" in result) return;
    router.refresh();
  }

  const groupTotals = groups.map((group) => ({
    ...group,
    total: group.items.reduce((sum, item) => sum + (checked[item.id] ? item.price_vnd : 0), 0),
    includedItems: group.items.filter((item) => checked[item.id]),
  }));

  const paymentTotal = groupTotals.reduce((sum, g) => sum + g.total, 0);

  async function handleSubmit() {
    setError(undefined);
    setPending(true);
    const formData = new FormData();
    formData.set("paymentChannel", paymentChannel);
    for (const id of Object.keys(checked).filter((id) => checked[id])) {
      formData.append("itemIds", id);
    }
    const result = await runAction(checkoutCart(formData), { success: "Booking request sent." });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSent(true);
    router.refresh();
  }

  if (sent) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="flex w-full max-w-[460px] flex-col items-center gap-5 rounded-md bg-white/5 p-10 text-center">
          <CheckCircle2 className="size-12 text-green-500" />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
              Booking Request Sent!
            </h1>
            <p className="text-sm text-muted-foreground">
              The talent will review your request. Track its status under My Orders.
            </p>
          </div>
          <Button asChild className="h-11 w-full rounded-[6px]">
            <a href="/organizer/account/orders">View My Orders</a>
          </Button>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col gap-1 py-8">
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground">Check Out</h1>
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground">Check Out</h1>
        <p className="text-sm text-muted-foreground">Review your booking details before sending</p>
      </div>

      <div className="flex gap-8">
        <div className="flex min-w-0 flex-1 flex-col divide-y divide-border rounded-md bg-white/5">
          {groups.map((group) => {
            const groupItemIds = group.items.map((i) => i.id);
            const checkedCount = groupItemIds.filter((id) => checked[id]).length;
            const groupChecked =
              checkedCount === 0 ? false : checkedCount === groupItemIds.length ? true : "indeterminate";

            return (
              <div key={group.talentName} className="flex flex-col">
                <div className="flex items-center gap-3 px-6 py-4">
                  <Checkbox
                    checked={groupChecked}
                    onCheckedChange={(v) => toggleGroup(groupItemIds, v === true)}
                  />
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-foreground">
                    <User className="size-4" />
                  </div>
                  <span className="flex-1 text-base font-semibold text-foreground">
                    {group.talentName}
                  </span>
                </div>

                {group.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-6 py-4 pl-14">
                    <Checkbox
                      checked={!!checked[item.id]}
                      onCheckedChange={() => toggleItem(item.id)}
                      className="mt-1"
                    />
                    <div className="flex flex-1 flex-col gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {group.talentName} - {item.package.title}
                      </span>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-col gap-0.5 text-sm">
                          <span className="text-foreground">{item.package.city_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-foreground">
                            {item.booked_date ?? "Choose Date"}
                          </span>
                          <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-foreground">
                            {item.booked_time ?? "Choose Time"}
                          </span>
                          <span className="w-[160px] shrink-0 text-right text-sm font-semibold text-foreground">
                            {formatVnd(item.price_vnd)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove item"
                      onClick={() => handleRemove(item.id)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-muted-foreground hover:bg-white/10"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <aside className="flex h-fit w-[400px] shrink-0 flex-col gap-5 rounded-md bg-white/5 p-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold tracking-[-0.03em] text-foreground">Payment Method</h2>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: "fiat" as const, label: "Fiat Payment" },
                  { value: "crypto" as const, label: "Crypto Payment" },
                ]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentChannel(value)}
                  className={cn(
                    "flex items-center gap-2 rounded-[8px] border border-transparent bg-white/5 px-4 py-3 text-sm font-medium text-foreground transition-colors",
                    paymentChannel === value && "border-primary bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      paymentChannel === value ? "border-primary" : "border-white/30"
                    )}
                  >
                    {paymentChannel === value && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold tracking-[-0.03em] text-foreground">Order Detail</h2>
            <div className="flex flex-col gap-4 rounded-[8px] bg-white/5 p-5">
              {groupTotals.map((group, i) => (
                <div key={group.talentName}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>{group.talentName}</span>
                    <span>{formatVnd(group.total)}</span>
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {group.includedItems.map((item) => (
                      <span key={item.id} className="text-xs text-muted-foreground">
                        x1 {item.package.title}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-base font-semibold text-foreground">Payment Total</span>
              <span className="text-lg font-bold text-foreground">{formatVnd(paymentTotal)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            disabled={pending}
            onClick={handleSubmit}
            className="h-[52px] w-full rounded-[6px] text-base font-semibold"
          >
            {pending ? "Sending..." : "Send Booking Request"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
