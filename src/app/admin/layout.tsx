import { notFound } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/supabase/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) notFound();

  return <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>;
}
