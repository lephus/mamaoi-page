import { describe, expect, it } from "vitest";
import { thuCongSchema, thuCongToRow } from "@/lib/dang-ky-thu-cong";

const HOP_LE = { hoTen: "Nguyễn Thị Lan", email: "Lan@Example.COM " };

describe("thuCongSchema", () => {
  it("chỉ cần họ tên + email", () => {
    const r = thuCongSchema.safeParse(HOP_LE);
    expect(r.success).toBe(true);
  });

  // Cùng phép chuẩn hoá với `registrationSchema`: mã check-in tra theo email, và
  // "Lan@Example.COM" với "lan@example.com" phải là CÙNG một mẹ, nếu không cổng
  // chặn trùng ở route sẽ cho qua rồi cấp mã thứ hai cho một người.
  it("cắt khoảng trắng và hạ email về chữ thường", () => {
    const r = thuCongSchema.parse(HOP_LE);
    expect(r.email).toBe("lan@example.com");
  });

  it("cắt khoảng trắng họ tên", () => {
    expect(thuCongSchema.parse({ ...HOP_LE, hoTen: "  Lan  " }).hoTen).toBe("Lan");
  });

  it("từ chối email sai và họ tên quá ngắn", () => {
    expect(thuCongSchema.safeParse({ ...HOP_LE, email: "khong-phai-email" }).success).toBe(
      false,
    );
    expect(thuCongSchema.safeParse({ ...HOP_LE, hoTen: "A" }).success).toBe(false);
    expect(thuCongSchema.safeParse({ hoTen: "Lan" }).success).toBe(false);
  });

  it("từ chối họ tên quá 80 ký tự", () => {
    expect(thuCongSchema.safeParse({ ...HOP_LE, hoTen: "a".repeat(81) }).success).toBe(false);
  });

  /**
   * Hai cờ này quyết định hành vi có tác dụng ra ngoài (một email bay đi, một
   * ô consent bật lên), nên mặc định phải là phía AN TOÀN khi client không gửi:
   * không gửi mail, và không tự nhận là mẹ đã đồng ý.
   */
  it("guiEmail và dongYNhanTin mặc định tắt khi client không gửi", () => {
    const r = thuCongSchema.parse(HOP_LE);
    expect(r.guiEmail).toBe(false);
    expect(r.dongYNhanTin).toBe(false);
  });

  it("nhận đúng hai cờ khi client gửi", () => {
    const r = thuCongSchema.parse({ ...HOP_LE, guiEmail: true, dongYNhanTin: true });
    expect(r.guiEmail).toBe(true);
    expect(r.dongYNhanTin).toBe(true);
  });

  /**
   * SĐT TUỲ CHỌN: ops có thì nhập, không có thì thôi. Bắt buộc ở đây là phá đúng
   * ca gốc mà tính năng này sinh ra để phục vụ — trong tay chỉ có email + họ tên.
   */
  it("sdt để trống là hợp lệ", () => {
    expect(thuCongSchema.parse(HOP_LE).sdt).toBe("");
    expect(thuCongSchema.parse({ ...HOP_LE, sdt: "" }).sdt).toBe("");
    expect(thuCongSchema.parse({ ...HOP_LE, sdt: "   " }).sdt).toBe("");
  });

  it("nhận sdt hợp lệ", () => {
    expect(thuCongSchema.parse({ ...HOP_LE, sdt: "0901234567" }).sdt).toBe("0901234567");
    expect(thuCongSchema.parse({ ...HOP_LE, sdt: "+84901234567" }).sdt).toBe("+84901234567");
  });

  // Ops DÁN số từ Zalo/Excel/danh bạ, và bản dán hay mang theo khoảng trắng,
  // dấu chấm hoặc gạch nối. Từ chối "090 123 4567" là từ chối một số hoàn toàn
  // đúng vì lý do trình bày.
  it("cắt khoảng trắng và dấu phân cách trong sdt", () => {
    expect(thuCongSchema.parse({ ...HOP_LE, sdt: "090 123 4567" }).sdt).toBe("0901234567");
    expect(thuCongSchema.parse({ ...HOP_LE, sdt: "0901.234.567" }).sdt).toBe("0901234567");
    expect(thuCongSchema.parse({ ...HOP_LE, sdt: "0901-234-567" }).sdt).toBe("0901234567");
  });

  // Đã nhập thì phải đúng — cùng luật với form công khai. Số sai còn tệ hơn ô
  // trống: ops gọi vào số rác mà tưởng mình có cách liên lạc với mẹ.
  it("từ chối sdt sai định dạng", () => {
    for (const sai of ["123", "abcdefghij", "09012345678", "1901234567"]) {
      const r = thuCongSchema.safeParse({ ...HOP_LE, sdt: sai });
      expect(r.success, sai).toBe(false);
    }
  });
});

