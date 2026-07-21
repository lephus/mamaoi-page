import { describe, it, expect } from "vitest";
import { rowsToSheet, waitlistToSheet } from "@/lib/export-rows";
import {
  buildCheckinUpdate,
  colLetter,
  findCheckinRows,
  registrationToSheetRow,
  VALUE_INPUT_OPTION,
  waitlistToSheetRow,
} from "@/lib/sheets";
import type { Registration } from "@/lib/validation";

const HEADERS = rowsToSheet([]).headers;
const WAITLIST_HEADERS = waitlistToSheet([]).headers;
/** Đọc ô waitlist theo tên cột — test không phụ thuộc thứ tự cột. */
const wat = (row: (string | number)[], header: string) =>
  row[WAITLIST_HEADERS.indexOf(header)];

/** Đọc ô theo tên cột — test không phụ thuộc thứ tự cột. */
const at = (row: (string | number)[], header: string) => row[HEADERS.indexOf(header)];

const chung = {
  nguon: "su-kien" as const,
  hoTen: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  facebook: "",
  tinhThanh: "TP.HCM",
  chuDeQuanTam: ["an_dam", "ngu"],
  nguonBietDen: "facebook",
  diCungChong: true,
  dongYNhanTin: true as const,
};

const base = { ...chung, trangThai: "mang_thai", thaiTuan: 20 } as Registration;
const daSinh = {
  ...chung,
  trangThai: "da_sinh",
  tenBe: "Gạo",
  beNgaySinh: new Date("2026-01-20"),
  beGioiTinh: "nu",
} as Registration;

describe("registrationToSheetRow", () => {
  it("số ô khớp số cột của header", () => {
    expect(registrationToSheetRow(base, "MO-23456A")).toHaveLength(HEADERS.length);
  });

  it("mẹ mang thai: 'Mang thai', cột bé rỗng, có số tuần thai", () => {
    const row = registrationToSheetRow(base, "MO-23456A");
    expect(at(row, "Tình trạng")).toBe("Mang thai");
    expect(at(row, "Bé (tháng tuổi)")).toBe("");
    expect(at(row, "Tên bé")).toBe("");
    expect(at(row, "Thai (tuần)")).toBe(20);
  });

  it("mẹ đã sinh: 'Đã sinh' kèm thông tin bé, cột tuần thai rỗng", () => {
    const row = registrationToSheetRow(daSinh, "MO-23456A");
    expect(at(row, "Tình trạng")).toBe("Đã sinh");
    expect(at(row, "Tên bé")).toBe("Gạo");
    expect(at(row, "Giới tính bé")).toBe("Nữ");
    expect(at(row, "Ngày sinh bé")).toBe("20/01/2026");
    expect(at(row, "Thai (tuần)")).toBe("");
  });

  it("chủ đề quan tâm nối bằng nhãn tiếng Việt", () => {
    expect(at(registrationToSheetRow(base, "MO-23456A"), "Chủ đề quan tâm")).toBe(
      "Ăn dặm, Ngủ",
    );
  });

  it("không có Facebook thành chuỗi rỗng, không phải null hay 'null'", () => {
    const row = registrationToSheetRow(base, "MO-23456A");
    expect(at(row, "Facebook")).toBe("");
    expect(row).not.toContain(null);
    expect(row).not.toContain("null");
  });

  it("không đi cùng chồng thành dấu gạch", () => {
    const row = registrationToSheetRow({ ...base, diCungChong: false }, "MO-23456A");
    expect(at(row, "Đi cùng chồng")).toBe("—");
  });

  it("mã check-in vào đúng cột", () => {
    const row = registrationToSheetRow(base, "MO-ZYXW98");
    expect(at(row, "Mã check-in")).toBe("MO-ZYXW98");
  });

  // Khẳng định quyết định của spec bằng test, không chỉ bằng lời:
  // Sheet là bản ghi thô lúc đăng ký, không bao giờ biết ai đã check-in.
  it("ba cột check-in luôn rỗng", () => {
    const row = registrationToSheetRow(base, "MO-23456A");
    expect(at(row, "Đã check-in")).toBe("—");
    expect(at(row, "Giờ check-in")).toBe("");
    expect(at(row, "Nguồn check-in")).toBe("");
  });
});

describe("waitlistToSheetRow", () => {
  it("số ô khớp số cột header waitlist", () => {
    expect(waitlistToSheetRow("me@example.com", true)).toHaveLength(
      WAITLIST_HEADERS.length,
    );
  });

  it("email vào đúng cột", () => {
    expect(wat(waitlistToSheetRow("me@example.com", true), "Email")).toBe(
      "me@example.com",
    );
  });

  it("đồng ý nhận tin: true → 'Có', false → '—'", () => {
    expect(wat(waitlistToSheetRow("me@example.com", true), "Đồng ý nhận tin")).toBe(
      "Có",
    );
    expect(wat(waitlistToSheetRow("me@example.com", false), "Đồng ý nhận tin")).toBe(
      "—",
    );
  });

  it("có thời điểm đăng ký, không rỗng", () => {
    expect(
      wat(waitlistToSheetRow("me@example.com", true), "Thời điểm đăng ký"),
    ).toBeTruthy();
  });

  it("không có ô null hay chuỗi 'null'", () => {
    const row = waitlistToSheetRow("me@example.com", false);
    expect(row).not.toContain(null);
    expect(row).not.toContain("null");
  });
});

