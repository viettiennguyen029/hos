import { createServiceClient } from "@/lib/supabase/service";
import { CommissionRow } from "@/components/admin/commission-row";

export default async function AdminCommissionsPage() {
  const supabase = createServiceClient();
  const { data: talents } = await supabase
    .from("profiles")
    .select("id, full_name, commission_bps")
    .eq("role", "talent")
    .order("full_name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Talent Commission Rates</h1>
      <div className="flex flex-col gap-3">
        {(talents ?? []).map((talent) => (
          <CommissionRow
            key={talent.id}
            talentId={talent.id}
            fullName={talent.full_name}
            initialCommissionBps={talent.commission_bps}
          />
        ))}
        {(talents ?? []).length === 0 && <p className="text-sm text-muted-foreground">No talents found.</p>}
      </div>
    </div>
  );
}
