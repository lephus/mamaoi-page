import { isAdmin } from "@/lib/admin-auth";
import { findByCode } from "@/lib/supabase";
import { rutGonChoQuet } from "@/lib/thong-tin-quet";
import { isValidCheckinCode } from "@/lib/validation";

/**
 * Tra một dòng đăng ký theo mã check-in, cho màn hình quét QR `/admin/quet-qr`.
 *
 * CHỈ ĐỌC — không ghi gì. Việc ghi nằm ở `/api/admin/checkin`, sau khi nhân
 * viên bấm nút xác nhận. Tách đôi như vậy để camera quét trúng một mã hợp lệ
 * KHÔNG tự động check-in ai cả.
 *
 * Trả bản rút gọn (`rutGonChoQuet`), cố tình bỏ email/SĐT/Facebook — xem doc ở
 * `src/lib/thong-tin-quet.ts`.
 *
 * Gọi MỖI LƯỢT QUÉT, không cache trước cả danh sách: quầy bên cạnh vừa check-in
 * mẹ này 30 giây trước thì bản cache sẽ nói "chưa check-in", nhân viên thấy nút
 * CHÍNH thay vì nút phụ "Check-in lại", và ghi đè mất giờ đúng.
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const code = (new URL(request.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!isValidCheckinCode(code)) {
    return Response.json({ error: "Mã không hợp lệ" }, { status: 400 });
  }

  try {
    const row = await findByCode(code);
    if (!row) {
      return Response.json({ error: "Không tìm thấy mã" }, { status: 404 });
    }
    return Response.json({ ok: true, row: rutGonChoQuet(row) });
  } catch (err) {
    console.error("[admin/tra-ma] lookup failed:", code, err);
    return Response.json({ error: "Không đọc được dữ liệu đăng ký" }, { status: 502 });
  }
}
