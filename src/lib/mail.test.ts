import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  guiEmailTheoMau,
  guiHangLoat,
  noiDungEmail,
  sendWaitlistEmail,
} from "./mail";
import { MAU_THU_TU } from "./mau-email";

/**
 * Đường gửi đã đổi từ Brevo REST API sang SMTP (nodemailer, pool). Test bám vào
 * `transport.sendMail` — bề mặt duy nhất mà mọi thư đi qua — nên nó khẳng định
 * được đúng những tính chất KHÔNG được phép mất khi đổi nhà cung cấp lần nữa.
 */
const guiMot = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: guiMot }) },
}));
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

describe("gửi qua SMTP", () => {
  beforeEach(() => {
    guiMot.mockReset();
    guiMot.mockResolvedValue({ accepted: ["x@y.vn"], rejected: [] });
    process.env.SMTP_USER = "mamaoi@digitalunicorn.tech";
    process.env.SMTP_PASS = "bi-mat";
    process.env.SMTP_FROM = "mamaoi@digitalunicorn.tech";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** Tham số của lượt gửi thứ `i`. */
  const thu = (i = 0) => guiMot.mock.calls[i][0];

  it("mail đơn: đúng MỘT người nhận, kèm tên", async () => {
    await guiEmailTheoMau("xacNhan", { email: "lan@example.com", hoTen: TEN }, MA);
    expect(guiMot).toHaveBeenCalledTimes(1);
    expect(thu().to).toEqual({ name: TEN, address: "lan@example.com" });
    expect(thu().subject).toBe(noiDungEmail("xacNhan", TEN, MA).subject);
  });

  it("QR đính kèm base64, tên file mang mã check-in", async () => {
    await guiEmailTheoMau("capLai", { email: "lan@example.com", hoTen: TEN }, MA);
    const kem = thu().attachments;
    expect(kem).toHaveLength(1);
    expect(kem[0].filename).toBe(`checkin-${MA}.png`);
    expect(kem[0].encoding).toBe("base64");
    // Base64 THUẦN — còn tiền tố `data:image/png;base64,` là file hỏng khi mở ra.
    expect(kem[0].content).not.toContain("data:");
  });

  it("mail waitlist không QR → KHÔNG có khoá attachments", async () => {
    await sendWaitlistEmail({
      email: "me@example.com",
      nguon: "app-waitlist",
      dongYNhanTin: true,
    } as never);
    expect("attachments" in thu()).toBe(false);
  });

  /**
   * Máy chủ nhận thư nhưng từ chối người nhận thì `sendMail` KHÔNG ném — địa chỉ
   * nằm ở `rejected`. Không kiểm là báo thành công cho một thư chắc chắn không tới.
   */
  it("người nhận bị từ chối → ném lỗi, không báo thành công giả", async () => {
    guiMot.mockResolvedValue({ accepted: [], rejected: ["lan@example.com"] });
    await expect(
      guiEmailTheoMau("xacNhan", { email: "lan@example.com", hoTen: TEN }, MA),
    ).rejects.toThrow("từ chối người nhận");
  });

  it("thiếu SMTP_FROM → lỗi rõ ràng, KHÔNG gửi gì", async () => {
    delete process.env.SMTP_FROM;
    await expect(
      guiEmailTheoMau("xacNhan", { email: "lan@example.com", hoTen: TEN }, MA),
    ).rejects.toThrow("SMTP_FROM");
    expect(guiMot).not.toHaveBeenCalled();
  });
});

describe("guiHangLoat qua SMTP", () => {
  beforeEach(() => {
    guiMot.mockReset();
    guiMot.mockResolvedValue({ accepted: ["x@y.vn"], rejected: [] });
    process.env.SMTP_USER = "mamaoi@digitalunicorn.tech";
    process.env.SMTP_PASS = "bi-mat";
    process.env.SMTP_FROM = "mamaoi@digitalunicorn.tech";
  });

  const ban = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      email: `me${i}@example.com`,
      hoTen: `Mẹ ${i}`,
      subject: `Tiêu đề ${i}`,
      html: `<p>Nội dung ${i}</p>`,
    }));

  /**
   * TÍNH CHẤT QUAN TRỌNG NHẤT, và là thứ dễ mất nhất khi đổi nhà cung cấp: mỗi
   * mẹ MỘT thư riêng, mỗi thư đúng MỘT địa chỉ. Gộp địa chỉ vào một trường `to`
   * là lộ email của cả 500 mẹ cho nhau — sự cố riêng tư thật.
   */
  it("mỗi mẹ MỘT thư riêng, mỗi thư đúng MỘT địa chỉ", async () => {
    await guiHangLoat(ban(3));
    expect(guiMot).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 3; i++) {
      expect(guiMot.mock.calls[i][0].to).toEqual({
        name: `Mẹ ${i}`,
        address: `me${i}@example.com`,
      });
      expect(guiMot.mock.calls[i][0].subject).toBe(`Tiêu đề ${i}`);
      expect(guiMot.mock.calls[i][0].html).toBe(`<p>Nội dung ${i}</p>`);
    }
  });

  it("500 mẹ → đúng 500 thư, không bỏ sót ai", async () => {
    expect(await guiHangLoat(ban(500))).toBe(500);
    expect(guiMot).toHaveBeenCalledTimes(500);
  });

  it("danh sách rỗng thì không gửi gì", async () => {
    expect(await guiHangLoat([])).toBe(0);
    expect(guiMot).not.toHaveBeenCalled();
  });

  it("đính kèm đi kèm MỌI thư, không riêng thư đầu", async () => {
    await guiHangLoat(ban(7), [{ name: "poster.png", content: "QQ==" }]);
    expect(guiMot).toHaveBeenCalledTimes(7);
    for (const c of guiMot.mock.calls) {
      expect(c[0].attachments).toEqual([
        { filename: "poster.png", content: "QQ==", encoding: "base64" },
      ]);
    }
  });

  it("không đính kèm → KHÔNG có khoá attachments", async () => {
    await guiHangLoat(ban(2));
    expect("attachments" in guiMot.mock.calls[0][0]).toBe(false);
  });

  /**
   * Hỏng MỘT PHẦN vẫn phải nổi thành lỗi kèm con số thật. Trả về rồi im lặng là
   * admin tưởng xong, và những mẹ trong danh sách hỏng không bao giờ được gửi lại.
   */
  it("một mẹ hỏng → ném lỗi kèm SỐ ĐÃ GỬI ĐƯỢC, không báo thành công giả", async () => {
    guiMot
      .mockResolvedValueOnce({ accepted: ["a"], rejected: [] })
      .mockRejectedValueOnce(new Error("mailbox full"))
      .mockResolvedValue({ accepted: ["c"], rejected: [] });
    await expect(guiHangLoat(ban(3))).rejects.toThrow("đã gửi 2");
  });

  it("máy chủ từ chối người nhận cũng tính là hỏng, không âm thầm bỏ qua", async () => {
    guiMot
      .mockResolvedValueOnce({ accepted: [], rejected: ["me0@example.com"] })
      .mockResolvedValue({ accepted: ["x"], rejected: [] });
    await expect(guiHangLoat(ban(2))).rejects.toThrow("1/2");
  });

  it("thiếu SMTP_FROM → lỗi rõ ràng, KHÔNG gửi gì", async () => {
    delete process.env.SMTP_FROM;
    await expect(guiHangLoat(ban(3))).rejects.toThrow("SMTP_FROM");
    expect(guiMot).not.toHaveBeenCalled();
  });
});
