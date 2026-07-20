import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { isAdmin } from "@/lib/admin-auth";
import { listRegistrations, listWaitlist } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Admin — Check-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  // Song song: hai truy vấn độc lập, tuần tự thì trang chờ gấp đôi vô ích.
  const [rows, waitlist] = await Promise.all([listRegistrations(), listWaitlist()]);
  return <AdminDashboard initialRows={rows} initialWaitlist={waitlist} />;
}
