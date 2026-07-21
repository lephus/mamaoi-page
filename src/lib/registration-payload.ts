/**
 * Dựng payload gửi lên `POST /api/dang-ky` từ FormData của form đăng ký.
 *
 * Tách khỏi component vì đây là chỗ DUY NHẤT quyết định mẹ mang thai gửi field
 * gì và mẹ đã sinh gửi field gì. Đảo nhầm hai nhánh là đảo ngược đúng phép phân
 * khúc mà cả tính năng này sinh ra để làm — mà khi khối này còn nằm trong
 * component thì `tsc` lẫn toàn bộ test đều không chạm tới được (vitest chỉ
 * include `src/**` `/*.test.ts`, và payload là object literal rời không gắn kiểu).
 * Nằm ở đây thì test bắt được.
 *
 * `chuDe` truyền vào từ React state chứ không đọc FormData: checkbox chủ đề cố
 * ý không có thuộc tính `name` để state là nguồn sự thật duy nhất.
 */
export function buildRegistrationPayload(
  fd: FormData,
  chuDe: string[],
): Record<string, unknown> {
  const trangThai = fd.get("trangThai");
  return {
    nguon: "su-kien" as const,
    hoTen: String(fd.get("hoTen") ?? ""),
    email: String(fd.get("email") ?? ""),
    sdt: String(fd.get("sdt") ?? ""),
    facebook: String(fd.get("facebook") ?? ""),
    tinhThanh: String(fd.get("tinhThanh") ?? ""),
    trangThai,
    chuDeQuanTam: chuDe,
    chuDeKhac: String(fd.get("chuDeKhac") ?? ""),
    nguonBietDen: fd.get("nguonBietDen"),
    diCungChong: fd.get("diCungChong") === "on",
    dongYNhanTin: fd.get("dongYNhanTin") === "on",
    website: String(fd.get("website") ?? ""),
    // Chỉ gửi field của nhánh ĐANG chọn. Nhánh kia để vắng mặt hẳn — schema
    // sẽ cắt bỏ, nhưng gửi đúng ngay từ đây thì thông báo lỗi cũng đúng chỗ.
    // Hai nhánh tiền-thai-kỳ (chuẩn bị / IVF) không có field con nào cả.
    ...(trangThai === "da_sinh"
      ? {
          tenBe: String(fd.get("tenBe") ?? ""),
          beNgaySinh: String(fd.get("beNgaySinh") ?? ""),
          beGioiTinh: fd.get("beGioiTinh"),
        }
      : trangThai === "mang_thai"
        ? { thaiTuan: fd.get("thaiTuan") }
        : {}),
  };
}
