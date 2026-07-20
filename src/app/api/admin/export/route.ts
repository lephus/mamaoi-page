import ExcelJS from "exceljs";
import { isAdmin } from "@/lib/admin-auth";
import { rowsToSheet, waitlistToSheet } from "@/lib/export-rows";
import { listRegistrations, listWaitlist } from "@/lib/supabase";
import { isoToVNLocalInput } from "@/lib/time";

/**
 * Nhận `ids` của các dòng đang hiển thị sau khi lọc, KHÔNG nhận chuỗi tìm kiếm
 * và KHÔNG nhận dữ liệu dòng:
 *  - server tự lọc lại theo `q` → logic lọc tồn tại hai nơi, sẽ trôi lệch;
 *  - nhận thẳng dữ liệu client → server tin dữ liệu client khai.
 * Gửi `ids` giữ một nguồn lọc duy nhất (client) và một nguồn dữ liệu duy nhất (DB).
 */
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
  const { ids, loai } = (body as { ids?: unknown; loai?: unknown }) ?? {};
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) {
    return Response.json({ error: "Thiếu danh sách id" }, { status: 400 });
  }
  // Thiếu `loai` = client cũ → giữ hành vi cũ (đăng ký sự kiện).
  if (loai !== undefined && loai !== "su-kien" && loai !== "waitlist") {
    return Response.json({ error: "Loại không hợp lệ" }, { status: 400 });
  }
  const laWaitlist = loai === "waitlist";

  try {
    const wanted = new Set(ids as string[]);
    const { headers, rows: data } = laWaitlist
      ? waitlistToSheet((await listWaitlist()).filter((r) => wanted.has(r.id)))
      : rowsToSheet((await listRegistrations()).filter((r) => wanted.has(r.id)));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(laWaitlist ? "Waitlist" : "Check-in");
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    for (const r of data) ws.addRow(r);
    // `headers[i]` có thể undefined nếu exceljs trả nhiều cột hơn header — đừng
    // để một file export làm sập route bằng một TypeError.
    ws.columns.forEach((c, i) => {
      c.width = Math.max((headers[i]?.length ?? 14) + 2, 16);
    });

    const buf = await wb.xlsx.writeBuffer();
    const stamp = isoToVNLocalInput(new Date().toISOString()).slice(0, 10);
    const ten = laWaitlist ? "mamaoi-waitlist" : "mamaoi-day-checkin";
    return new Response(new Uint8Array(buf as ArrayBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${ten}-${stamp}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[admin/export] failed:", err);
    return Response.json({ error: "Xuất file thất bại" }, { status: 502 });
  }
}
