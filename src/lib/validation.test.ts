import { describe, it, expect, afterEach, vi } from "vitest";
import {
  isValidCheckinCode,
  thangTuoiTuNgaySinh,
  registrationSchema,
} from "@/lib/validation";
import { CHU_DE_VALUES } from "./constants";

describe("isValidCheckinCode", () => {
  it("chấp nhận mã đúng định dạng", () => {
    expect(isValidCheckinCode("MO-23456A")).toBe(true);
    expect(isValidCheckinCode("MO-ABCDEF")).toBe(true);
  });
  it("từ chối ký tự cấm (I, O, 0, 1) và sai định dạng", () => {
    expect(isValidCheckinCode("MO-ABCDEI")).toBe(false); // I
    expect(isValidCheckinCode("MO-ABCDEO")).toBe(false); // O
    expect(isValidCheckinCode("MO-012345")).toBe(false); // 0,1
    expect(isValidCheckinCode("mo-23456a")).toBe(false); // thường
    expect(isValidCheckinCode("MO-2345")).toBe(false);   // ngắn
    expect(isValidCheckinCode("23456A")).toBe(false);    // thiếu tiền tố
  });
});

describe("thangTuoiTuNgaySinh", () => {
  it("tròn tháng", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-01-20"), new Date("2026-07-20")),
    ).toBe(6);
  });

  it("chưa tới ngày trong tháng thì chưa tính tháng đó", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-01-25"), new Date("2026-07-20")),
    ).toBe(5);
  });

  it("cùng tháng trả 0", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-07-01"), new Date("2026-07-20")),
    ).toBe(0);
  });

  it("qua năm", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2024-07-20"), new Date("2026-07-20")),
    ).toBe(24);
  });

  it("ngày sinh ở tương lai trả số âm (caller tự chặn)", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-08-20"), new Date("2026-07-20")),
    ).toBe(-1);
  });
});

const chung = {
  nguon: "su-kien" as const,
  hoTen: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  tinhThanh: "TP. Hồ Chí Minh",
  chuDeQuanTam: ["an_dam", "ngu"],
  nguonBietDen: "facebook",
  diCungChong: false,
  dongYNhanTin: true,
};

const mangThai = { ...chung, trangThai: "mang_thai" as const, thaiTuan: 20 };
const daSinh = {
  ...chung,
  trangThai: "da_sinh" as const,
  tenBe: "Gạo",
  beNgaySinh: "2026-01-20",
  beGioiTinh: "nu" as const,
};

describe("registrationSchema — nhánh mang_thai", () => {
  it("hợp lệ khi đủ thaiTuan", () => {
    expect(registrationSchema.safeParse(mangThai).success).toBe(true);
  });

  it("thiếu thaiTuan thì lỗi", () => {
    const { thaiTuan, ...thieu } = mangThai;
    expect(registrationSchema.safeParse(thieu).success).toBe(false);
  });

  it("thiếu thaiTuan báo đúng nguyên văn chuỗi khách duyệt, không phải chuỗi Zod tiếng Anh", () => {
    const { thaiTuan, ...thieu } = mangThai;
    const r = registrationSchema.safeParse(thieu);
    expect(r.success).toBe(false);
    expect(r.error?.issues.find((i) => i.path[0] === "thaiTuan")?.message).toBe(
      "Số tuần thai không hợp lệ",
    );
  });

  it("thaiTuan 0 hoặc 43 đều lỗi", () => {
    expect(registrationSchema.safeParse({ ...mangThai, thaiTuan: 0 }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...mangThai, thaiTuan: 43 }).success).toBe(false);
  });

  it("gửi kèm thông tin bé thì bị CẮT BỎ, không lưu", () => {
    const r = registrationSchema.safeParse({ ...mangThai, tenBe: "Gạo" });
    expect(r.success).toBe(true);
    expect(r.data).not.toHaveProperty("tenBe");
  });
});

