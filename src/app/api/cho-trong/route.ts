import { NextResponse } from "next/server";
import { boNhoTamTheoThoiGian } from "@/lib/bo-nho-tam";
import { docSoLieuDangKy, sheetsConfigured } from "@/lib/sheets";
import { choConLai, sucChua } from "@/lib/suc-chua";

/**
 * Số chỗ còn lại, cho widget "Còn N/500 chỗ" trên landing.
 *
 * Khách chốt (feedback 24/07/2026, mục 9): đếm ngược số đơn đã xác nhận và gửi
 * QR. Một email nhận đúng một mã QR, nên con số ở đây là SỐ EMAIL KHÁC NHAU
 * trong tab register — cùng đúng con số mà cổng chặn trong `/api/dang-ky` dùng,
 * để trang không bao giờ nói "còn chỗ" trong khi form đang từ chối.
 *
 * `conLai: null` nghĩa là CHƯA BIẾT (chưa cấu hình Sheets ở dev, hoặc đọc Sheet
 * hỏng) — widget tự ẩn. Đoán bừa một con số ở đây là nói dối mẹ về chỗ trống.
 */

/** Route đọc Google Sheet nên luôn chạy lúc có request; phần tiết kiệm nằm ở bộ nhớ tạm dưới. */
export const dynamic = "force-dynamic";

/**
 * 30 giây: đủ ngắn để con số không cũ đến mức vô nghĩa, đủ dài để một đợt truy
 * cập dồn dập từ Facebook không biến thành hàng nghìn lượt đọc Sheet.
 */
const TTL_MS = 30_000;

const docCoNhoTam = boNhoTamTheoThoiGian(docSoLieuDangKy, TTL_MS);

export async function GET() {
  const gioiHan = sucChua();

  if (!sheetsConfigured()) {
    return NextResponse.json({ gioiHan, conLai: null });
  }

  try {
    const conLai = choConLai(await docCoNhoTam(), gioiHan);
    return NextResponse.json(
      { gioiHan, conLai },
      {
        headers: {
          // CDN gánh đợt dồn dập thay cho hàm serverless; `stale-while-revalidate`
          // để lượt đầu sau khi hết hạn vẫn có số ngay, làm mới ở nền.
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    console.error("[cho-trong] đọc Sheet thất bại:", err);
    return NextResponse.json({ gioiHan, conLai: null });
  }
}
