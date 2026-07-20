import { describe, it, expect } from "vitest";
import { isValidCheckinCode } from "@/lib/validation";

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

import { thangTuoiTuNgaySinh } from "./validation";

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
