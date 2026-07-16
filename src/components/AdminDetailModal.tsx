"use client";

import { useEffect } from "react";
import type { RegistrationRow } from "@/lib/supabase";
import { formatCheckinTime, isoToVNLocalInput } from "@/lib/time";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 py-2 last:border-0">
      <span className="text-sm text-ink-faded">{label}</span>
      <span className="text-right text-sm font-semibold text-ink">{value || "—"}</span>
    </div>
  );
}

/**
 * Hàm hiển thị thuần của `row`: không tự fetch, không giữ bản sao dòng. Tick và
 * sửa giờ đi qua đúng callback mà bảng dùng, nên hai nơi không thể lệch nhau.
 */
export function AdminDetailModal({
  row,
  busy,
  onClose,
  onToggle,
  onEditTime,
}: {
  row: RegistrationRow;
  busy: boolean;
  onClose: () => void;
  onToggle: (r: RegistrationRow) => void;
  onEditTime: (r: RegistrationRow, localValue: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết ${row.ho_ten}`}
        className="w-full max-w-lg rounded-3xl border border-line bg-white p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-ink">{row.ho_ten}</h2>
            <p className="mt-1 text-sm text-ink-faded">{row.tinh_thanh}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full border border-line px-3 py-1 text-sm text-ink-faded hover:bg-primary-faded-hover"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-cream p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh sinh động từ route API /api/admin/qr, next/image không tối ưu được gì mà còn thêm ràng buộc cấu hình */}
          <img
            src={`/api/admin/qr?code=${encodeURIComponent(row.checkin_code)}`}
            alt={`QR check-in của ${row.ho_ten}`}
            width={240}
            height={240}
            className="mx-auto h-60 w-60 rounded-xl bg-white"
          />
          <p className="mt-3 text-2xl font-extrabold tracking-widest text-primary">
            {row.checkin_code}
          </p>
          <p className="mt-1 text-xs text-ink-faded">Mẹ mất email? Đưa mã này cho mẹ quét.</p>
        </div>

        <div className="mt-4">
          <Field label="Email" value={row.email} />
          <Field label="SĐT" value={row.sdt} />
          <Field label="Facebook" value={row.facebook ?? ""} />
          <Field
            label="Tình trạng"
            value={
              row.trang_thai === "mang_thai"
                ? "Mang thai"
                : `Đã sinh${row.be_thang_tuoi != null ? ` · bé ${row.be_thang_tuoi} tháng` : ""}`
            }
          />
          <Field label="Đi cùng chồng" value={row.di_cung_chong ? "Có" : "—"} />
          <Field label="Đồng ý nhận tin" value={row.dong_y_nhan_tin ? "Có" : "—"} />
          <Field label="Nguồn đăng ký" value={row.nguon} />
          <Field label="Thời điểm đăng ký" value={formatCheckinTime(row.created_at)} />
          <Field label="Nguồn check-in" value={row.checked_in_source ?? ""} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => onToggle(row)}
            disabled={busy}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${
              row.checked_in
                ? "bg-success text-white"
                : "border border-line bg-white text-ink-faded hover:bg-primary-faded"
            }`}
          >
            {row.checked_in ? "✓ Đã check-in" : "Tick check-in"}
          </button>
          {row.checked_in && (
            <input
              type="datetime-local"
              defaultValue={row.checked_in_at ? isoToVNLocalInput(row.checked_in_at) : ""}
              onChange={(e) => onEditTime(row, e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>
      </div>
    </div>
  );
}
