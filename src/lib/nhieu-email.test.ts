import { describe, expect, it } from "vitest";
import { tachEmail } from "./nhieu-email";

describe("tachEmail", () => {
  it("tách được cả bốn kiểu dấu ngăn", () => {
    expect(tachEmail("a@x.vn, b@x.vn").hopLe).toEqual(["a@x.vn", "b@x.vn"]);
    expect(tachEmail("a@x.vn; b@x.vn").hopLe).toEqual(["a@x.vn", "b@x.vn"]);
    expect(tachEmail("a@x.vn\nb@x.vn").hopLe).toEqual(["a@x.vn", "b@x.vn"]);
    expect(tachEmail("a@x.vn b@x.vn").hopLe).toEqual(["a@x.vn", "b@x.vn"]);
  });

  it("chuỗi trộn nhiều kiểu dấu — admin dán từ Excel rồi gõ thêm tay", () => {
    expect(tachEmail("a@x.vn,\n  b@x.vn ;c@x.vn").hopLe).toEqual([
      "a@x.vn",
      "b@x.vn",
      "c@x.vn",
    ]);
  });

  it("giữ nguyên thứ tự admin gõ", () => {
    expect(tachEmail("z@x.vn, a@x.vn, m@x.vn").hopLe).toEqual([
      "z@x.vn",
      "a@x.vn",
      "m@x.vn",
    ]);
  });

  it("bỏ trùng, không phân biệt hoa thường — một hộp thư không nhận hai bản", () => {
    expect(tachEmail("A@x.vn, a@x.vn, a@X.VN").hopLe).toEqual(["A@x.vn"]);
  });

  it("tách riêng địa chỉ sai, giữ nguyên văn để admin dò được", () => {
    const { hopLe, sai } = tachEmail("tot@x.vn, thieu-a-cong, cung-tot@y.vn");
    expect(hopLe).toEqual(["tot@x.vn", "cung-tot@y.vn"]);
    expect(sai).toEqual(["thieu-a-cong"]);
  });

  it("bỏ trùng cả ở danh sách sai — liệt kê một chuỗi hỏng hai lần chỉ là nhiễu", () => {
    expect(tachEmail("hong, hong").sai).toEqual(["hong"]);
  });

  it("chuỗi rỗng và chuỗi toàn dấu ngăn → hai mảng rỗng", () => {
    expect(tachEmail("")).toEqual({ hopLe: [], sai: [] });
    expect(tachEmail("  ,,\n; ")).toEqual({ hopLe: [], sai: [] });
  });
});