describe("colLetter", () => {
  it("0→A, 16→Q (mã), 19→T (đã check-in), 25→Z, 26→AA", () => {
    expect(colLetter(0)).toBe("A");
    expect(colLetter(16)).toBe("Q");
    expect(colLetter(19)).toBe("T");
    expect(colLetter(25)).toBe("Z");
    expect(colLetter(26)).toBe("AA");
  });
});

describe("findCheckinRows", () => {
  // values.get trả từ dòng 1: [ghi chú], [header], [dữ liệu...]. Số dòng là 1-based.
  const col = [[""], ["Mã check-in"], ["MO-23456A"], ["MO-BCDEFG"]];

  it("trả mảng số dòng A1 (1-based) của mã", () => {
    expect(findCheckinRows(col, "MO-BCDEFG")).toEqual([4]);
    expect(findCheckinRows(col, "MO-23456A")).toEqual([3]);
  });

  it("mã trùng ở nhiều dòng (đăng ký lại giữ mã) → trả HẾT các dòng", () => {
    const dup = [[""], ["Mã check-in"], ["MO-23456A"], ["MO-BCDEFG"], ["MO-23456A"]];
    expect(findCheckinRows(dup, "MO-23456A")).toEqual([3, 5]);
  });

  it("bỏ qua hoa/thường và khoảng trắng thừa", () => {
    expect(findCheckinRows(col, "  mo-bcdefg  ")).toEqual([4]);
  });

  it("không thấy mã → mảng rỗng", () => {
    expect(findCheckinRows(col, "MO-ZZZZZZ")).toEqual([]);
  });

  it("chịu được ô rỗng / dòng thiếu do Google lược bỏ", () => {
    expect(findCheckinRows([[], undefined, ["MO-23456A"]], "MO-23456A")).toEqual([3]);
  });
});

describe("buildCheckinUpdate", () => {
  const HEADERS = rowsToSheet([]).headers;
  const iso = "2026-08-30T02:15:00.000Z"; // 09:15 30/08/2026 giờ VN

  it("ghi ĐÚNG ba ô check-in của dòng, giá trị khớp file Excel", () => {
    const byRange = Object.fromEntries(
      buildCheckinUpdate("register", HEADERS, 5, iso, "qr").map((d) => [
        d.range,
        d.values[0][0],
      ]),
    );
    expect(byRange["register!T5"]).toBe("Có");
    expect(byRange["register!U5"]).toBe("09:15 30/08/2026");
    expect(byRange["register!V5"]).toBe("qr");
  });

  it("chỉ đụng đúng ba cột check-in, không hơn", () => {
    expect(buildCheckinUpdate("register", HEADERS, 5, iso, "qr")).toHaveLength(3);
  });

  it("giá trị khớp cột 'Đã check-in' của rowsToSheet (một nguồn định dạng)", () => {
    const excel = rowsToSheet([
      {
        id: "",
        created_at: iso,
        checkin_code: "MO-23456A",
        ho_ten: "x",
        email: "x",
        sdt: "x",
        facebook: null,
        tinh_thanh: "x",
        trang_thai: "mang_thai",
        thai_tuan: 20,
        ten_be: null,
        be_ngay_sinh: null,
        be_gioi_tinh: null,
        be_thang_tuoi: null,
        chu_de_quan_tam: [],
        chu_de_khac: null,
        nguon_biet_den: "facebook",
        di_cung_chong: false,
        dong_y_nhan_tin: true,
        nguon: "su-kien",
        checked_in: true,
        checked_in_at: iso,
        checked_in_source: "qr",
      },
    ]);
    const gio = excel.rows[0][excel.headers.indexOf("Giờ check-in")];
    const byRange = Object.fromEntries(
      buildCheckinUpdate("register", HEADERS, 5, iso, "qr").map((d) => [
        d.range,
        d.values[0][0],
      ]),
    );
    expect(byRange["register!U5"]).toBe(gio);
  });

  it("cột bị đổi tên → ném lỗi thay vì ghi nhầm ô", () => {
    expect(() => buildCheckinUpdate("register", ["x", "y"], 5, iso, "qr")).toThrow();
  });
});

describe("VALUE_INPUT_OPTION", () => {
  // Không mock fetch/crypto.subtle — chỉ khẳng định hằng số dùng để append.
  // RAW bắt buộc vì hai lý do: (1) chặn injection công thức từ họ tên nhập
  // tự do (vd. "=IMPORTXML(...)" sẽ CHẠY nếu dùng USER_ENTERED), và (2) giữ
  // số 0 đầu của số điện thoại Việt Nam ("0901234567" không bị rụng số 0).
  it("phải là RAW để chặn injection công thức và giữ số 0 đầu SĐT, không được là USER_ENTERED", () => {
    expect(VALUE_INPUT_OPTION).toBe("RAW");
    expect(VALUE_INPUT_OPTION).not.toBe("USER_ENTERED");
  });
});
