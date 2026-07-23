import Image from "next/image";
import { EVENT, EVENT_TIMELINE, trangThaiLabel } from "@/lib/constants";
import type { RegistrationRow } from "@/lib/supabase";
import { formatCheckinTime, ngayVN } from "@/lib/time";
import { CheckinButton } from "./CheckinButton";

/** Giờ mở check-in lấy thẳng từ timeline chính thức — không hard-code lệch nguồn. */
const CHECKIN_TIME = EVENT_TIMELINE.find((t) => t.title === "Check-in")?.time ?? "09:00";

/** Nhãn tình trạng; mang thai thì kèm tuần thai (nếu có). */
function statusText(row: RegistrationRow): string {
  const base = trangThaiLabel(row.trang_thai);
  if (row.trang_thai === "mang_thai" && row.thai_tuan) {
    return `${base} · Tuần ${row.thai_tuan}`;
  }
  return base;
}

function gioiTinhLabel(g: RegistrationRow["be_gioi_tinh"]): string {
  if (g === "nam") return "Bé trai";
  if (g === "nu") return "Bé gái";
  return "";
}

/** Một dòng "nhãn — giá trị" trong khối thông tin đăng ký. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="shrink-0 text-sm text-ink-faded">{label}</span>
      <span className="text-right text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}

/**
 * Vé check-in điện tử của mẹ. Server dựng cả hai trạng thái từ `row.checked_in`:
 * chưa check-in (QR sáng + nút) và đã check-in (QR mờ + dấu). Nút bấm xong gọi
 * `router.refresh()` để server dựng lại đúng trạng thái đã check-in.
 */
export function CheckinPass({
  row,
  qrDataUrl,
}: {
  row: RegistrationRow;
  qrDataUrl: string | null;
}) {
  const checkedIn = row.checked_in;
  const daSinh = row.trang_thai === "da_sinh";
  const beName = [row.ten_be, gioiTinhLabel(row.be_gioi_tinh)].filter(Boolean).join(" · ");

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white text-left shadow-card">
      {/* Header strip thương hiệu */}
      <div className="flex items-center justify-between gap-3 bg-primary-faded px-6 py-4">
        <Image
          src="/images/logo-header.png"
          alt="Mama Ơi"
          width={1095}
          height={187}
          className="h-6 w-auto"
        />
        <span className="text-xs font-extrabold uppercase tracking-widest text-primary">
          Vé check-in
        </span>
      </div>

      <div className="px-6 py-7 sm:px-8">
        {/* Lời chào + mã */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-ink">Chào chị {row.ho_ten} 💛</h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-cream px-4 py-1.5">
            <span className="text-xs text-ink-faded">Mã</span>
            <span className="font-mono text-base font-bold tracking-wider text-ink">
              {row.checkin_code}
            </span>
          </div>
        </div>

        {/* QR — mờ đi và đóng dấu khi đã check-in */}
        <div className="mt-6 flex flex-col items-center">
          {qrDataUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL sinh server-side, next/image không tối ưu được gì mà còn thêm ràng buộc cấu hình */}
              <img
                src={qrDataUrl}
                alt={`Mã QR check-in ${row.checkin_code}`}
                width={192}
                height={192}
                className={`h-48 w-48 rounded-2xl border border-line ${
                  checkedIn ? "opacity-25" : ""
                }`}
              />
              {checkedIn && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="-rotate-6 rounded-xl border-2 border-secondary bg-white/95 px-3 py-1.5 text-base font-extrabold text-ink shadow-sm">
                    ✓ Đã check-in
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-ink-faded">
              Không tạo được mã QR. Mẹ đọc mã{" "}
              <strong className="text-ink">{row.checkin_code}</strong> cho nhân viên.
            </p>
          )}

          {!checkedIn && qrDataUrl && (
            <p className="mt-3 max-w-xs text-center text-sm leading-6 text-ink-faded">
              Đưa mã QR này cho nhân viên tại quầy để check-in và nhận Welcome Kit.
            </p>
          )}
        </div>

        {/* Ngăn cách kiểu vé */}
        <div className="my-6 border-t border-dashed border-line" />

        {/* Thông tin sự kiện */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <span aria-hidden="true">📅</span>
            <div>
              <p className="text-sm font-semibold text-ink">{EVENT.dateLabel}</p>
              <p className="text-sm text-ink-faded">Check-in từ {CHECKIN_TIME}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span aria-hidden="true">📍</span>
            <div>
              <p className="text-sm font-semibold text-ink">{EVENT.venue}</p>
              <p className="text-sm text-ink-faded">{EVENT.address}</p>
            </div>
          </div>
        </div>

        {/* Thông tin đăng ký */}
        <div className="mt-5 divide-y divide-line rounded-2xl bg-cream px-4">
          <DetailRow label="Tình trạng" value={statusText(row)} />
          <DetailRow label="Tỉnh/thành" value={row.tinh_thanh} />
          {daSinh && beName && <DetailRow label="Bé" value={beName} />}
          {daSinh && row.be_ngay_sinh && (
            <DetailRow label="Ngày sinh bé" value={ngayVN(row.be_ngay_sinh)} />
          )}
        </div>

        {row.di_cung_chong && (
          <div className="mt-4 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-faded px-3 py-1 text-sm font-semibold text-secondary">
              👫 Đi cùng chồng
            </span>
          </div>
        )}

        {/* Hành động / trạng thái */}
        <div className="mt-6">
          {checkedIn ? (
            <div className="rounded-2xl border border-secondary bg-secondary-faded px-4 py-3 text-center">
              <p className="text-sm font-semibold text-ink">
                ✓ Đã check-in
                {row.checked_in_at ? ` lúc ${formatCheckinTime(row.checked_in_at)}` : ""}
              </p>
            </div>
          ) : (
            <CheckinButton code={row.checkin_code} />
          )}
        </div>
      </div>
    </div>
  );
}
