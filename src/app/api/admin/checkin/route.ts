import { after } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { ghiCheckinVaoSheet, sheetsConfigured } from "@/lib/sheets";
import { adminUpdateCheckin } from "@/lib/supabase";

/**
 * Đường ghi check-in DUY NHẤT của phía admin. Dùng chung bởi:
 *  - nút tick / ô sửa giờ / bỏ tick trong bảng ở `/admin`
 *  - màn hình quét QR ở `/admin/quet-qr`
 *
 * Chung một route là có chủ đích: hai đường ghi riêng sẽ trôi lệch nhau, mà
 * Google Sheet là nơi lệch đó khó phát hiện nhất.
 *
 * Cổng giờ `daMoCheckin` KHÔNG áp ở đây — ops phải mở check-in sớm được nếu
 * khách tới trước giờ (xem doc `/api/check-in/route.ts`).
 */
// Mirror Sheet chạy trong `after` nên vẫn tính vào thời gian sống của hàm —
// nới maxDuration y như route check-in của mẹ để hai lượt gọi Google không bị
// nền tảng giết giữa chừng.
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const { id, checkedIn, checkedInAt } =
    (body as { id?: string; checkedIn?: boolean; checkedInAt?: string | null }) ?? {};
  if (!id || typeof checkedIn !== "boolean") {
    return Response.json({ error: "Thiếu dữ liệu" }, { status: 400 });
  }
  try {
    const row = await adminUpdateCheckin(id, checkedIn, checkedIn ? (checkedInAt ?? null) : null);

    // Mirror sang Google Sheet SAU KHI đã trả lời. Ở quầy ngày 30/08 có hàng
    // dài phía sau: hai lượt gọi Google (đọc cột mã + batchUpdate) tốn 1-3 giây
    // mà không ai ở quầy cần đợi. `after` chứ không phải promise thả trôi —
    // trên Vercel hàm bị đóng ngay khi response flush, promise chưa xong sẽ
    // chết giữa chừng.
    //
    // Non-fatal y như luồng mẹ tự quét: Supabase đã ghi xong và nó là nguồn
    // chính thức; Sheet lệch thì log để ops back-fill.
    after(async () => {
      if (!sheetsConfigured()) return;
      try {
        await ghiCheckinVaoSheet(
          row.checkin_code,
          row.checked_in_at,
          row.checked_in ? "admin" : null,
        );
      } catch (err) {
        console.error("[admin/checkin] Sheets update failed:", row.checkin_code, err);
      }
    });

    return Response.json({ ok: true, row });
  } catch (err) {
    console.error("[admin/checkin] failed:", err);
    return Response.json({ error: "Cập nhật thất bại" }, { status: 502 });
  }
}
