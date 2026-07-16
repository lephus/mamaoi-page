import { checkinByCode } from "@/lib/supabase";
import { isValidCheckinCode } from "@/lib/validation";

/**
 * Self check-in write path (QR / link). Public: the random code IS the bearer
 * ticket (~1 tỷ tổ hợp nên dò mã bất khả thi). Chỉ GHI khi bấm nút — trang mở
 * (GET) chỉ đọc, nên prefetch/quét link của email client không thể vô tình check-in.
 */
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
