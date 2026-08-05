import { describe, it, expect } from "vitest";
import { rowsToSheet, waitlistToSheet } from "@/lib/export-rows";
import type { RegistrationRow, WaitlistRow } from "@/lib/supabase";

const base: RegistrationRow = {
  id: "uuid-1",
  created_at: "2026-07-20T03:00:00.000Z", // 10:00 20/07/2026 giờ VN
  checkin_code: "MO-23456A",
  ho_ten: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  facebook: null,
  tinh_thanh: "TP.HCM",
  trang_thai: "mang_thai",
  thai_tuan: 20,
  ten_be: null,
  be_ngay_sinh: null,
  be_gioi_tinh: null,
  be_thang_tuoi: null,
  chu_de_quan_tam: ["an_dam", "ngu"],
  chu_de_khac: null,
  nguon_biet_den: "facebook",
  di_cung_chong: true,
  dong_y_nhan_tin: true,
  nguon: "su-kien",
  checked_in: false,
  checked_in_at: null,
  checked_in_source: null,
};

describe("rowsToSheet", () => {
  it("có đúng 22 cột và không lộ id", () => {
    const { headers } = rowsToSheet([base]);
    expect(headers).toHaveLength(22);
    expect(headers).not.toContain("id");
    expect(headers[0]).toBe("Họ tên");
  });

  it("mỗi dòng dữ liệu khớp số cột của header", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(headers.length);
  });

  it("dịch trang_thai sang tiếng Việt", () => {
    expect(rowsToSheet([base]).rows[0]).toContain("Mang thai");
    expect(
      rowsToSheet([
        {
          ...base,
          trang_thai: "da_sinh",
          thai_tuan: null,
          ten_be: "Gạo",
          be_ngay_sinh: "2026-01-20",
          be_gioi_tinh: "nu",
          be_thang_tuoi: 6,
        },
      ]).rows[0],
    ).toContain("Đã sinh");
  });

  it("dịch đúng nhánh tiền-thai-kỳ, không rơi về 'Đã sinh'", () => {
    expect(
      rowsToSheet([{ ...base, trang_thai: "chuan_bi_mang_thai", thai_tuan: null }]).rows[0],
    ).toContain("Chuẩn bị mang thai");
    expect(
      rowsToSheet([{ ...base, trang_thai: "ivf", thai_tuan: null }]).rows[0],
    ).toContain("IVF");
  });

  it("boolean thành Có / dấu gạch", () => {
    const r = rowsToSheet([{ ...base, di_cung_chong: false }]).rows[0];
    expect(r).toContain("—");
  });

  // Đọc giá trị THEO VỊ TRÍ CỦA NHÃN, không phải toContain: `toContain` không
  // phân biệt được cột đúng với cột bị hoán đổi (vd. email lọt vào ô "Họ
  // tên"). Bốn cột này là cột định danh ops đọc trực tiếp — hoán đổi ở đây là
  // sự cố nghiêm trọng nhất trong cả bảng.
  it("các cột định danh nằm đúng vị trí: Họ tên, Email, SĐT, Nguồn đăng ký", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows[0][headers.indexOf("Họ tên")]).toBe("Nguyễn Thị Lan");
    expect(rows[0][headers.indexOf("Email")]).toBe("lan@example.com");
    expect(rows[0][headers.indexOf("SĐT")]).toBe("0901234567");
    expect(rows[0][headers.indexOf("Nguồn đăng ký")]).toBe("su-kien");
  });

  it("trường rỗng thành chuỗi rỗng, không phải null hay 'null'", () => {
    const r = rowsToSheet([base]).rows[0];
    expect(r).not.toContain(null);
    expect(r).not.toContain("null");
  });

  it("đổi giờ đăng ký sang giờ VN", () => {
    expect(rowsToSheet([base]).rows[0]).toContain("10:00 20/07/2026");
  });

  it("dòng chưa check-in để trống cột giờ check-in", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows[0][headers.indexOf("Giờ check-in")]).toBe("");
  });

  it("dòng đã check-in hiện giờ VN và nguồn", () => {
    const { headers, rows } = rowsToSheet([
      { ...base, checked_in: true, checked_in_at: "2026-08-30T02:30:00.000Z", checked_in_source: "qr" },
    ]);
    expect(rows[0][headers.indexOf("Giờ check-in")]).toBe("09:30 30/08/2026");
    expect(rows[0][headers.indexOf("Nguồn check-in")]).toBe("(QR)");
  });

  it("admin check-in hộ thì cột nguồn ghi '(Admin CheckIn)'", () => {
    const { headers, rows } = rowsToSheet([
      {
        ...base,
        checked_in: true,
        checked_in_at: "2026-08-30T02:30:00.000Z",
        checked_in_source: "admin",
      },
    ]);
    expect(rows[0][headers.indexOf("Nguồn check-in")]).toBe("(Admin CheckIn)");
  });

  /* Chưa check-in thì ô nguồn phải TRỐNG, không phải "--". Khác hẳn các cột
     "chưa hỏi" ở trên: mẹ chưa tới quầy thì không có nguồn nào để nói, và ô
     trống đúng bằng ô của dòng Sheet vừa append. */
  it("chưa check-in thì cột nguồn để trống, KHÔNG phải '--'", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows[0][headers.indexOf("Nguồn check-in")]).toBe("");
  });

  it("danh sách rỗng vẫn trả header", () => {
    const { headers, rows } = rowsToSheet([]);
    expect(headers).toHaveLength(22);
    expect(rows).toEqual([]);
  });

  it("chủ đề quan tâm xuất ra nhãn tiếng Việt nối bằng dấu phẩy", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows[0][headers.indexOf("Chủ đề quan tâm")]).toBe("Ăn dặm, Ngủ");
  });

  it("nguồn biết đến xuất ra nhãn tiếng Việt", () => {
    const { headers, rows } = rowsToSheet([{ ...base, nguon_biet_den: "ban_be" }]);
    expect(rows[0][headers.indexOf("Nguồn biết đến")]).toBe("Bạn bè");
  });

  it("mẹ mang thai để trống toàn bộ cột thông tin bé", () => {
    const { headers, rows } = rowsToSheet([base]);
    for (const cot of ["Tên bé", "Ngày sinh bé", "Giới tính bé", "Bé (tháng tuổi)"]) {
      expect(rows[0][headers.indexOf(cot)]).toBe("");
    }
    expect(rows[0][headers.indexOf("Thai (tuần)")]).toBe(20);
  });

  it("mẹ đã sinh để trống cột tuần thai", () => {
    const { headers, rows } = rowsToSheet([
      {
        ...base,
        trang_thai: "da_sinh",
        thai_tuan: null,
        ten_be: "Gạo",
        be_ngay_sinh: "2026-01-20",
        be_gioi_tinh: "nu",
        be_thang_tuoi: 6,
      },
    ]);
    expect(rows[0][headers.indexOf("Thai (tuần)")]).toBe("");
    expect(rows[0][headers.indexOf("Giới tính bé")]).toBe("Nữ");
    expect(rows[0][headers.indexOf("Ngày sinh bé")]).toBe("20/01/2026");
  });

  // Form bắt buộc chọn ít nhất một chủ đề, nên mảng rỗng CHỈ có ở dòng ops tạo
  // tay — "--" nói đúng điều đó, còn ô trắng đọc như lỗi xuất file.
  it("chủ đề rỗng thành '--' (dòng tạo tay), không phải ô trắng", () => {
    const { headers, rows } = rowsToSheet([{ ...base, chu_de_quan_tam: [] }]);
    expect(rows[0][headers.indexOf("Chủ đề quan tâm")]).toBe("--");
  });

  /**
   * Dòng ops tạo tay ở /admin: chỉ có email + họ tên, phần còn lại chưa hỏi.
   * `trang_thai`/`nguon_biet_den` để null (không bịa giá trị phân khúc),
   * `sdt`/`tinh_thanh` mang "--" vì hai cột đó NOT NULL. Cả bảng phải đọc ra
   * "--" chứ không ra ô trắng hay chữ "null".
   */
  it("dòng tạo tay: mọi ô chưa hỏi đều xuất ra '--'", () => {
    const { headers, rows } = rowsToSheet([
      {
        ...base,
        sdt: "--",
        tinh_thanh: "--",
        trang_thai: null,
        thai_tuan: null,
        chu_de_quan_tam: [],
        nguon_biet_den: null,
      },
    ]);
    for (const cot of ["SĐT", "Thành phố", "Tình trạng", "Chủ đề quan tâm", "Nguồn biết đến"]) {
      expect(rows[0][headers.indexOf(cot)]).toBe("--");
    }
    expect(rows[0]).not.toContain("null");
    // Cột định danh vẫn phải là dữ liệu thật, không bị "--" nuốt mất.
    expect(rows[0][headers.indexOf("Họ tên")]).toBe("Nguyễn Thị Lan");
    expect(rows[0][headers.indexOf("Email")]).toBe("lan@example.com");
    expect(rows[0][headers.indexOf("Mã check-in")]).toBe("MO-23456A");
  });

  it("có 22 cột, 'Chủ đề khác' ngay sau 'Chủ đề quan tâm'", () => {
    const { headers } = rowsToSheet([]);
    expect(headers).toHaveLength(22);
    expect(headers.indexOf("Chủ đề khác")).toBe(headers.indexOf("Chủ đề quan tâm") + 1);
  });

  // Đọc giá trị THEO VỊ TRÍ CỦA NHÃN, không phải toContain. Đây là kiểu assert
  // duy nhất bắt được lỗi lệch cột — mà file 22 cột này ops đọc trực tiếp.
  it("giá trị chủ đề khác nằm đúng cột của nó", () => {
    const { headers, rows } = rowsToSheet([
      { ...base, chu_de_quan_tam: ["thai_ky"], chu_de_khac: "Trầm cảm sau sinh" },
    ]);
    expect(rows[0][headers.indexOf("Chủ đề khác")]).toBe("Trầm cảm sau sinh");
    expect(rows[0][headers.indexOf("Chủ đề quan tâm")]).toBe("Thai kỳ");
  });

  it("chu_de_khac null thành chuỗi rỗng, không phải chữ 'null'", () => {
    const { headers, rows } = rowsToSheet([{ ...base, chu_de_khac: null }]);
    expect(rows[0][headers.indexOf("Chủ đề khác")]).toBe("");
  });
});

