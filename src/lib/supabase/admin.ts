import { createClient } from "@/lib/supabase/server";

/** Whether the signed-in user is an internal ops admin -- checks the admin_users allowlist, not any marketplace role_type. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  return data !== null;
}
