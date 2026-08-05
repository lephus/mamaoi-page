import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuetQrTool } from "@/components/QuetQrTool";
import { isAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Admin — Quét QR check-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * KHÔNG nạp sẵn danh sách 500 mẹ như `/admin/gui-mail`: màn hình này tra theo
 * từng lượt quét qua `/api/admin/tra-ma`, vì trạng thái check-in phải tươi tại
 * đúng thời điểm bấm nút (xem doc route đó).
 */
export default async function QuetQrPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <QuetQrTool />;
}
