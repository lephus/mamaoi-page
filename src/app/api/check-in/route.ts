import { markCheckedInInSheet, sheetsConfigured } from "@/lib/sheets";
import { checkinByCode } from "@/lib/supabase";
import { isValidCheckinCode } from "@/lib/validation";

/**
 * Self check-in write path (QR / link). Public: the random code IS the bearer
 * ticket (~1 tỷ tổ hợp nên dò mã bất khả thi). Chỉ GHI khi bấm nút — trang mở
 * (GET) chỉ đọc, nên prefetch/quét link của email client không thể vô tình check-in.
 */
// Có thêm hai lượt gọi Google (đọc cột mã + batchUpdate) sau khi ghi Supabase —
// nới maxDuration để lượt check-in tại cửa không bị nền tảng giết giữa chừng.
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const code = (body as { code?: string })?.code?.trim().toUpperCase() ?? "";
  if (!isValidCheckinCode(code)) {
    return Response.json({ error: "Mã không hợp lệ" }, { status: 400 });
  }

  try {
    const result = await checkinByCode(code);
    if (result.status === "not_found") {
      return Response.json({ error: "Không tìm thấy mã" }, { status: 404 });
    }

    // Mirror trạng thái check-in sang dòng của mẹ trong Google Sheet. Chỉ khi
    // vừa check-in LẦN ĐẦU ("ok"): quét lại ("already") không đổi gì ở Supabase
    // nên cũng không cần chạm Sheet. Non-fatal — check-in đã ghi xong ở Supabase
    // (nguồn chính thức /admin); Sheet lệch chỉ log để ops back-fill.
    if (result.status === "ok" && sheetsConfigured()) {
      try {
        await markCheckedInInSheet(code, result.time, "qr");
      } catch (err) {
        console.error("[check-in] Sheets update failed:", code, err);
      }
    }

    return Response.json({
      ok: true,
      alreadyCheckedIn: result.status === "already",
      name: result.name,
      time: result.time,
    });
  } catch (err) {
    console.error("[check-in] failed:", err);
    return Response.json({ error: "Hệ thống check-in tạm lỗi" }, { status: 502 });
  }
}
