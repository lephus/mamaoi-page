import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  adminAuthConfigured,
  signSession,
  verifyCredentials,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!adminAuthConfigured()) {
    return Response.json({ error: "Chưa cấu hình đăng nhập admin" }, { status: 500 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const { email, password } = (body as { email?: string; password?: string }) ?? {};
  if (!email || !password || !verifyCredentials(email, password)) {
    return Response.json({ error: "Email hoặc mật khẩu không đúng" }, { status: 401 });
  }
  (await cookies()).set(ADMIN_COOKIE, signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return Response.json({ ok: true });
}