describe("thuCongToRow", () => {
  const row = thuCongToRow(
    {
      hoTen: "Nguyễn Thị Lan",
      email: "lan@example.com",
      sdt: "",
      guiEmail: true,
      dongYNhanTin: false,
    },
    "MO-ABC234",
  );

  it("giữ nguyên dữ liệu thật mà ops nhập", () => {
    expect(row.ho_ten).toBe("Nguyễn Thị Lan");
    expect(row.email).toBe("lan@example.com");
    expect(row.checkin_code).toBe("MO-ABC234");
  });

  // Hai cột này NOT NULL trong Postgres — buộc phải có giá trị, và "--" là thứ
  // ops đọc ra ngay trên bảng 500 dòng.
  it("sdt bỏ trống và tinh_thanh mang '--'", () => {
    expect(row.sdt).toBe("--");
    expect(row.tinh_thanh).toBe("--");
  });

  it("sdt có nhập thì ghi xuống nguyên vẹn, không thành '--'", () => {
    expect(
      thuCongToRow(
        {
          hoTen: "Lan",
          email: "lan@example.com",
          sdt: "0901234567",
          guiEmail: false,
          dongYNhanTin: false,
        },
        "MO-ABC234",
      ).sdt,
    ).toBe("0901234567");
  });

  /**
   * Điểm quan trọng nhất của cả bộ dựng này. `trang_thai` và `nguon_biet_den`
   * là field PHÂN KHÚC có kiểu: nhét "--" hay chọn đại một giá trị thật vào đây
   * là làm hỏng đúng phép đo mà phân khúc sinh ra để làm. Để trống mới đúng.
   */
  it("KHÔNG bịa giá trị cho field phân khúc — để null", () => {
    expect(row.trang_thai).toBeNull();
    expect(row.nguon_biet_den).toBeNull();
    expect(row.chu_de_quan_tam).toEqual([]);
  });

  it("toàn bộ thông tin bé để trống", () => {
    expect(row.thai_tuan).toBeNull();
    expect(row.ten_be).toBeNull();
    expect(row.be_ngay_sinh).toBeNull();
    expect(row.be_gioi_tinh).toBeNull();
    expect(row.be_thang_tuoi).toBeNull();
    expect(row.facebook).toBeNull();
    expect(row.chu_de_khac).toBeNull();
  });

  it("dong_y_nhan_tin bám theo ô tick, không tự bật", () => {
    expect(row.dong_y_nhan_tin).toBe(false);
    expect(
      thuCongToRow(
        { hoTen: "Lan", email: "lan@example.com", sdt: "", guiEmail: false, dongYNhanTin: true },
        "MO-ABC234",
      ).dong_y_nhan_tin,
    ).toBe(true);
  });

  // `nguon` giữ "su-kien" chứ không thêm giá trị thứ ba: cột này mang hợp đồng
  // phân khúc su-kien vs app-waitlist. Dòng tạo tay nhận ra bằng các ô "--".
  it("nguon vẫn là su-kien", () => {
    expect(row.nguon).toBe("su-kien");
    expect(row.di_cung_chong).toBe(false);
  });

  /**
   * Bộ dựng KHÔNG được trả về cột check-in. `insert` gửi nguyên object này, nên
   * một cột `checked_in: false` lọt vào đây là ghi đè dấu check-in — cùng cái
   * bẫy mà `registrationToRow` đã né (xem doc của nó).
   */
  it("không đụng tới các cột check-in", () => {
    expect(row).not.toHaveProperty("checked_in");
    expect(row).not.toHaveProperty("checked_in_at");
    expect(row).not.toHaveProperty("checked_in_source");
  });
});
