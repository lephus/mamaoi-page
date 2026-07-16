"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RegistrationRow } from "@/lib/supabase";
import { isoToVNLocalInput, vnLocalInputToISO } from "@/lib/time";
import { AdminDetailModal } from "./AdminDetailModal";

export function AdminDashboard({ initialRows }: { initialRows: RegistrationRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  // Phiên hết hạn thì phải dừng hẳn, nếu không poll đẻ ra vòng lặp 401 mỗi 5s.
  const [stopped, setStopped] = useState(false);
  // `busy` đọc qua ref: interval chỉ tạo một lần, không phụ thuộc `busy`.
  // Đồng bộ trong useEffect, KHÔNG gán thẳng khi render (React cấm ghi ref
  // trong lúc render — dễ sai khi StrictMode render hai lần).
  const busyRef = useRef<string | null>(null);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.ho_ten.toLowerCase().includes(s) ||
        r.sdt.includes(s) ||
        r.checkin_code.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const checkedInCount = rows.filter((r) => r.checked_in).length;

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/registrations");
    if (res.status === 401) {
      setStopped(true);
      router.replace("/admin/login");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows as RegistrationRow[]);
    }
  }, [router]);

  // Poll thay cho Supabase Realtime: realtime cần một khoá Supabase ở client,
  // mà RLS đang TẮT — khoá ở client là lộ toàn bộ PII của 500 mẹ. Xem spec
  // 2026-07-16-admin-export-popup-poll-design.md.
  useEffect(() => {
    if (stopped) return;
    const id = setInterval(() => {
      // Đang ghi thì bỏ nhịp: phản hồi poll có thể ghi đè kết quả vừa tick.
      // Tab ẩn thì bỏ nhịp: máy ở quầy không gọi API khi nằm trong túi.
      if (busyRef.current || document.hidden) return;
      // Lỗi mạng: bỏ qua nhịp này, giữ dữ liệu cũ — poll là nền, không làm phiền.
      void refresh().catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [refresh, stopped]);

  async function update(id: string, checkedIn: boolean, checkedInAt: string | null) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, checkedIn, checkedInAt }),
      });
      if (res.ok) {
        const data = await res.json();
        setRows((prev) => prev.map((r) => (r.id === id ? (data.row as RegistrationRow) : r)));
      }
    } finally {
      setBusy(null);
    }
  }

  function toggle(r: RegistrationRow) {
    if (r.checked_in) update(r.id, false, null);
    else update(r.id, true, new Date().toISOString());
  }

  function editTime(r: RegistrationRow, localValue: string) {
    if (!localValue) return;
    update(r.id, true, vnLocalInputToISO(localValue));
  }

  /** Xuất đúng các dòng đang hiển thị (WYSIWYG) — server đọc lại từ DB theo id. */
  async function exportXlsx() {
    setExporting(true);
    setExportError("");
    try {
      const res = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: filtered.map((r) => r.id) }),
      });
      if (!res.ok) {
        setExportError("Xuất file thất bại");
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "mamaoi-day-checkin.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Hoãn revoke: trình duyệt cần một khoảng để bắt đầu tải blob URL sau click,
      // revoke ngay có thể chạy trước, khiến file tải về rỗng/hỏng.
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      setExportError("Không kết nối được. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const openRow = openId ? (rows.find((r) => r.id === openId) ?? null) : null;

  return (
    <main className="flex-1 bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Check-in — Mama Ơi Day</h1>
            <p className="mt-1 text-sm text-ink-faded">
              Đã check-in: <strong className="text-success">{checkedInCount}</strong> / {rows.length}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportXlsx}
              disabled={exporting || filtered.length === 0}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? "Đang xuất..." : `Xuất Excel (${filtered.length})`}
            </button>
            <button
              onClick={refresh}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover"
            >
              Làm mới
            </button>
            <button
              onClick={logout}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink-faded hover:bg-primary-faded-hover"
            >
              Đăng xuất
            </button>
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên, SĐT hoặc mã..."
          className="mt-6 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:max-w-md"
        />
        {exportError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {exportError}
          </p>
        )}

        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-ink-faded">
              <tr>
                <th className="px-4 py-3 font-semibold">Họ tên</th>
                <th className="px-4 py-3 font-semibold">SĐT</th>
                <th className="px-4 py-3 font-semibold">Tỉnh/Thành</th>
                <th className="px-4 py-3 font-semibold">Tình trạng</th>
                <th className="px-4 py-3 font-semibold">Chồng</th>
                <th className="px-4 py-3 font-semibold">Check-in</th>
                <th className="px-4 py-3 font-semibold">Giờ check-in</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setOpenId(r.id)}
                      className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                    >
                      <div className="font-semibold text-ink">{r.ho_ten}</div>
                      <div className="text-xs text-ink-faded">{r.checkin_code}</div>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-ink">{r.sdt}</td>
                  <td className="px-4 py-3 text-ink">{r.tinh_thanh}</td>
                  <td className="px-4 py-3 text-ink">
                    {r.trang_thai === "mang_thai"
                      ? "Mang thai"
                      : `Đã sinh${r.be_thang_tuoi != null ? ` · ${r.be_thang_tuoi}th` : ""}`}
                  </td>
                  <td className="px-4 py-3 text-ink">{r.di_cung_chong ? "Có" : "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(r)}
                      disabled={busy === r.id}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                        r.checked_in
                          ? "bg-success text-white"
                          : "border border-line bg-white text-ink-faded hover:bg-primary-faded"
                      }`}
                    >
                      {r.checked_in ? "✓ Đã check-in" : "Tick check-in"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {r.checked_in ? (
                      <input
                        type="datetime-local"
                        defaultValue={r.checked_in_at ? isoToVNLocalInput(r.checked_in_at) : ""}
                        onChange={(e) => editTime(r, e.target.value)}
                        className="rounded-lg border border-line bg-white px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    ) : (
                      <span className="text-xs text-ink-placeholder">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openRow && (
        <AdminDetailModal
          row={openRow}
          busy={busy === openRow.id}
          onClose={() => setOpenId(null)}
          onToggle={toggle}
          onEditTime={editTime}
        />
      )}
    </main>
  );
}
