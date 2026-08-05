import { describe, expect, it } from "vitest";
import { maTuQr } from "@/lib/ma-tu-qr";

const MA = "MO-ABC234";

describe("maTuQr", () => {
  it("rút mã từ URL check-in đầy đủ — dạng QR thật trong email", () => {
    expect(maTuQr(`https://mamaoi.vn/check-in/${MA}`)).toBe(MA);
  });

  it("chịu được query, hash và dấu / thừa ở cuối", () => {
    expect(maTuQr(`https://mamaoi.vn/check-in/${MA}/`)).toBe(MA);
    expect(maTuQr(`https://mamaoi.vn/check-in/${MA}?utm=mail`)).toBe(MA);
    expect(maTuQr(`https://mamaoi.vn/check-in/${MA}#ve`)).toBe(MA);
  });

  it("nhận cả mã trần, phòng QR do nơi khác sinh", () => {
    expect(maTuQr(MA)).toBe(MA);
  });

  it("chuẩn hoá chữ thường và khoảng trắng thừa", () => {
    expect(maTuQr("  mo-abc234  ")).toBe(MA);
    expect(maTuQr(`  https://mamaoi.vn/check-in/${MA.toLowerCase()}  `)).toBe(MA);
  });

  /**
   * CÓ CHỦ ĐÍCH: không kiểm tên miền. Mã mới là vé, tên miền chỉ là trang trí —
   * ai dựng được QR với một mã THẬT thì đã biết mã đó rồi, và có thể đọc miệng
   * cho nhân viên gõ tay. Đổi lại, kiểm tên miền sẽ làm QR sinh trên bản prod
   * quét trên bản preview (vercel.app) là hỏng — đúng lúc đang đi thử máy.
   */
  it("không kiểm tên miền — mã vẫn được rút ra", () => {
    expect(maTuQr(`https://preview-abc.vercel.app/check-in/${MA}`)).toBe(MA);
  });

  it("URL của trang khác trên chính site → null", () => {
    expect(maTuQr("https://mamaoi.vn/su-kien")).toBeNull();
    expect(maTuQr(`https://mamaoi.vn/${MA}`)).toBeNull();
  });

  /* "check-in" nằm trong query chứ không phải đoạn cuối đường dẫn — đây là ca
     mà một phép dò chuỗi "/check-in/" ngây thơ sẽ nuốt nhầm. */
  it("URL lồng mã trong query → null", () => {
    expect(maTuQr(`https://mamaoi.vn/x?next=/check-in/${MA}`)).toBeNull();
  });

  it("QR rác ở quầy (wifi, chuỗi lạ, rỗng) → null, không ném lỗi", () => {
    expect(maTuQr("WIFI:S:MamaOi;T:WPA;P:12345678;;")).toBeNull();
    expect(maTuQr("")).toBeNull();
    expect(maTuQr("   ")).toBeNull();
    expect(maTuQr("xin chào")).toBeNull();
  });

  it("mã sai bảng chữ (có I, O, 0, 1) → null", () => {
    expect(maTuQr("MO-ABC23I")).toBeNull();
    expect(maTuQr("https://mamaoi.vn/check-in/MO-ABC230")).toBeNull();
  });

  it("mã sai độ dài → null", () => {
    expect(maTuQr("MO-ABC23")).toBeNull();
    expect(maTuQr("MO-ABC2345")).toBeNull();
  });
});
