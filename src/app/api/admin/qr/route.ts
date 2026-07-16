import QRCode from "qrcode";
import { isAdmin } from "@/lib/admin-auth";
import { checkinUrl } from "@/lib/checkin-url";
import { isValidCheckinCode } from "@/lib/validation";

/**
 * QR sinh ở server (không ở trình duyệt): tái dùng đúng thư viện `qrcode` mà
 * email đang dùng, không phình bundle admin, và không rủi ro bundle `qrcode`
 * cho browser. Ảnh chỉ chứa URL check-in — nhưng URL đó chính là thứ dùng để
 * check-in, nên route vẫn phải chặn 401 như mọi route admin khác.
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!isValidCheckinCode(code)) {
    return Response.json({ error: "Mã không hợp lệ" }, { status: 400 });
  }
  try {
    const png = await QRCode.toBuffer(checkinUrl(code), {
      width: 480,
      margin: 2,
      color: { dark: "#292929", light: "#ffffff" },
    });
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[admin/qr] failed:", err);
    return Response.json({ error: "Không tạo được QR" }, { status: 502 });
  }
}
