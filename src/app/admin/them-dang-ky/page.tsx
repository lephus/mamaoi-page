import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ThemDangKyTool } from "@/components/ThemDangKyTool";
import { isAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Admin — Thêm đăng ký",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Khác `/admin` và `/admin/gui-mail`: trang này KHÔNG nạp trước danh sách đăng
 * ký. Nó chỉ ghi thêm, không cần tra cứu ai — và cổng chặn trùng email nằm ở
 * route, đọc lại từ DB đúng lúc bấm. Kéo 500 dòng PII xuống client cho một form
 * hai ô là việc thừa.
 */
export default async function ThemDangKyPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <ThemDangKyTool />;
}
