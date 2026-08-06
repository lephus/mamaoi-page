import { z } from "zod";
import { THIEU } from "./constants";
import type { RegistrationRow } from "./supabase";
import { VN_PHONE } from "./validation";

/**
 * Đăng ký ops TẠO TAY từ `/admin/them-dang-ky`, khi trong tay chỉ có **email +
 * họ tên**: mẹ đăng ký qua điện thoại/Zalo/quầy offline, hoặc lượt đăng ký thật
 * bị mất do sự cố.
 *
 * Cố ý KHÔNG đi qua `registrationSchema`. Schema đó bắt buộc SĐT khớp regex số
 * VN, tỉnh/thành, tình trạng, chủ đề quan tâm, nguồn biết đến — ép đường này qua
 * đó nghĩa là ops phải BỊA năm trường phân khúc, đúng thứ mà cả mô hình dữ liệu
 * "Membership First" sinh ra để chặn. Đây là một đường ghi riêng, hẹp, chỉ admin
 * gọi được, và nó nói thẳng ra rằng phần còn lại chưa hỏi.
 */

export const thuCongSchema = z.object({
  hoTen: z
    .string({ error: "Vui lòng nhập họ tên" })
    .trim()
    .min(2, "Vui lòng nhập họ tên")
    .max(80, "Họ tên không được vượt quá 80 ký tự"),

  /**
   * Trim + hạ chữ thường TRƯỚC khi kiểm định dạng — ngược thứ tự với
   * `registrationSchema` (`z.email().trim()`, tức kiểm trước rồi mới cắt).
   *
   * Có chủ đích: mẹ tự gõ email vào form, còn ops thì DÁN — từ Zalo, từ Excel,
   * từ một dòng chat — và bản dán rất hay mang theo khoảng trắng cuối. Kiểm
   * trước khi cắt sẽ báo "Email không hợp lệ" cho một email hoàn toàn đúng, và
   * ops không nhìn ra khoảng trắng đó để tự sửa.
   *
   * Chuẩn hoá về chữ thường cũng phải xong TRƯỚC khi route đi tra trùng: cổng
   * chặn trùng so khớp bằng email, "Lan@X.com" và "lan@x.com" mà lọt qua thành
   * hai mẹ khác nhau là cấp mã QR thứ hai cho cùng một người.
   */
  email: z
    .string({ error: "Email không hợp lệ" })
    .trim()
    .toLowerCase()
    .pipe(z.email("Email không hợp lệ")),

  /**
   * SĐT — TUỲ CHỌN. Bỏ trống thành `THIEU` ở `thuCongToRow`.
   *
   * Không bắt buộc vì ca gốc của cả tính năng này là "trong tay chỉ có email +
   * họ tên"; bắt buộc ở đây là đóng lại đúng cánh cửa vừa mở. Nhưng ĐÃ NHẬP thì
   * phải đúng, theo cùng `VN_PHONE` mà form công khai dùng: một số sai còn tệ
   * hơn ô trống, vì ops gọi vào số rác mà tưởng mình có cách liên lạc với mẹ.
   *
   * Cắt dấu phân cách TRƯỚC khi kiểm — cùng lý lẽ với email ở trên: ops DÁN số
   * từ Zalo/Excel/danh bạ, và "090 123 4567" là một số hoàn toàn đúng chỉ khác
   * cách trình bày.
   */
  sdt: z
    .string({ error: "Số điện thoại không hợp lệ" })
    .default("")
    .transform((v) => v.replace(/[\s.\-()]/g, ""))
    .refine((v) => v === "" || VN_PHONE.test(v), "Số điện thoại không hợp lệ"),

  /**
   * Hai cờ dưới mặc định TẮT khi client không gửi — phía an toàn của một hành
   * động có tác dụng ra ngoài. Thiếu mặc định thì `undefined` sẽ lặng lẽ trở
   * thành falsy ở nơi dùng, đúng kết quả này, nhưng khai ra thì kiểu trả về là
   * `boolean` thật chứ không phải `boolean | undefined`.
   */
  guiEmail: z.boolean().default(false),

  /**
   * CLAUDE.md: consent chi phối MỌI lượt dùng dữ liệu về sau. Ops tick hộ được,
   * nhưng phải là một hành động có ý thức — mặc định không bao giờ tự bật.
   */
  dongYNhanTin: z.boolean().default(false),
});

export type ThuCong = z.infer<typeof thuCongSchema>;

/**
 * `ThuCong` → hàng DB.
 *
 * Không trả về cột check-in, cùng lý do đã ghi ở `registrationToRow`: caller
 * gửi nguyên object này xuống Postgres, nên một `checked_in: false` lọt vào đây
 * là xoá dấu check-in đã ghi trước đó.
 *
 * Cũng không nhận `moc: Date` như `registrationToRow`: không có ngày sinh bé thì
 * không có `be_thang_tuoi` để suy ra, nên hàm này thuần tuý và không cần mốc.
 */
export function thuCongToRow(
  d: ThuCong,
  code: string,
): Omit<
  RegistrationRow,
  "id" | "created_at" | "checked_in" | "checked_in_at" | "checked_in_source" | "duoc_moi"
> {
  return {
    checkin_code: code,
    ho_ten: d.hoTen,
    email: d.email,

    // Hai cột NOT NULL — buộc phải có giá trị. "--" để ops đọc ra ngay giữa
    // bảng 500 dòng rằng dòng này còn thiếu thông tin. SĐT là ô DUY NHẤT ops có
    // thể điền thật ngay lúc tạo; bỏ trống thì rơi về "--" như các ô còn lại.
    sdt: d.sdt || THIEU,
    tinh_thanh: THIEU,

    // Field PHÂN KHÚC có kiểu: để TRỐNG, không "--" và tuyệt đối không chọn đại
    // một giá trị thật. Bịa ở đây là làm hỏng đúng phép đo mà phân khúc sinh ra
    // để làm — và không ai phát hiện được nữa, vì giá trị bịa trông y như thật.
    // Mọi nơi hiển thị đi qua `trangThaiLabel`/`nguonBietDenLabel`, vốn đã quy
    // null thành "--".
    trang_thai: null,
    nguon_biet_den: null,
    chu_de_quan_tam: [],

    facebook: null,
    chu_de_khac: null,
    thai_tuan: null,
    ten_be: null,
    be_ngay_sinh: null,
    be_gioi_tinh: null,
    be_thang_tuoi: null,

    di_cung_chong: false,
    dong_y_nhan_tin: d.dongYNhanTin,

    // Giữ "su-kien", KHÔNG thêm giá trị thứ ba: cột này mang hợp đồng phân khúc
    // su-kien vs app-waitlist (xem CLAUDE.md), và Brevo đọc cùng một giá trị.
    // Dòng tạo tay đã nhận ra được bằng các ô "--".
    nguon: "su-kien",
  };
}
