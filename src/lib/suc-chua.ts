import { SUC_CHUA_MAC_DINH } from "./constants";

/**
 * Sức chứa sự kiện + cách route phản ứng với kết quả giữ chỗ.
 *
 * Tách khỏi `supabase.ts` và `route.ts` để test được toàn bộ phần quyết định mà
 * không cần Postgres thật — repo chạy vitest ở env `node`, không có DB trong test.
 */

/**
 * Giới hạn chỗ đang áp dụng.
 *
 * `raw` truyền vào chứ không đọc thẳng `process.env` bên trong: test cần thử
 * từng giá trị mà không phải ghi đè biến môi trường toàn cục. Route gọi
 * `sucChua()` không tham số và lấy đúng env.
 *
 * Mọi giá trị không phải số nguyên dương đều rơi về mặc định — xem test để biết
 * vì sao NaN ở đây là lỗi im lặng chứ không phải lỗi ồn ào.
 */
export function sucChua(raw: string | undefined = process.env.EVENT_CAPACITY): number {
  const s = raw?.trim();
  // Chặn "5.5" / "1e3" / "500 mẹ": parseInt nuốt phần đuôi và trả về số sai.
  // Chỉ nhận chuỗi TOÀN chữ số.
  if (!s || !/^\d+$/.test(s)) return SUC_CHUA_MAC_DINH;
  const n = Number.parseInt(s, 10);
  return n > 0 ? n : SUC_CHUA_MAC_DINH;
}

/** Kết quả một lượt giữ chỗ — ba giá trị đầu do function `giu_cho_dang_ky` trả về. */
export type KetQuaGiuCho =
  | "moi"
  | "da_dang_ky"
  | "het_cho"
  | "loi"
  | "khong_cau_hinh"
  | (string & {});

export type QuyetDinh =
  /** Trả 409, không chạy bước nào phía sau — mẹ KHÔNG được gửi email xác nhận. */
  | { chan: true }
  /** Đi tiếp. `ghiLai` = route có phải gọi `insertRegistration` nữa không. */
  | { chan: false; ghiLai: boolean };

export function quyetDinhSucChua(ket: KetQuaGiuCho): QuyetDinh {
  switch (ket) {
    case "het_cho":
      return { chan: true };
    // RPC đã insert xong trong chính transaction giữ chỗ. Gọi thêm upsert ở
    // route là một lượt ghi thừa ngay sau lượt vừa xong.
    case "moi":
      return { chan: false, ghiLai: false };
    // Mẹ gửi lại form (vd. sửa số điện thoại). RPC cố tình không đụng dòng cũ,
    // nên upsert ở route mới là chỗ làm mới thông tin.
    case "da_dang_ky":
      return { chan: false, ghiLai: true };
    // Chưa cấu hình Supabase (dev): không có gì để đếm và cũng không có gì để ghi.
    case "khong_cau_hinh":
      return { chan: false, ghiLai: false };
    // "loi" và mọi chuỗi lạ: fail open. Không đọc được sức chứa là sự cố của
    // mình, không phải lỗi của mẹ — vẫn cố ghi để dòng kịp vào bảng nếu DB
    // chỉ chập một nhịp; hỏng nữa thì route ghi warnings["supabase"].
    default:
      return { chan: false, ghiLai: true };
  }
}
