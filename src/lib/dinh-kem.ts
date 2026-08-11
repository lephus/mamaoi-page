/**
 * File đính kèm cho email gửi hàng loạt: kiểu dữ liệu, danh mục đuôi được phép,
 * và phép kiểm.
 *
 * File này CỐ Ý không import gì — cùng lý do đã ghi ở đầu `cho-dien.ts`:
 * `brevo.ts` kéo theo nodemailer và qrcode (thuần server), import nó vào một
 * component "use client" là gãy build. Màn hình soạn mail phải báo file sai NGAY
 * lúc admin chọn file, nên phép kiểm phải sống được ở client.
 *
 * Route gọi lại ĐÚNG hàm này. Client kiểm để phản hồi nhanh, server kiểm để
 * quyết định — nhưng cả hai đọc chung một bộ luật nên không bao giờ lệch nhau.
 */

/** Một file đính kèm. `content` là base64 THUẦN, đã bỏ tiền tố `data:...;base64,`. */
export type DinhKem = { name: string; content: string };

/**
 * Đuôi file Brevo chấp nhận, thu hẹp về tập BTC dùng thật.
 *
 * `.webp` và `.heic` CỐ Ý vắng mặt: Brevo không nhận, mà đó lại là hai đuôi dễ
 * gặp nhất — `.heic` là định dạng ảnh mặc định của iPhone, `.webp` là thứ trình
 * duyệt lưu ra khi bấm "lưu ảnh". Chặn ở đây kèm gợi ý đổi sang .png/.jpg thì
 * admin biết ngay; để lọt thì Brevo từ chối vào đúng lúc admin vừa bấm gửi thật.
 */
export const DUOI_CHO_PHEP = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "txt",
  "zip",
] as const;

/**
 * Trần cứng do nền tảng, không phải con số chọn cho đẹp: body request tới một
 * serverless function trên Vercel tối đa 4.5MB, mà base64 làm dữ liệu phồng 1.37
 * lần — 3MB file thật ≈ 4.1MB body, còn chừa chỗ cho tiêu đề, nội dung, danh
 * sách id. Vượt ngưỡng này là request bị NỀN TẢNG chặn trước khi code chạy, và
 * admin nhận về một lỗi mạng vô nghĩa thay vì câu giải thích.
 */
export const TOI_DA_TONG_BYTE = 3 * 1024 * 1024;

const GOI_Y = DUOI_CHO_PHEP.map((d) => `.${d}`).join(", ");

/** Đuôi file, viết thường, không kèm dấu chấm. Chuỗi rỗng nếu tên không có đuôi. */
export function duoiFile(name: string): string {
  const i = name.lastIndexOf(".");
  // `i < 1` gộp hai ca: không có dấu chấm nào, và tên kiểu ".gitignore" (dấu
  // chấm ở đầu là phần của tên, không phải đuôi).
  return i < 1 ? "" : name.slice(i + 1).toLowerCase();
}

/**
 * Số byte THẬT của một chuỗi base64.
 *
 * Mỗi 4 ký tự base64 mã hoá 3 byte, và mỗi dấu `=` ở cuối là một byte đệm không
 * có thật. Lấy `content.length * 0.75` mà quên trừ `=` sẽ đếm dư — không chết
 * ai, nhưng phép so với trần 3MB phải đúng thì câu lỗi mới đáng tin.
 */
export function byteCuaBase64(content: string): number {
  if (content.length === 0) return 0;
  const dem_bang = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0;
  return Math.floor(content.length / 4) * 3 - dem_bang;
}

/** Byte → chuỗi hiển thị. Dùng chung cho câu lỗi và danh sách file trên màn hình. */
export function coChu(byte: number): string {
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Kiểm cả danh sách. Trả câu lỗi tiếng Việt nêu ĐÚNG tên file sai, hoặc `null`
 * nếu sạch. Danh sách rỗng là hợp lệ — không đính kèm gì cũng là một lựa chọn.
 *
 * Trả câu lỗi ĐẦU TIÊN gặp chứ không gom hết: admin sửa từng file một, và một
 * đoạn văn liệt kê năm lỗi cùng lúc khó đọc hơn năm lần sửa từng lỗi rõ ràng.
 */
export function loiDinhKem(ds: DinhKem[]): string | null {
  let tong = 0;

  for (const f of ds) {
    const ten = f.name.trim();
    if (!ten) return "Có file thiếu tên. Chọn lại.";

    const duoi = duoiFile(ten);
    if (!duoi) {
      return `Không gửi được "${ten}": file không có đuôi. Dùng một trong: ${GOI_Y}.`;
    }
    if (!(DUOI_CHO_PHEP as readonly string[]).includes(duoi)) {
      return `Không gửi được "${ten}": đuôi .${duoi} không được hỗ trợ. Dùng một trong: ${GOI_Y}.`;
    }

    const byte = byteCuaBase64(f.content);
    if (byte <= 0) return `Không gửi được "${ten}": file rỗng.`;
    tong += byte;
  }

  if (tong > TOI_DA_TONG_BYTE) {
    return `Tổng dung lượng đính kèm ${coChu(tong)}, vượt giới hạn ${coChu(
      TOI_DA_TONG_BYTE,
    )}. Bỏ bớt file hoặc nén ảnh nhỏ lại.`;
  }

  return null;
}
