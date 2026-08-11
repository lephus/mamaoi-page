import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guiHangLoat, noiDungEmail } from "./brevo";
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

describe("guiHangLoat", () => {
  const goi = vi.fn();

  beforeEach(() => {
    goi.mockReset();
    goi.mockResolvedValue({ ok: true, status: 201, text: async () => "" });
    vi.stubGlobal("fetch", goi);
    process.env.BREVO_API_KEY = "xkeysib-test";
    process.env.BREVO_SENDER_EMAIL = "hello@mamaoi.vn";
    process.env.BREVO_SENDER_NAME = "Mama Ơi";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ban = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      email: `me${i}@example.com`,
      hoTen: `Mẹ ${i}`,
      subject: `Tiêu đề ${i}`,
      html: `<p>Nội dung ${i}</p>`,
    }));

  /** Đọc body JSON của lượt gọi fetch thứ `i`. */
  const body = (i: number) => JSON.parse(goi.mock.calls[i][1].body as string);

  it("gửi đúng endpoint transactional của Brevo", async () => {
    await guiHangLoat(ban(2));
    expect(goi).toHaveBeenCalledTimes(1);
    expect(goi.mock.calls[0][0]).toBe("https://api.brevo.com/v3/smtp/email");
  });

  /**
   * Tính chất quan trọng nhất của hàm này. Một trường `to` mang 500 địa chỉ là
   * lộ email của cả 500 mẹ cho nhau — sự cố riêng tư thật, không phải chi tiết
   * kỹ thuật.
   */
  it("mỗi mẹ một messageVersion riêng, mỗi bản đúng MỘT người nhận", async () => {
    await guiHangLoat(ban(3));
    const v = body(0).messageVersions;
    expect(v).toHaveLength(3);
    for (const [i, ban1] of v.entries()) {
      expect(ban1.to).toHaveLength(1);
      expect(ban1.to[0].email).toBe(`me${i}@example.com`);
      expect(ban1.subject).toBe(`Tiêu đề ${i}`);
      expect(ban1.htmlContent).toBe(`<p>Nội dung ${i}</p>`);
    }
  });

  it("500 mẹ vẫn đúng MỘT lượt gọi — sức chứa sự kiện nằm gọn trong một lô", async () => {
    expect(await guiHangLoat(ban(500))).toBe(500);
    expect(goi).toHaveBeenCalledTimes(1);
  });

  /**
   * Brevo giới hạn 1000 messageVersions mỗi lượt. Vòng chia lô tồn tại để ngày
   * nào đó EVENT_CAPACITY được nâng lên thì hệ thống không ÂM THẦM cắt bớt
   * người nhận — im lặng bỏ rơi 500 mẹ là kiểu hỏng tệ nhất ở đây.
   */
  it("1500 mẹ chia đúng 2 lô, không bỏ sót ai", async () => {
    expect(await guiHangLoat(ban(1500))).toBe(1500);
    expect(goi).toHaveBeenCalledTimes(2);
    expect(body(0).messageVersions).toHaveLength(1000);
    expect(body(1).messageVersions).toHaveLength(500);
  });

  it("danh sách rỗng thì không gọi Brevo", async () => {
    expect(await guiHangLoat([])).toBe(0);
    expect(goi).not.toHaveBeenCalled();
  });

  it("Brevo từ chối → ném lỗi kèm nguyên văn phản hồi, không báo thành công giả", async () => {
    goi.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"message":"Invalid sender"}',
    });
    await expect(guiHangLoat(ban(2))).rejects.toThrow("Invalid sender");
  });

  it("hỏng ở lô thứ hai thì lỗi nói rõ đã gửi được bao nhiêu", async () => {
    goi
      .mockResolvedValueOnce({ ok: true, status: 201, text: async () => "" })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" });
    await expect(guiHangLoat(ban(1500))).rejects.toThrow("1000/1500");
  });

  it("thiếu BREVO_SENDER_EMAIL → lỗi rõ ràng, không gọi Brevo", async () => {
    delete process.env.BREVO_SENDER_EMAIL;
    await expect(guiHangLoat(ban(1))).rejects.toThrow("BREVO_SENDER_EMAIL");
    expect(goi).not.toHaveBeenCalled();
  });

  /**
   * Câu hỏi thật của tính năng đính kèm. Brevo chỉ cho mỗi messageVersion ghi đè
   * to/cc/bcc/replyTo/subject/htmlContent/textContent/params — đính kèm PHẢI nằm
   * ở cấp gốc mới áp được cho mọi bản. Đặt nhầm chỗ thì không ai nhận được file,
   * và không có lỗi nào nổi lên để báo.
   */
  it("có đính kèm → attachment ở CẤP GỐC, không nằm trong messageVersions", async () => {
    await guiHangLoat(ban(2), [{ name: "poster.png", content: "QQ==" }]);
    const b = body(0);
    expect(b.attachment).toEqual([{ name: "poster.png", content: "QQ==" }]);
    for (const v of b.messageVersions) expect(v.attachment).toBeUndefined();
  });

  it("không có đính kèm → payload KHÔNG có khoá attachment", async () => {
    await guiHangLoat(ban(2));
    expect("attachment" in body(0)).toBe(false);
  });

  it("mảng đính kèm rỗng cũng KHÔNG sinh khoá attachment", async () => {
    await guiHangLoat(ban(2), []);
    expect("attachment" in body(0)).toBe(false);
  });

  /**
   * Chia lô là chỗ dễ quên nhất: gắn đính kèm ngoài vòng lặp thì lô thứ hai đi
   * tay không, và 500 mẹ cuối danh sách nhận email thiếu file mà không ai biết.
   */
  it("chia lô: CẢ HAI lô đều mang đính kèm, không chỉ lô đầu", async () => {
    await guiHangLoat(ban(1500), [{ name: "poster.png", content: "QQ==" }]);
    expect(body(0).attachment).toHaveLength(1);
    expect(body(1).attachment).toHaveLength(1);
  });
});
