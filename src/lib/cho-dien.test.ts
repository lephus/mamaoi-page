import { describe, expect, it } from "vitest";
import { choDienLa } from "@/lib/cho-dien";

describe("choDienLa", () => {
  it("chỗ điền hợp lệ → mảng rỗng", () => {
    expect(choDienLa("Chào chị {{ten}}, mã của chị là {{ma}}.")).toEqual([]);
    expect(choDienLa("{{ten}}")).toEqual([]);
    expect(choDienLa("{{ma}}")).toEqual([]);
  });

  it("không có chỗ điền nào → mảng rỗng", () => {
    expect(choDienLa("Sự kiện đổi địa điểm sang ThiSkyHall Sala.")).toEqual([]);
    expect(choDienLa("")).toEqual([]);
  });

  /**
   * Ca này là lý do cả hàm tồn tại: gõ {{name}} thay vì {{ten}} mà không ai
   * chặn thì 500 mẹ nhận email mở đầu bằng "Chào chị {{name}}" — lỗi không
   * sửa lại được sau khi email đã đi.
   */
  it("chỗ điền lạ → trả nguyên văn token để báo đúng chỗ sai", () => {
    expect(choDienLa("Chào {{name}}")).toEqual(["{{name}}"]);
    expect(choDienLa("{{ho_ten}} và {{code}}")).toEqual(["{{ho_ten}}", "{{code}}"]);
  });

  /**
   * KHÔNG bỏ qua khoảng trắng, có chủ ý. Chấp nhận `{{ ten }}` nghĩa là phải
   * đồng bộ luật cắt khoảng trắng giữa chỗ KIỂM và chỗ THAY thật; lệch nhau ở
   * đó là 500 email mang chữ `{{ ten }}` nguyên si.
   */
  it("có khoảng trắng trong ngoặc → coi là sai", () => {
    expect(choDienLa("{{ ten }}")).toEqual(["{{ ten }}"]);
    expect(choDienLa("{{ten }}")).toEqual(["{{ten }}"]);
  });

  it("ngoặc rỗng → coi là sai", () => {
    expect(choDienLa("{{}}")).toEqual(["{{}}"]);
  });

  it("lọc đúng cái sai, giữ nguyên cái đúng", () => {
    expect(choDienLa("{{a}} {{ten}} {{b}} {{ma}}")).toEqual(["{{a}}", "{{b}}"]);
  });

  it("một token sai xuất hiện hai lần thì báo hai lần", () => {
    expect(choDienLa("{{x}} rồi {{x}}")).toEqual(["{{x}}", "{{x}}"]);
  });
});
