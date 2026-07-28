import QRCode from "qrcode";
import { checkinUrl } from "@/lib/checkin-url";
import { isValidCheckinCode } from "@/lib/validation";

/**
 * QR sinh ở server (không ở trình duyệt): tái dùng đúng thư viện `qrcode` mà
 * email đang dùng, không phình bundle admin, và không rủi ro bundle `qrcode`
 * cho browser.
 *
 * Route này CÔNG KHAI (không `isAdmin()`), dù nằm dưới `/api/admin/`: nó là một
 * bộ mã hoá thuần `code -> ảnh`, không đọc DB, không trả về dữ liệu mẹ nào. Đầu
 * vào là mã check-in mà người gọi ĐÃ có, đầu ra là đúng mã đó vẽ thành ảnh của
 * `checkinUrl(code)` — mà `/check-in/[code]` vốn đã là trang công khai cho mẹ
 * quét. Chặn 401 ở đây không giấu được gì, chỉ chặn việc dán thẳng link ảnh QR
 * cho mẹ / cho bên in ấn.
 */
export async function GET(request: Request) {
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
        // Ảnh chỉ phụ thuộc `code` (và base URL) nên cache được ở CDN — vừa
        // nhanh cho mẹ, vừa chặn việc mỗi lượt quét lại tốn một lần sinh PNG.
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("[admin/qr] failed:", err);
    return Response.json({ error: "Không tạo được QR" }, { status: 502 });
  }
}
