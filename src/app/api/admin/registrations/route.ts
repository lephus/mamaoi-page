import { isAdmin } from "@/lib/admin-auth";
import { listRegistrations } from "@/lib/supabase";

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  try {
    const rows = await listRegistrations();
    return Response.json({ ok: true, rows });
  } catch (err) {
    console.error("[admin/registrations] failed:", err);
    return Response.json({ error: "Không tải được danh sách" }, { status: 502 });
  }
}
