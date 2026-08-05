import { describe, expect, it } from "vitest";
import { noiDungEmail } from "./brevo";
import { MAU_THU_TU } from "./mau-email";

const MA = "MO-ABC234";
const TEN = "Nguyễn Thị Lan";

/**
 * Câu chữ hai mẫu xử lý sự cố là nguyên văn BTC soạn. Test này tồn tại để một
 * lần "sửa cho mượt" không âm thầm đổi lời xin lỗi khách đã duyệt.
 */
const NGUYEN_VAN: Record<string, string[]> = {
  capLai: [
    "Xin chào Nguyễn Thị Lan,",
    "Chúng mình là Mama Ơi Team.",
    "Hệ thống ghi nhận mã QR check-in trước đó của bạn đã được sử dụng. Để đảm bảo bạn vẫn check-in được vào ngày sự kiện, team gửi lại mã QR mới đính kèm email này.",
    "Lưu ý quan trọng:",
    "Đây là mã QR duy nhất có hiệu lực, vui lòng lưu lại cẩn thận (chụp màn hình hoặc lưu email).",
    "Không chia sẻ mã QR cho người khác dưới bất kỳ hình thức nào.",
    "BTC sẽ không giải quyết các trường hợp mã QR đã bị sử dụng khi đến check-in tại sự kiện.",
    "Nếu có bất kỳ thắc mắc nào, bạn vui lòng phản hồi trực tiếp email này nhé.",
  ],
  suCo: [
    "Chào bạn,",
    "Chúng mình là Mama Ơi Team.",
    "Team xin lỗi vì sự cố kỹ thuật khiến thông tin đăng ký của bạn chưa được ghi nhận đầy đủ trong hệ thống. Rất mong bạn thông cảm cho sự bất tiện này.",
    "Team gửi kèm mã QR check-in của bạn trong email này. Vui lòng lưu lại cẩn thận (chụp màn hình hoặc lưu email) để sử dụng khi đến sự kiện.",
    "Lưu ý: BTC sẽ không giải quyết các trường hợp mã QR đã bị sử dụng khi đến check-in tại sự kiện, vì vậy bạn vui lòng không chia sẻ mã QR cho người khác.",
    "Nếu có bất kỳ thắc mắc nào, bạn vui lòng phản hồi trực tiếp email này nhé.",
  ],
};

describe("noiDungEmail", () => {
  it.each(MAU_THU_TU)("mẫu %s luôn mang mã và link check-in", (mau) => {
    const { subject, html } = noiDungEmail(mau, TEN, MA);
    expect(subject).toBeTruthy();
    expect(html).toContain(MA);
    expect(html).toContain(`/check-in/${MA}`);
    // Không được sót chỗ nội suy hỏng hay placeholder của bản nháp.
    expect(html).not.toMatch(/undefined|\[T[eê]n kh[aá]ch\]/);
    // Email client xoá <style>, nên mọi style phải inline.
    expect(html).not.toContain("<style");
  });

  it.each(Object.keys(NGUYEN_VAN))("mẫu %s giữ nguyên văn BTC soạn", (mau) => {
    const { html } = noiDungEmail(mau as "capLai" | "suCo", TEN, MA);
    for (const cau of NGUYEN_VAN[mau]) expect(html).toContain(cau);
  });

  it("tiêu đề đúng từng chữ", () => {
    expect(noiDungEmail("capLai", TEN, MA).subject).toBe(
      "[Mama Ơi] Cấp lại mã QR check-in sự kiện",
    );
    expect(noiDungEmail("suCo", TEN, MA).subject).toBe(
      "[Mama Ơi] Xin lỗi vì sự cố kỹ thuật – Gửi mã QR check-in",
    );
    expect(noiDungEmail("xacNhan", TEN, MA).subject).toBe(
      `Xác nhận đăng ký Mama Ơi Day — mã ${MA}`,
    );
  });

  it("hai mẫu sự cố ký tên BTC, không ký thêm 'Đội ngũ Mama Ơi'", () => {
    for (const mau of ["capLai", "suCo"] as const) {
      const { html } = noiDungEmail(mau, TEN, MA);
      expect(html).toContain("Trân trọng &amp; Cảm ơn,");
      expect(html).not.toContain("Đội ngũ Mama Ơi");
    }
  });

  it("mẫu xacNhan giữ chữ ký gốc", () => {
    expect(noiDungEmail("xacNhan", TEN, MA).html).toContain("Đội ngũ Mama Ơi");
  });

  /**
   * Mail xác nhận đang chạy production và đã tới tay hàng trăm mẹ. Bố cục của
   * nó là: ô mã → câu dặn đưa QR → nút → bảng thông tin. Gom ô mã và nút thành
   * một khối dùng chung (việc rất dễ làm khi thêm mẫu mới) sẽ đẩy nút lên trước
   * câu dặn — đổi email production mà không ai nhận ra. Test này khoá thứ tự đó.
   */
  it("mẫu xacNhan giữ đúng thứ tự: ô mã → câu dặn → nút → bảng", () => {
    const { html } = noiDungEmail("xacNhan", TEN, MA);
    const viTri = [
      "Mã check-in của mẹ",
      "Mẹ vui lòng đưa mã QR đính kèm email này tại quầy check-in.",
      "Mở trang check-in",
      "Thời gian",
    ].map((s) => html.indexOf(s));

    expect(viTri.every((i) => i >= 0)).toBe(true);
    expect(viTri).toEqual([...viTri].sort((a, b) => a - b));
  });

  it("escape tên mẹ — tên là dữ liệu, không phải HTML", () => {
    const { html } = noiDungEmail("xacNhan", '<img src=x onerror="alert(1)">', MA);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img src=x");
  });
});
