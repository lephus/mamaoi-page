import { isAdmin } from "@/lib/admin-auth";
import { guiEmailTheoMau, noiDungEmail } from "@/lib/brevo";
import { MAU_THU_TU, VI_DU, type MauEmail } from "@/lib/mau-email";
import { findByCode } from "@/lib/supabase";
import { isValidCheckinCode } from "@/lib/validation";

/**
 * Gửi lại email kèm mã QR cho MỘT mẹ, dùng bởi trang `/admin/gui-mail`.
 *
 * Chỉ nhận `code` + `mau`, KHÔNG nhận tên/email từ client. Tên và email luôn
 * đọc lại từ Supabase theo mã — cùng lý do `/api/admin/export` chỉ nhận `ids`:
 * nhận dữ liệu client khai là để client quyết định email bay đi đâu, và ở đây
 * cái bay đi là một tấm vé vào cửa.
 *
 * GET  = xem trước (trả HTML, không gửi gì)
 * POST = gửi thật
 */
async function doc(request: Request) {
  const url = new URL(request.url);
  return {
    code: (url.searchParams.get("code") ?? "").trim().toUpperCase(),
    mau: url.searchParams.get("mau") ?? "",
    mauThu: url.searchParams.get("mauThu") === "1",
  };
}

function kiemTra(code: string, mau: string) {
  if (!isValidCheckinCode(code)) return "Mã không hợp lệ";
  if (!MAU_THU_TU.includes(mau as MauEmail)) return "Mẫu email không hợp lệ";
  return null;
}

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const { code, mau, mauThu } = await doc(request);

  /* Bản mẫu: chỉ để đọc câu chữ, nên không cần mã và KHÔNG tra DB. Vẫn gác
     đăng nhập và vẫn chặn mẫu lạ — chỉ bỏ đúng phần phụ thuộc vào một mẹ cụ thể. */
  if (mauThu) {
    if (!MAU_THU_TU.includes(mau as MauEmail)) {
      return Response.json({ error: "Mẫu email không hợp lệ" }, { status: 400 });
    }
    const { subject, html } = noiDungEmail(mau as MauEmail, VI_DU.hoTen, VI_DU.code);
    return Response.json({ ok: true, mauThu: true, subject, html });
  }

  const loi = kiemTra(code, mau);
  if (loi) return Response.json({ error: loi }, { status: 400 });

  try {
    const row = await findByCode(code);
    if (!row) return Response.json({ error: "Không tìm thấy mã" }, { status: 404 });

    const { subject, html } = noiDungEmail(mau as MauEmail, row.ho_ten, code);
    return Response.json({ ok: true, subject, html, hoTen: row.ho_ten, email: row.email });
  } catch (err) {
    console.error("[admin/gui-mail] preview failed:", err);
    return Response.json({ error: "Không dựng được bản xem trước" }, { status: 502 });
  }
}

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
  const { code: raw, mau } = (body as { code?: unknown; mau?: unknown }) ?? {};
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  const loi = kiemTra(code, typeof mau === "string" ? mau : "");
  if (loi) return Response.json({ error: loi }, { status: 400 });

  const row = await findByCode(code).catch((err) => {
    console.error("[admin/gui-mail] lookup failed:", err);
    return undefined;
  });
  if (row === undefined) {
    return Response.json({ error: "Không đọc được dữ liệu đăng ký" }, { status: 502 });
  }
  if (row === null) {
    return Response.json({ error: "Không tìm thấy mã" }, { status: 404 });
  }

  try {
    await guiEmailTheoMau(mau as MauEmail, { email: row.email, hoTen: row.ho_ten }, code);
  } catch (err) {
    // Gửi hỏng PHẢI nổi lên thành lỗi thật. Báo "đã gửi" khi chưa gửi được là
    // cách chắc chắn nhất để một mẹ tới cổng mà không có vé.
    console.error("[admin/gui-mail] send failed:", code, err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Gửi email thất bại" },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, email: row.email, hoTen: row.ho_ten });
}