describe("registrationSchema — nhánh da_sinh", () => {
  it("hợp lệ khi đủ thông tin bé", () => {
    expect(registrationSchema.safeParse(daSinh).success).toBe(true);
  });

  it("thiếu beNgaySinh thì lỗi", () => {
    const { beNgaySinh, ...thieu } = daSinh;
    expect(registrationSchema.safeParse(thieu).success).toBe(false);
  });

  it("thiếu tenBe thì lỗi", () => {
    const { tenBe, ...thieu } = daSinh;
    expect(registrationSchema.safeParse(thieu).success).toBe(false);
  });

  it("thiếu tenBe báo đúng nguyên văn chuỗi khách duyệt, không phải chuỗi Zod tiếng Anh", () => {
    const { tenBe, ...thieu } = daSinh;
    const r = registrationSchema.safeParse(thieu);
    expect(r.success).toBe(false);
    expect(r.error?.issues.find((i) => i.path[0] === "tenBe")?.message).toBe(
      "Vui lòng nhập tên bé",
    );
  });

  it("giới tính lạ thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...daSinh, beGioiTinh: "khac" }).success,
    ).toBe(false);
  });

  // Mốc giờ ghim cứng, KHÔNG dùng `Date.now()` thật: bản cũ lấy "ngày mai" theo
  // UTC làm đại diện cho tương lai, nhưng từ 00:00 tới 07:00 sáng giờ VN thì
  // "ngày mai theo UTC" CHÍNH LÀ hôm nay theo giờ VN — server nhận đúng còn test
  // lại đòi từ chối. Test đó đỏ mỗi ngày một lần, đúng 7 tiếng.
  it("ngày sinh ở tương lai thì lỗi", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T05:00:00Z")); // 12:00 trưa 15/07 giờ VN
    const mai = "2026-07-16";
    expect(registrationSchema.safeParse({ ...daSinh, beNgaySinh: mai }).success).toBe(false);
    vi.useRealTimers();
  });

  it("bé trên 36 tháng thì lỗi", () => {
    const qua = new Date();
    qua.setFullYear(qua.getFullYear() - 4);
    expect(
      registrationSchema.safeParse({ ...daSinh, beNgaySinh: qua.toISOString().slice(0, 10) })
        .success,
    ).toBe(false);
  });

  it("beNgaySinh parse ra Date", () => {
    const r = registrationSchema.safeParse(daSinh);
    expect(r.success && r.data.trangThai === "da_sinh" && r.data.beNgaySinh instanceof Date).toBe(true);
  });
});

describe("beNgaySinh — biên giờ VN, không phải UTC", () => {
  afterEach(() => vi.useRealTimers());

  // Client dùng `max={homNayVN()}` (giờ VN) cho input date. Server phải so
  // sánh cùng múi giờ đó — nếu không, từ 00:00 tới 07:00 sáng giờ VN, UTC vẫn
  // còn là hôm qua, và bé sinh đúng hôm nay (giờ VN) bị server chặn nhầm là
  // "ở tương lai" dù client đã cho phép chọn ngày đó.
  it("00:30 giờ VN (17:30 UTC hôm trước): bé sinh HÔM NAY giờ VN vẫn được chấp nhận", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T17:30:00Z")); // 00:30 sáng 21/07 giờ VN
    const r = registrationSchema.safeParse({ ...daSinh, beNgaySinh: "2026-07-21" });
    expect(r.success).toBe(true);
  });

  it("bé sinh NGÀY MAI giờ VN vẫn bị chặn dù vừa qua nửa đêm", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T17:30:00Z")); // 00:30 sáng 21/07 giờ VN
    const r = registrationSchema.safeParse({ ...daSinh, beNgaySinh: "2026-07-22" });
    expect(r.success).toBe(false);
  });
});

