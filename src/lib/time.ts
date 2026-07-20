/** Việt Nam cố định UTC+7, không DST — nên phép dịch +7h là chính xác. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ISO instant → "HH:MM DD/MM/YYYY" theo giờ VN. */
export function formatCheckinTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(
    d.getUTCMonth() + 1,
  )}/${d.getUTCFullYear()}`;
}

/** ISO instant → "YYYY-MM-DDTHH:mm" giờ VN (dùng cho input datetime-local). */
export function isoToVNLocalInput(iso: string): string {
  return new Date(new Date(iso).getTime() + VN_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" (giờ VN) → ISO instant (UTC). */
export function vnLocalInputToISO(local: string): string {
  return new Date(`${local}:00+07:00`).toISOString();
}

/**
 * "2026-01-20" → "20/01/2026". Nhận thẳng chuỗi của cột `date` Postgres, KHÔNG
 * đi qua `new Date()`: parse "2026-01-20" ra Date rồi format theo múi giờ sẽ
 * lùi một ngày ở mọi múi giờ âm. Cắt chuỗi là phép biến đổi duy nhất đúng ở đây.
 */
export function ngayVN(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Hôm nay theo giờ VN, dạng "YYYY-MM-DD" — cho thuộc tính `max` của input date.
 * `new Date().toISOString()` là UTC: từ 00:00 tới 07:00 giờ VN nó trả về hôm
 * qua, chặn mất mẹ có bé sinh đúng hôm nay.
 */
export function homNayVN(): string {
  return new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10);
}
