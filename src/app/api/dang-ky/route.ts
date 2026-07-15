import { NextResponse } from "next/server";
import { sendEventEmail, sendWaitlistEmail, upsertContact } from "@/lib/brevo";
import { appendSubmission, sheetsConfigured } from "@/lib/sheets";
import {
  generateCheckinCode,
  isRegistration,
  registrationSchema,
  waitlistSchema,
  type Submission,
} from "@/lib/validation";

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
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
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

  if (sheetsConfigured()) {
    try {
      await appendSubmission(data, checkinCode);
    } catch (err) {
      // Logged loudly: this row must be back-filled from Brevo before the
      // event, or she is missing from the ops team's check-in list.
      console.error("[dang-ky] Sheets mirror failed:", data.email, err);
      warnings.push("sheets");
    }
  }

  return NextResponse.json({ ok: true, code: checkinCode, warnings });
}
