import { NextResponse } from "next/server";
import { sendEventEmail, sendWaitlistEmail, upsertContact } from "@/lib/brevo";
import { appendRegistration, sheetsConfigured } from "@/lib/sheets";
import { insertRegistration, insertWaitlist, supabaseConfigured } from "@/lib/supabase";
import {
  chungSchema,
  generateCheckinCode,
  isRegistration,
  registrationSchema,
  waitlistSchema,
  type Submission,
} from "@/lib/validation";

// Bốn dịch vụ ngoài chạy tuần tự trong request này — Brevo, SMTP, Supabase,
// Sheets — cùng chia sẻ ngân sách thời gian dưới đây. Bị nền tảng giết giữa
// chừng sẽ báo thất bại cho một lượt đăng ký thực ra đã thành công.
export const maxDuration = 60;

/** Verify the reCAPTCHA token. Skipped entirely when no secret is configured. */
async function passesRecaptcha(token: string | undefined): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true; // not set up yet — do not block real registrations
  if (!token) return false;

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });
  const data = (await res.json()) as { success: boolean; score?: number };

  // v3 returns a score (0.5 is Google's suggested floor); v2 returns none.
  return data.success && (data.score === undefined || data.score >= 0.5);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  // The two forms carry different shapes; `nguon` says which one this is.
  const nguon = (body as { nguon?: string })?.nguon;
  const schema = nguon === "app-waitlist" ? waitlistSchema : registrationSchema;
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    const thu = (issues: { path: PropertyKey[]; message: string }[]) => {
      for (const issue of issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
    };
    thu(parsed.error.issues);

    // Union short-circuit ở discriminator: khi `trangThai` sai, Zod KHÔNG kiểm
    // một field chung nào. Chạy thêm schema field chung để mẹ thấy hết chỗ
    // thiếu trong MỘT lần, thay vì sửa một lỗi rồi submit lại mới lộ ra sáu.
    if (schema === registrationSchema) {
      const chung = chungSchema.safeParse(body);
      if (!chung.success) thu(chung.error.issues);
    }

    return NextResponse.json(
      { error: "Vui lòng kiểm tra lại thông tin", fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data as Submission;

  // Honeypot. Answer 200 so the bot believes it won and does not retry.
  if (data.website) {
    return NextResponse.json({ ok: true });
  }

  if (!(await passesRecaptcha(data.recaptchaToken))) {
    return NextResponse.json(
      { error: "Xác thực bảo mật thất bại. Vui lòng thử lại." },
      { status: 400 },
    );
  }

  const checkinCode = isRegistration(data) ? generateCheckinCode() : undefined;

  // Brevo holds the member record. If this fails, the registration genuinely
  // did not happen — surface a real error rather than a comforting lie.
  try {
    await upsertContact(data, checkinCode);
  } catch (err) {
    console.error("[dang-ky] Brevo contact failed:", err);
    return NextResponse.json(
      { error: "Không thể hoàn tất đăng ký. Vui lòng thử lại sau ít phút." },
      { status: 502 },
    );
  }

  // Past this point she IS registered. Nothing below may fail her request —
  // she would be refilling the form to fix a problem that is entirely ours.
  const warnings: string[] = [];

  try {
    if (isRegistration(data)) {
      await sendEventEmail(data, checkinCode!);
    } else {
      await sendWaitlistEmail(data);
    }
  } catch (err) {
    // Most likely cause: no verified sender in Brevo yet.
    console.error("[dang-ky] Email failed:", err);
    warnings.push("email");
  }

  // Bản ghi có cấu trúc cho /check-in + /admin.
  //  - Đăng ký sự kiện → bảng `registrations` (có mã check-in, thông tin bé).
  //  - Waitlist app    → bảng `waitlist` (chỉ email + consent).
  // Hai bảng RIÊNG, không gộp: gộp thì phải nới NOT NULL của ho_ten/sdt/
  // tinh_thanh/checkin_code, tức gỡ luôn lưới an toàn của đăng ký sự kiện thật.
  //
  // Non-fatal ở CẢ HAI nhánh: mẹ đã đăng ký xong ở Brevo rồi. Lỗi ở đây chỉ
  // log thật to để ops back-fill từ Brevo.
  if (supabaseConfigured()) {
    try {
      if (isRegistration(data)) {
        await insertRegistration(data, checkinCode!);
      } else {
        await insertWaitlist(data.email, data.dongYNhanTin);
      }
    } catch (err) {
      console.error("[dang-ky] Supabase insert failed:", data.email, err);
      warnings.push("supabase");
    }
  }

  // Bản mirror thô cho ops. Cố tình KHÔNG phụ thuộc kết quả của Supabase ở
  // trên: lý do tồn tại của bản sao thứ hai là dự phòng, nối tiếp thì Supabase
  // sập sẽ kéo mất luôn dòng Sheet, đúng lúc nó có giá trị nhất.
  if (isRegistration(data) && sheetsConfigured()) {
    try {
      await appendRegistration(data, checkinCode!);
    } catch (err) {
      console.error("[dang-ky] Sheets append failed:", data.email, err);
      warnings.push("sheets");
    }
  }

  return NextResponse.json({ ok: true, code: checkinCode, warnings });
}
