"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTalentCommission } from "@/lib/supabase/admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runAction } from "@/lib/toast-action";

export function CommissionRow({
  talentId,
  fullName,
  initialCommissionBps,
}: {
  talentId: string;
  fullName: string;
  initialCommissionBps: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(initialCommissionBps));
  const [pending, setPending] = useState(false);

  async function handleSave() {
    setPending(true);
    const result = await runAction(updateTalentCommission(talentId, Number(value)), {
      success: "Commission updated.",
    });
    setPending(false);
    if (!("error" in result)) router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-white/5 p-4">
      <span className="text-sm font-semibold text-foreground">{fullName}</span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={10000}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-28"
        />
        <span className="text-xs text-muted-foreground">bps</span>
        <Button size="sm" disabled={pending} onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
