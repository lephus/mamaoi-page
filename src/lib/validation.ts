import { z } from "zod";

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
 */

const VN_PHONE = /^(0|\+84)[1-9]\d{8}$/;

/**
 * Bots fill hidden fields; humans never see them. Cheaper than a second captcha.
 *
 * Deliberately NOT `.max(0)`: rejecting it here would hand the bot a 400 naming
 * the field, which tells it exactly which input to leave alone next time. The
 * route accepts the submission, answers 200, and quietly drops it instead.
 */
const honeypot = z.string().optional();

export const registrationSchema = z
  .object({
    nguon: z.literal("su-kien"),

    hoTen: z
      .string()
      .trim()
      .min(2, "Vui lòng nhập họ tên")
      .max(80, "Họ tên không được vượt quá 80 ký tự"),

    email: z.email("Email không hợp lệ").trim().toLowerCase(),

    sdt: z.string().trim().regex(VN_PHONE, "Số điện thoại không hợp lệ"),

    facebook: z.string().trim().max(200).optional().or(z.literal("")),

    tinhThanh: z.string().trim().min(1, "Vui lòng chọn tỉnh/thành"),

    /** The segmentation axis: expecting, or already has a baby. */
    trangThai: z.enum(["mang_thai", "da_sinh"], {
      message: "Vui lòng chọn tình trạng hiện tại",
    }),

    /** Months. Only meaningful when trangThai === "da_sinh". */
    beThangTuoi: z.coerce
      .number()
      .int("Số tháng phải là số nguyên")
      .min(0, "Số tháng không hợp lệ")
      .max(36, "Bé trên 36 tháng nằm ngoài phạm vi sự kiện")
      .optional(),

    diCungChong: z.boolean().default(false),

    /**
     * Unticked by default and required. The brief makes consent govern every
     * downstream use of the data, so it is a gate — not a nudge.
     */
    dongYNhanTin: z.literal(true, {
      message: "Vui lòng đồng ý nhận thông tin để hoàn tất đăng ký",
    }),

    recaptchaToken: z.string().optional(),
    website: honeypot,
  })
  .refine((d) => d.trangThai !== "da_sinh" || d.beThangTuoi !== undefined, {
    message: "Vui lòng cho biết bé được bao nhiêu tháng",
    path: ["beThangTuoi"],
  });

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
