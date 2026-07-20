import { describe, it, expect } from "vitest";
import { rowsToSheet } from "@/lib/export-rows";
import { registrationToSheetRow, VALUE_INPUT_OPTION } from "@/lib/sheets";
import type { Registration } from "@/lib/validation";

const HEADERS = rowsToSheet([]).headers;

/** Đọc ô theo tên cột — test không phụ thuộc thứ tự cột. */
const at = (row: (string | number)[], header: string) => row[HEADERS.indexOf(header)];

const base: Registration = {
  nguon: "su-kien",
  hoTen: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  facebook: "",
  tinhThanh: "TP.HCM",
  trangThai: "mang_thai",
  beThangTuoi: undefined,
  diCungChong: true,
  dongYNhanTin: true,
};

describe("registrationToSheetRow", () => {
  it("số ô khớp số cột của header", () => {
    expect(registrationToSheetRow(base, "MO-23456A")).toHaveLength(HEADERS.length);
  });

  it("mẹ mang thai: 'Mang thai', cột tháng tuổi rỗng", () => {
    const row = registrationToSheetRow(base, "MO-23456A");
    expect(at(row, "Tình trạng")).toBe("Mang thai");
    expect(at(row, "Bé (tháng tuổi)")).toBe("");
  });

  it("mẹ đã sinh: 'Đã sinh' kèm số tháng", () => {
    const row = registrationToSheetRow(
      { ...base, trangThai: "da_sinh", beThangTuoi: 6 },
      "MO-23456A",
    );
    expect(at(row, "Tình trạng")).toBe("Đã sinh");
    expect(at(row, "Bé (tháng tuổi)")).toBe(6);
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
