import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GuiMailTool } from "@/components/GuiMailTool";
import { isAdmin } from "@/lib/admin-auth";
import { listRegistrations } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Admin — Gửi lại email QR",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GuiMailPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <GuiMailTool rows={await listRegistrations()} />;
}
