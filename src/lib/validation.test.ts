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
