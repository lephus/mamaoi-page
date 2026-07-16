import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Đăng nhập admin đơn giản: so khớp env-cred + cookie phiên ký HMAC. Không dùng
 * Supabase Auth (thừa cho một tài khoản admin). Các hàm thuần (sign/verify/creds)
 * chỉ phụ thuộc node:crypto nên unit-test được; `isAdmin` nạp `next/headers` động
 * để module vẫn import được trong test.
 */
export const ADMIN_COOKIE = "mo_admin";
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12h — phủ trọn ngày sự kiện

export function adminAuthConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD &&
      process.env.ADMIN_SESSION_SECRET,
  );
}

function tsEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyCredentials(email: string, password: string): boolean {
  const e = process.env.ADMIN_EMAIL ?? "";
  const p = process.env.ADMIN_PASSWORD ?? "";
  return (
    tsEqual(email.trim().toLowerCase(), e.trim().toLowerCase()) && tsEqual(password, p)
  );
}

function sign(payload: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSession(ttlMs: number = DEFAULT_TTL_MS): string {
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (!tsEqual(sig, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
}

/** Guard server-side: đọc cookie phiên. Dùng trong page/route admin. */
export async function isAdmin(): Promise<boolean> {
  const { cookies } = await import("next/headers");
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifySession(token);
}
