import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GuiMailHangLoatTool } from "@/components/GuiMailHangLoatTool";
import { isAdmin } from "@/lib/admin-auth";
import { listRegistrations } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Admin — Gửi email hàng loạt",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GuiMailHangLoatPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <GuiMailHangLoatTool
      rows={await listRegistrations()}
      emailMacDinh={process.env.ADMIN_EMAIL ?? ""}
    />
  );
}
