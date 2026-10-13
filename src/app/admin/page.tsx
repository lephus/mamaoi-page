import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { isAdmin } from "@/lib/admin-auth";
import { listRegistrations } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Admin — Check-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const rows = await listRegistrations();
  return <AdminDashboard initialRows={rows} />;
}
