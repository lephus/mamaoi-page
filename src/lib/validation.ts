import { z } from "zod";
import { CHU_DE_VALUES, NGUON_VALUES } from "./constants";

/**
 * Two entry points, two shapes.
 *
 * The event form is the full "Membership First" record from the brief:
 * `trangThai` and `beThangTuoi` are typed fields that drive segmentation, not
 * decorative free text. A mother who registers today should never retype any
 * of this when the app launches.
 *
 * The app waitlist asks only for an email. It deliberately does NOT reuse the
 * event schema — padding the missing fields with placeholders would write
 * fake phone numbers and fake baby ages into the CRM, which is worse than
 * having no data at all.
 *
 * `registrationSchema` là discriminated union: mẹ đang mang thai và mẹ đã sinh
 * mang hai bộ field khác nhau, và schema — chứ không phải UI — là nơi quyết
 * định điều đó. Ẩn field ở form chỉ là phép lịch sự; đây mới là hàng rào.
 */

const VN_PHONE = /^(0|\+84)[1-9]\d{8}$/;

/**
 * Số tháng tròn từ ngày sinh tới mốc. Chỉ đếm tháng ĐÃ QUA đủ ngày: bé sinh
 * 25/01 tới 20/07 là 5 tháng, không phải 6 — mốc "mấy tháng tuổi" của mẹ luôn
 * là ngày kỷ niệm hàng tháng, không phải số tháng lịch chênh nhau.
 *
 * Trả số âm nếu ngày sinh ở tương lai; caller chịu trách nhiệm chặn.
 */
export function thangTuoiTuNgaySinh(ngaySinh: Date, moc: Date): number {
  let thang =
    (moc.getFullYear() - ngaySinh.getFullYear()) * 12 +
    (moc.getMonth() - ngaySinh.getMonth());
  if (moc.getDate() < ngaySinh.getDate()) thang -= 1;
  return thang;
}

/**
 * Bots fill hidden fields; humans never see them. Cheaper than a second captcha.
 *
 * Deliberately NOT `.max(0)`: rejecting it here would hand the bot a 400 naming
 * the field, which tells it exactly which input to leave alone next time. The
 * route accepts the submission, answers 200, and quietly drops it instead.
 */
const honeypot = z.string().optional();

const GIOI_HAN_THANG_TUOI = 36;

/** Field có ở CẢ hai nhánh. Nhánh nào cũng spread khối này vào. */
const chungFields = {
  nguon: z.literal("su-kien"),

  hoTen: z
    .string()
    .trim()
    .min(2, "Vui lòng nhập họ tên")
    .max(80, "Họ tên không được vượt quá 80 ký tự"),

  email: z.email("Email không hợp lệ").trim().toLowerCase(),

  sdt: z.string().trim().regex(VN_PHONE, "Số điện thoại không hợp lệ"),

  facebook: z.string().trim().max(200).optional().or(z.literal("")),

  tinhThanh: z.string().trim().min(1, "Vui lòng chọn thành phố"),

  chuDeQuanTam: z
    .array(z.enum(CHU_DE_VALUES as [string, ...string[]]))
    .min(1, "Vui lòng chọn ít nhất một chủ đề"),

  nguonBietDen: z.enum(NGUON_VALUES as [string, ...string[]], {
    message: "Vui lòng cho biết mẹ biết đến chương trình từ đâu",
  }),

  diCungChong: z.boolean().default(false),

  /**
   * Unticked by default and required. The brief makes consent govern every
   * downstream use of the data, so it is a gate — not a nudge.
   */
  dongYNhanTin: z.literal(true, {
    message: "Vui lòng đồng ý để hoàn tất đăng ký",
  }),

  recaptchaToken: z.string().optional(),
  website: honeypot,
};

/**
 * Union phân biệt theo `trangThai`. Đây là chỗ ép quy tắc "mang thai thì không
 * khai thông tin bé" — không phụ thuộc UI ẩn/hiện. Zod CẮT BỎ key lạ, nên field
 * của nhánh kia lọt lên cũng không bao giờ tới được DB.
 */
export const registrationSchema = z.discriminatedUnion("trangThai", [
  z.object({
    ...chungFields,
    trangThai: z.literal("mang_thai"),
    thaiTuan: z.coerce
      .number()
      .int("Số tuần phải là số nguyên")
      .min(1, "Số tuần thai không hợp lệ")
      .max(42, "Số tuần thai không hợp lệ"),
  }),
  z.object({
    ...chungFields,
    trangThai: z.literal("da_sinh"),
    tenBe: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập tên bé")
      .max(80, "Tên bé không được vượt quá 80 ký tự"),
    beNgaySinh: z.coerce
      .date({ message: "Vui lòng chọn ngày sinh của bé" })
      .refine((d) => d <= new Date(), "Ngày sinh không thể ở tương lai")
      .refine(
        (d) => thangTuoiTuNgaySinh(d, new Date()) <= GIOI_HAN_THANG_TUOI,
        `Bé trên ${GIOI_HAN_THANG_TUOI} tháng nằm ngoài phạm vi sự kiện`,
      ),
    beGioiTinh: z.enum(["nam", "nu"], {
      message: "Vui lòng chọn giới tính của bé",
    }),
  }),
]);

export const waitlistSchema = z.object({
  nguon: z.literal("app-waitlist"),
  email: z.email("Email không hợp lệ").trim().toLowerCase(),
  dongYNhanTin: z.literal(true, {
    message: "Vui lòng đồng ý nhận thông tin",
  }),
  recaptchaToken: z.string().optional(),
  website: honeypot,
});

export type Registration = z.infer<typeof registrationSchema>;
export type Waitlist = z.infer<typeof waitlistSchema>;
export type Submission = Registration | Waitlist;

export function isRegistration(s: Submission): s is Registration {
  return s.nguon === "su-kien";
}

/**
 * Check-in code carried in the confirmation email's QR.
 *
 * The alphabet omits I, O, 0 and 1 so a volunteer can read the code aloud or
 * type it in when the scanner fails at the door — which it will, at least once,
 * across 500 mothers.
 */
export function generateCheckinCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `MO-${code}`;
}

/** Định dạng mã check-in — khớp bảng chữ của `generateCheckinCode` (bỏ I,O,0,1). */
export const CHECKIN_CODE_RE = /^MO-[2-9A-HJ-NP-Z]{6}$/;

export function isValidCheckinCode(code: string): boolean {
  return CHECKIN_CODE_RE.test(code);
}
