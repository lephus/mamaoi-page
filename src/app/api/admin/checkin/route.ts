import { isAdmin } from "@/lib/admin-auth";
import { adminUpdateCheckin } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const { id, checkedIn, checkedInAt } =
    (body as { id?: string; checkedIn?: boolean; checkedInAt?: string | null }) ?? {};
  if (!id || typeof checkedIn !== "boolean") {
    return Response.json({ error: "Thiếu dữ liệu" }, { status: 400 });
  }
  try {
    const row = await adminUpdateCheckin(id, checkedIn, checkedIn ? (checkedInAt ?? null) : null);
    return Response.json({ ok: true, row });
  } catch (err) {
    console.error("[admin/checkin] failed:", err);
    return Response.json({ error: "Cập nhật thất bại" }, { status: 502 });
  }
}