const waitlistBase: WaitlistRow = {
  id: "uuid-w1",
  created_at: "2026-07-20T03:00:00.000Z", // 10:00 20/07/2026 giờ VN
  email: "cho-doi@example.com",
  dong_y_nhan_tin: true,
};

describe("waitlistToSheet", () => {
  it("có đúng 3 cột và không lộ id", () => {
    const { headers } = waitlistToSheet([waitlistBase]);
    expect(headers).toEqual(["Email", "Đồng ý nhận tin", "Thời điểm đăng ký"]);
  });

  it("mỗi dòng dữ liệu khớp số cột của header", () => {
    const { headers, rows } = waitlistToSheet([waitlistBase]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(headers.length);
  });

  // Đọc giá trị THEO VỊ TRÍ CỦA NHÃN — cùng lý do với bảng đăng ký sự kiện:
  // `toContain` không phân biệt được cột đúng với cột hoán đổi.
  it("các cột nằm đúng vị trí: Email, Đồng ý nhận tin, Thời điểm đăng ký", () => {
    const { headers, rows } = waitlistToSheet([waitlistBase]);
    expect(rows[0][headers.indexOf("Email")]).toBe("cho-doi@example.com");
    expect(rows[0][headers.indexOf("Đồng ý nhận tin")]).toBe("Có");
    expect(rows[0][headers.indexOf("Thời điểm đăng ký")]).toBe("10:00 20/07/2026");
  });

  it("chưa đồng ý nhận tin thành dấu gạch", () => {
    const { headers, rows } = waitlistToSheet([
      { ...waitlistBase, dong_y_nhan_tin: false },
    ]);
    expect(rows[0][headers.indexOf("Đồng ý nhận tin")]).toBe("—");
  });

  it("danh sách rỗng vẫn trả header, không có dòng dữ liệu", () => {
    const { headers, rows } = waitlistToSheet([]);
    expect(headers).toHaveLength(3);
    expect(rows).toEqual([]);
  });
});