describe("registrationSchema — field chung", () => {
  it("chuDeQuanTam rỗng thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, chuDeQuanTam: [] }).success,
    ).toBe(false);
  });

  it("chuDeQuanTam có giá trị lạ thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, chuDeQuanTam: ["bay_bong"] }).success,
    ).toBe(false);
  });

  it("nhận được cả 9 chủ đề", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, chuDeQuanTam: [...CHU_DE_VALUES] }).success,
    ).toBe(true);
  });

  it("nguonBietDen lạ thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, nguonBietDen: "bao_giay" }).success,
    ).toBe(false);
  });

  it("không đồng ý nhận tin thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, dongYNhanTin: false }).success,
    ).toBe(false);
  });

  it("thiếu thành phố báo đúng nguyên văn chuỗi khách duyệt", () => {
    const r = registrationSchema.safeParse({ ...mangThai, tinhThanh: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.find((i) => i.path[0] === "tinhThanh")?.message).toBe(
      "Vui lòng chọn thành phố",
    );
  });
});

describe("chuDeKhac", () => {
  const base = {
    nguon: "su-kien",
    hoTen: "Nguyễn Thị An",
    email: "an@example.com",
    sdt: "0912345678",
    tinhThanh: "TP. Hồ Chí Minh",
    chuDeQuanTam: ["thai_ky"],
    nguonBietDen: "facebook",
    dongYNhanTin: true,
    trangThai: "mang_thai",
    thaiTuan: 20,
  };

  it("vắng mặt vẫn hợp lệ — field optional", () => {
    expect(registrationSchema.safeParse(base).success).toBe(true);
  });

  it("chuỗi rỗng vẫn hợp lệ", () => {
    expect(registrationSchema.safeParse({ ...base, chuDeKhac: "" }).success).toBe(true);
  });

  it("nhận nội dung tự do", () => {
    const r = registrationSchema.safeParse({ ...base, chuDeKhac: "Trầm cảm sau sinh" });
    expect(r.success).toBe(true);
    expect(r.data!.chuDeKhac).toBe("Trầm cảm sau sinh");
  });

  it("quá 200 ký tự bị chặn kèm message tiếng Việt", () => {
    const r = registrationSchema.safeParse({ ...base, chuDeKhac: "a".repeat(201) });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toBe("Chủ đề khác không được vượt quá 200 ký tự");
  });

  it("KHÔNG thay thế được ràng buộc chọn ít nhất một chủ đề", () => {
    const r = registrationSchema.safeParse({
      ...base,
      chuDeQuanTam: [],
      chuDeKhac: "Trầm cảm sau sinh",
    });
    expect(r.success).toBe(false);
  });
});

describe("facebook", () => {
  const base = {
    nguon: "su-kien",
    hoTen: "Nguyễn Thị An",
    email: "an@example.com",
    sdt: "0912345678",
    tinhThanh: "TP. Hồ Chí Minh",
    chuDeQuanTam: ["thai_ky"],
    nguonBietDen: "facebook",
    dongYNhanTin: true,
    trangThai: "mang_thai",
    thaiTuan: 20,
  };

  // URL Facebook kèm tracking param (fbclid/mibextid) dễ vượt 200 ký tự — đây
  // là lỗi thực tế mẹ sẽ gặp, không phải trường hợp biên lý thuyết.
  it("quá 200 ký tự bị chặn kèm message tiếng Việt, không phải chuỗi Zod tiếng Anh", () => {
    const r = registrationSchema.safeParse({
      ...base,
      facebook: "https://facebook.com/" + "a".repeat(200),
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toBe(
      "Link Facebook không được vượt quá 200 ký tự",
    );
  });
});

describe("discriminator trangThai", () => {
  it("bỏ trống trangThai trả message tiếng Việt, không phải chuỗi Zod tiếng Anh", () => {
    const r = registrationSchema.safeParse({ nguon: "su-kien", trangThai: null });
    expect(r.success).toBe(false);
    const issue = r.error!.issues.find((i) => i.path[0] === "trangThai");
    expect(issue?.message).toBe("Vui lòng chọn tình trạng hiện tại");
  });

  it("không lọt chuỗi tiếng Anh nào ra ngoài", () => {
    const r = registrationSchema.safeParse({});
    expect(r.success).toBe(false);
    for (const i of r.error!.issues) {
      expect(i.message).not.toMatch(/Invalid discriminator/);
    }
  });
});
