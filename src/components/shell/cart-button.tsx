"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { removeFromCart } from "@/lib/supabase/package-actions";
import type { CartItemWithPackage } from "@/lib/supabase/types";
import type { Role } from "@/lib/nav-items";
import { runAction } from "@/lib/toast-action";

function formatVnd(n: number) {
  return `${n.toLocaleString("en-US")} VND`;
}

export function CartButton({ role, cartItems = [] }: { role: Role; cartItems?: CartItemWithPackage[] }) {
  const router = useRouter();

  const groups = new Map<string, { talentName: string; items: CartItemWithPackage[] }>();
  for (const item of cartItems) {
    const key = item.talent.id;
    const group = groups.get(key) ?? { talentName: item.talent.full_name, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  const groupList = [...groups.values()];
  const count = cartItems.length;

  async function handleRemove(itemId: string) {
    const result = await runAction(removeFromCart(itemId), { success: "Removed from cart." });
    if ("error" in result) return;
    router.refresh();
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Cart"
          className="relative flex size-[46px] shrink-0 items-center justify-center rounded-full bg-muted transition-colors hover:bg-accent"
        >
          <ShoppingCart className="size-[22px] text-foreground" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        {groupList.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Your cart is empty.</p>
        ) : (
          <div className="flex max-h-[400px] flex-col divide-y divide-border overflow-y-auto">
            {groupList.map((group) => {
              const total = group.items.reduce((sum, i) => sum + i.price_vnd, 0);
              return (
                <div key={group.talentName} className="flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                      <User className="size-4" />
                    </span>
                    <span className="flex-1 text-sm font-semibold text-foreground">
                      {group.talentName}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{formatVnd(total)}</span>
                  </div>
                  <div className="flex flex-col gap-1 pl-12">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.package.title}</span>
                        <div className="flex items-center gap-2">
                          <span>{formatVnd(item.price_vnd)}</span>
                          <button
                            type="button"
                            aria-label="Remove item"
                            onClick={() => handleRemove(item.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="p-3">
          <Button asChild disabled={groupList.length === 0} className="h-11 w-full rounded-[6px]">
            <Link href={`/${role}/checkout`}>Go Check Out</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
