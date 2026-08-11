import { describe, expect, it } from "vitest";
import {
  byteCuaBase64,
  coChu,
  duoiFile,
  loiDinhKem,
  TOI_DA_TONG_BYTE,
  type DinhKem,
} from "./dinh-kem";

/** Chuỗi base64 mã hoá đúng `n` byte, để dựng file có dung lượng biết trước. */
const base64CuaByte = (n: number) => Buffer.alloc(n, 0x61).toString("base64");

const file = (name: string, byte = 10): DinhKem => ({
  name,
  content: base64CuaByte(byte),
});

describe("duoiFile", () => {
  it("lấy đuôi, viết thường", () => {
    expect(duoiFile("poster.PNG")).toBe("png");
    expect(duoiFile("lich trinh.final.pdf")).toBe("pdf");
  });

  it("không có đuôi → chuỗi rỗng", () => {
    expect(duoiFile("README")).toBe("");
    expect(duoiFile(".gitignore")).toBe("");
  });
});

describe("byteCuaBase64", () => {
  it("tính đúng số byte thật, kể cả khi có ký tự đệm", () => {
    expect(byteCuaBase64(Buffer.from("abc").toString("base64"))).toBe(3); // không đệm
    expect(byteCuaBase64(Buffer.from("ab").toString("base64"))).toBe(2); // một dấu =
    expect(byteCuaBase64(Buffer.from("a").toString("base64"))).toBe(1); // hai dấu ==
  });

  it("chuỗi rỗng → 0", () => {
    expect(byteCuaBase64("")).toBe(0);
  });
});

describe("loiDinhKem", () => {
  it("danh sách rỗng là hợp lệ — không đính kèm gì cũng là một lựa chọn", () => {
    expect(loiDinhKem([])).toBeNull();
  });

  it("đuôi cho phép thì qua", () => {
    expect(loiDinhKem([file("poster.png"), file("lich-trinh.pdf")])).toBeNull();
  });

  it("đuôi viết HOA vẫn qua — admin không phải đổi tên file", () => {
    expect(loiDinhKem([file("POSTER.PNG")])).toBeNull();
  });

  /**
   * Hai đuôi này là cái bẫy thật: .heic là định dạng ảnh mặc định của iPhone,
   * .webp là thứ trình duyệt lưu ra khi bấm "lưu ảnh". Brevo từ chối cả hai —
   * nhưng chỉ từ chối lúc GỬI, tức là đúng lúc admin vừa bấm "Gửi cho 500 mẹ".
   */
  it("chặn .webp và .heic, nêu ĐÚNG tên file trong câu lỗi", () => {
    expect(loiDinhKem([file("poster.webp")])).toContain("poster.webp");
    expect(loiDinhKem([file("anh.heic")])).toContain("anh.heic");
  });

  it("file không có đuôi → chặn, nêu tên file", () => {
    expect(loiDinhKem([file("README")])).toContain("README");
  });

  it("file rỗng → chặn, nêu tên file", () => {
    expect(loiDinhKem([{ name: "trong.png", content: "" }])).toContain("trong.png");
  });

  it("đúng bằng trần thì qua, hơn một byte thì chặn", () => {
    expect(loiDinhKem([file("vua-du.png", TOI_DA_TONG_BYTE)])).toBeNull();
    expect(loiDinhKem([file("qua-han.png", TOI_DA_TONG_BYTE + 1)])).not.toBeNull();
  });

  it("chặn theo TỔNG, không theo từng file", () => {
    const phanLon = Math.floor(TOI_DA_TONG_BYTE * 0.6);
    expect(loiDinhKem([file("a.png", phanLon)])).toBeNull();
    expect(loiDinhKem([file("a.png", phanLon), file("b.png", phanLon)])).not.toBeNull();
  });
});

describe("coChu", () => {
  it("dưới 1MB hiện KB, từ 1MB hiện MB", () => {
    expect(coChu(500 * 1024)).toBe("500 KB");
    expect(coChu(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});
