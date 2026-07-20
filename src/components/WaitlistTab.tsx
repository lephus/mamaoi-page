"use client";

import { useMemo, useState } from "react";
import type { WaitlistRow } from "@/lib/supabase";
import { formatCheckinTime } from "@/lib/time";

/**
 * Danh sách chờ ứng dụng: chỉ đọc. Cố ý KHÔNG poll 5 giây như tab sự kiện —
 * poll ở đó sinh ra cho lúc 500 mẹ check-in đồng thời tại quầy, còn đây là
 * danh sách email không đổi trong lúc ai đó đang nhìn nó.
 */
export function WaitlistTab({ initialRows }: { initialRows: WaitlistRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => r.email.toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/waitlist");
      if (!res.ok) {
        setError("Không tải được danh sách");
        return;
      }
      const data = await res.json();
      setRows(data.rows as WaitlistRow[]);
    } catch {
      setError("Không kết nối được. Vui lòng thử lại.");
    } finally {
      setRefreshing(false);
    }
  }

  async function exportXlsx() {
    setExporting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loai: "waitlist", ids: filtered.map((r) => r.id) }),
      });
      if (!res.ok) {
        setError("Xuất file thất bại");
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "mamaoi-waitlist.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Hoãn revoke: trình duyệt cần một khoảng để bắt đầu tải blob URL sau click.
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      setError("Không kết nối được. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faded">
          Tổng: <strong className="text-ink">{rows.length}</strong> email
        </p>
        <div className="flex gap-2">
          <button
            onClick={exportXlsx}
            disabled={exporting || filtered.length === 0}
            className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? "Đang xuất..." : `Xuất Excel (${filtered.length})`}
          </button>
          <button
            onClick={() => void refresh()}
            disabled={refreshing}
            className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover disabled:opacity-50"
          >
            {refreshing ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm theo email..."
        className="mt-6 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-placeholder focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none sm:max-w-md"
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-line text-ink-faded">
            <tr>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Đồng ý nhận tin</th>
              <th className="px-4 py-3 font-semibold">Thời điểm đăng ký</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 font-semibold text-ink">{r.email}</td>
                <td className="px-4 py-3 text-ink">{r.dong_y_nhan_tin ? "Có" : "—"}</td>
                <td className="px-4 py-3 text-ink">{formatCheckinTime(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-faded">
            {rows.length === 0 ? "Chưa có ai đăng ký nhận tin." : "Không tìm thấy email nào."}
          </p>
        )}
      </div>
    </div>
  );
}
