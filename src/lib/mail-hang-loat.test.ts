import { describe, expect, it } from "vitest";
import { dungEmail } from "@/lib/mail-hang-loat";

const LAN = { ho_ten: "Nguyễn Thị Lan", checkin_code: "MO-ABC234" };

/**
 * `shell()` (mail.ts, dùng nguyên khung — xem `dungEmail`) tự vẽ thêm đúng MỘT
 * thẻ `<p style=...>` của riêng nó cho email gửi hàng loạt: đoạn chân trang.
 * Nó cộng vào MỌI phép đếm `<p ` bên dưới, bất kể nội dung admin gõ có bao nhiêu
 * đoạn — nên số đoạn thật luôn phải +1 so với số đoạn admin gõ.
 *
 * TRƯỚC ĐÂY LÀ 2: khung còn vẽ thêm đoạn chữ ký "Trân trọng & Cảm ơn, Mama Ơi
 * Team". Chữ ký đã bỏ khỏi email gửi hàng loạt theo yêu cầu — admin tự gõ lời
 * kết trong phần nội dung. Hai mẫu cố định `capLai` / `suCo` KHÔNG đổi, vẫn ký
 * tên BTC như câu chữ đã duyệt.
 */
const SO_P_KHUNG = 1;

describe("dungEmail — nội dung", () => {
  it("{{ten}} ra tên thật, {{ma}} ra mã thật", () => {
    const { html } = dungEmail("x", "Chào chị {{ten}}, mã {{ma}} nhé.", LAN);
    expect(html).toContain("Chào chị Nguyễn Thị Lan, mã MO-ABC234 nhé.");
    expect(html).not.toContain("{{");
  });

  /**
   * Ca quan trọng nhất của file. Spec chốt admin gõ CHỮ THƯỜNG, không phải HTML.
   * Nếu escape sau khi thay chỗ điền (hoặc quên escape), một dòng admin dán vào
   * có thể chèn thẻ vào email của 500 mẹ.
   */
  it("chữ admin gõ được escape — thẻ ra CHỮ, không ra thẻ", () => {
    const { html } = dungEmail("x", "<script>alert(1)</script>", LAN);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("tên mẹ có ký tự đặc biệt cũng được escape", () => {
    const { html } = dungEmail("x", "Chào {{ten}}", {
      ho_ten: "Trần & Lê <b>",
      checkin_code: "MO-ABC234",
    });
    expect(html).toContain("Trần &amp; Lê &lt;b&gt;");
    expect(html).not.toContain("<b>");
  });

  it("dòng trống ngăn đoạn → hai thẻ <p>", () => {
    const { html } = dungEmail("x", "Đoạn một.\n\nĐoạn hai.", LAN);
    expect(html).toContain("Đoạn một.");
    expect(html).toContain("Đoạn hai.");
    expect(html.match(/<p /g)?.length).toBe(2 + SO_P_KHUNG);
  });

  it("xuống dòng đơn trong một đoạn → <br>, không tách đoạn", () => {
    const { html } = dungEmail("x", "Dòng một\nDòng hai", LAN);
    expect(html).toContain("Dòng một<br>Dòng hai");
    expect(html.match(/<p /g)?.length).toBe(1 + SO_P_KHUNG);
  });

  it("bỏ đoạn rỗng do admin gõ thừa dòng trống", () => {
    const { html } = dungEmail("x", "A.\n\n\n\nB.", LAN);
    expect(html.match(/<p /g)?.length).toBe(2 + SO_P_KHUNG);
  });

  /**
   * Chân trang Ở LẠI (nó nói vì sao mẹ nhận được email này — thông tin bắt buộc
   * để không bị coi là thư rác), nhưng chữ ký thì KHÔNG. Bỏ chữ ký mà quên
   * truyền `null` sẽ khiến `shell` rơi về mặc định "Đội ngũ Mama Ơi" — vẫn là
   * một chữ ký, chỉ khác chữ. Nên phải khẳng định CẢ HAI chuỗi đều vắng mặt.
   */
  it("giữ chân trang thương hiệu nhưng KHÔNG ký tên", () => {
    const { html } = dungEmail("x", "Nội dung", LAN);
    expect(html).toContain("Bạn nhận được email này vì đã đăng ký tham dự");
    expect(html).not.toContain("Mama Ơi Team");
    expect(html).not.toContain("Đội ngũ Mama Ơi");
  });
});

describe("dungEmail — tiêu đề", () => {
  it("thay chỗ điền trong tiêu đề", () => {
    const { subject } = dungEmail("Chị {{ten}} ơi — mã {{ma}}", "x", LAN);
    expect(subject).toBe("Chị Nguyễn Thị Lan ơi — mã MO-ABC234");
  });

  /**
   * Tiêu đề là chuỗi THƯỜNG, không phải HTML. Escape ở đây làm mẹ nhận email
   * tiêu đề "Chào chị Trần &amp; Lê".
   */
  it("tiêu đề KHÔNG escape", () => {
    const { subject } = dungEmail("Chào {{ten}}", "x", {
      ho_ten: "Trần & Lê",
      checkin_code: "MO-ABC234",
    });
    expect(subject).toBe("Chào Trần & Lê");
  });

  it("tiêu đề không có chỗ điền thì giữ nguyên văn", () => {
    expect(dungEmail("Sự kiện đổi địa điểm", "x", LAN).subject).toBe(
      "Sự kiện đổi địa điểm",
    );
  });
});
