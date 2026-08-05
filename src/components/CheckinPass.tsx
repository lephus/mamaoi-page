import Image from "next/image";
import {
  CHUA_MO_CHECKIN,
  EVENT,
  GIO_MO_CHECK_IN,
  THIEU,
  trangThaiLabel,
} from "@/lib/constants";
import type { RegistrationRow } from "@/lib/supabase";
import { formatCheckinTime, ngayVN } from "@/lib/time";
import { CheckinButton } from "./CheckinButton";
import { Button } from "./ui/Button";

/**
 * Giờ mở check-in lấy thẳng từ timeline chính thức — không hard-code lệch nguồn.
 *
 * Trước đây tìm theo `title === "Check-in"`; khách đổi lịch trình thành "Check
 * in" (không gạch nối) là câu đó rơi về fallback "09:00" và vé in sai giờ mà
 * không ai thấy. Nay đọc mốc đầu ngày qua hằng số dùng chung.
 */
const CHECKIN_TIME = GIO_MO_CHECK_IN;

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
 * Chỗ của nút check-in khi chưa tới ngày sự kiện.
 *
 * Nút thật chứ không phải chữ suông: mẹ mở vé sớm phải thấy ngay là "có nút,
 * nhưng chưa tới lúc", chứ không phải một cái vé thiếu mất chỗ hành động và
 * tưởng vé mình hỏng. `disabled` để trình đọc màn hình cũng nghe đúng điều đó.
 */
function ChuaMoCheckin() {
  return (
    <div>
      <Button type="button" disabled className="w-full">
        {CHUA_MO_CHECKIN.nut}
      </Button>
      <p className="mt-2.5 text-center text-sm leading-6 text-ink-faded">
        {CHUA_MO_CHECKIN.mo}
      </p>
    </div>
  );
}

/**
 * Vé check-in điện tử của mẹ. Server dựng cả hai trạng thái từ `row.checked_in`:
 * chưa check-in (QR sáng + nút) và đã check-in (QR mờ + dấu). Nút bấm xong gọi
 * `router.refresh()` để server dựng lại đúng trạng thái đã check-in.
 *
 * `daMoCheckin` là THAM SỐ chứ không đọc `Date.now()` tại đây: đọc đồng hồ trong
 * lúc render là hàm không thuần, React Compiler cấm — và cấm đúng, vì kết quả
 * render sẽ khác nhau giữa hai lần chạy cùng một props. Page tính rồi truyền
 * xuống, theo đồng hồ SERVER (trang là `force-dynamic` nên mỗi lượt mở vé đều
 * tính lại) chứ không theo đồng hồ máy mẹ — một điện thoại đặt sai ngày không mở
 * sớm được nút này.
 */
export function CheckinPass({
  row,
  qrDataUrl,
  daMoCheckin,
}: {
  row: RegistrationRow;
  qrDataUrl: string | null;
  /** Đã tới ngày cho mẹ tự check-in chưa — page tính, xem doc ngay trên. */
  daMoCheckin: boolean;
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

        {/* Thông tin đăng ký.
            Ô "--" bị ẨN ở đây, khác hẳn /admin và file Excel nơi nó phải hiện.
            Đây là trang MẸ đọc, và việc của nó là tấm QR — "Tình trạng: --" chỉ
            làm mẹ tưởng vé mình hỏng. Dòng "--" chỉ có ở đăng ký ops tạo tay,
            nơi thông tin đó chưa từng được hỏi. Với ops thì "chưa hỏi" là thông
            tin cần biết; với mẹ thì không. */}
        <div className="mt-5 divide-y divide-line rounded-2xl bg-cream px-4">
          {row.trang_thai && <DetailRow label="Tình trạng" value={statusText(row)} />}
          {row.tinh_thanh !== THIEU && (
            <DetailRow label="Tỉnh/thành" value={row.tinh_thanh} />
          )}
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
          ) : daMoCheckin ? (
            <CheckinButton code={row.checkin_code} />
          ) : (
            <ChuaMoCheckin />
          )}
        </div>
      </div>
    </div>
  );
}
