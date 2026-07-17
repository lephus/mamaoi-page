"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RegistrationRow } from "@/lib/supabase";
import { isoToVNLocalInput, vnLocalInputToISO } from "@/lib/time";
import { AdminDetailModal } from "./AdminDetailModal";

// Làm mới thủ công tối đa thử lại bấy nhiêu lần khi phát hiện có một lượt ghi
// xen vào giữa lúc gọi fetch và lúc có phản hồi. Chặn trường hợp nhân viên
// tick liên tục khiến refresh() cứ fetch lại mãi không dừng.
const MAX_MANUAL_REFRESH_RETRIES = 2;

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
  // Bộ đếm "thế hệ ghi": tăng ở CẢ lúc update() bắt đầu LẪN lúc update() xong,
  // nên giá trị của nó KHÔNG phải số lượt ghi. Dùng để phát hiện một lượt ghi
  // chen vào giữa lúc poll gửi request và lúc phản hồi của CHÍNH request đó về.
  const writeGenRef = useRef(0);
  // Số thứ tự của lần fetch /api/admin/registrations gần nhất — tăng dần, cấp
  // ngay trước mỗi lần gọi fetch (poll nền, thủ công, và từng vòng retry của
  // thủ công đều lấy số riêng). Cùng appliedSeqRef bên dưới tạo lớp bảo vệ THỨ
  // HAI, độc lập với writeGenRef: writeGenRef chỉ thấy được ghi từ CHÍNH máy
  // này, còn một mẹ được check-in từ MÁY KHÁC ở quầy bên không hề đụng vào
  // writeGenRef của máy này, nên khi hai poll của máy này chồng lên nhau (độ
  // trễ mạng > 5s) và phản hồi CŨ về sau phản hồi MỚI, writeGenRef không phát
  // hiện ra — phải so sánh thứ tự request để biết phản hồi nào tới sau bị lỡ.
  const fetchSeqRef = useRef(0);
  // Số thứ tự CAO NHẤT đã được setRows áp. Một phản hồi có số thứ tự nhỏ hơn
  // giá trị này là hàng cũ về muộn sau một phản hồi mới hơn — bỏ áp thay vì
  // ghi đè ngược.
  const appliedSeqRef = useRef(0);

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

  const refresh = useCallback(
    async (opts?: { manual?: boolean }) => {
      const manual = opts?.manual ?? false;
      // Số lần được phép fetch lại nếu bản thủ công đụng một lượt ghi xen vào.
      // Poll nền (manual=false) không retry — nó chạy lại tự nhiên sau 5s.
      let retriesLeft = manual ? MAX_MANUAL_REFRESH_RETRIES : 0;
      for (;;) {
        // Chụp lại "thế hệ ghi" TRƯỚC KHI gọi fetch, chỉ để so sánh SAU KHI có
        // phản hồi — không dùng để quyết định có bắn request hay không.
        const genAtStart = writeGenRef.current;
        // Cấp số thứ tự cho CHÍNH lần fetch này, ngay trước khi gọi fetch —
        // mỗi vòng lặp retry bên dưới quay lại đây nên tự lấy số mới.
        const seq = ++fetchSeqRef.current;
        const res = await fetch("/api/admin/registrations");
        if (res.status === 401) {
          setStopped(true);
          router.replace("/admin/login");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        // GUARD PHẢI NẰM Ở ĐÂY — lúc ÁP dữ liệu — chứ không phải lúc BẮN
        // request (kiểm busyRef trong setInterval bên dưới chỉ là tối ưu).
        // Khoảng cách giữa lúc gọi fetch và lúc phản hồi này về là độ trễ
        // mạng thật (wifi hội trường, vài trăm ms tới vài giây) — một lượt
        // tick có thể bắt đầu VÀ kết thúc TRỌN VẸN trong khoảng đó. writeGenRef
        // được tăng ở CẢ lúc bắt đầu ghi lẫn lúc ghi xong (xem update()), nên
        // "đã có ghi xen vào" bắt được cả hai trường hợp: ghi đang chạy dở
        // hoặc đã ghi xong trọn vẹn trong lúc chờ phản hồi này.
        const staleWrite = writeGenRef.current !== genAtStart;
        // Poll nền: bỏ áp nếu đang ghi HOẶC đã có ghi xen vào — không nuốt lỗi,
        // chỉ đơn giản bỏ nhịp này, nhịp poll kế tiếp (5s sau) sẽ tự lấy lại.
        if (!manual && (busyRef.current !== null || staleWrite)) {
          return;
        }
        // Làm mới THỦ CÔNG: dữ liệu vừa nhận có thể đã cũ hơn thao tác của
        // người dùng — staleWrite là ước lượng BẢO THỦ, không phải bằng
        // chứng chắc chắn (một GET bắn lúc gen còn cũ vẫn có thể đọc DB sau
        // khi ghi đã commit, nên đôi khi dữ liệu tươi vẫn bị gắn cờ oan).
        // Không được áp đè lên kết quả tick, nhưng cũng không được lặng lẽ bỏ
        // qua yêu cầu của họ. Fetch lại để lấy dữ liệu tươi, giới hạn số lần
        // thử lại để nhân viên tick liên tục không khiến vòng lặp này quay mãi.
        if (manual && staleWrite) {
          if (retriesLeft > 0) {
            retriesLeft -= 1;
            continue;
          }
          // Hết lượt thử lại mà vẫn dính ghi xen vào: BỎ ÁP thay vì áp tạm.
          // Đánh đổi có chủ đích — bấm Làm mới giữa cơn bão tick sẽ thấy dữ
          // liệu cập nhật trễ tối đa 5s (poll nền tự lấy lại rồi), đổi lấy
          // việc không bao giờ áp một snapshot cũ đè lên kết quả tick vừa ghi
          // — đúng cú "nhảy ngược" mà writeGenRef ở update() sinh ra để diệt.
          return;
        }
        // Chống hai poll chồng nhau (độ trễ mạng > 5s khiến poll trước còn bay
        // khi poll sau đã bắn): nếu đã có một phản hồi với số thứ tự CAO HƠN
        // được áp trước đó, phản hồi hiện tại là hàng cũ về muộn — bỏ áp thay
        // vì ghi đè ngược lên dữ liệu mới hơn. Đây là ca staleWrite ở trên
        // không bắt được, vì ghi có thể đến từ MÁY KHÁC không đụng writeGenRef
        // của máy này.
        if (seq < appliedSeqRef.current) {
          return;
        }
        appliedSeqRef.current = seq;
        setRows(data.rows as RegistrationRow[]);
        return;
      }
    },
    [router],
  );

  // Poll thay cho Supabase Realtime: realtime cần một khoá Supabase ở client,
  // mà RLS đang TẮT — khoá ở client là lộ toàn bộ PII của 500 mẹ. Xem spec
  // 2026-07-16-admin-export-popup-poll-design.md.
  useEffect(() => {
    if (stopped) return;
    const id = setInterval(() => {
      // Bỏ nhịp SỚM khi đang ghi hoặc tab ẩn: chỉ để đỡ tốn một lượt gọi API
      // vô ích, KHÔNG phải điều kiện bắt buộc cho tính đúng đắn. Guard chống
      // ghi đè thật sự nằm trong refresh(), áp dụng lúc nhận phản hồi — và nó
      // tự đứng vững độc lập với guard sớm này, vì writeGenRef được tăng ở CẢ
      // lúc bắt đầu ghi lẫn lúc ghi xong (xem update()): dù busyRef đã về null
      // trước khi phản hồi này tới, writeGenRef vẫn lệch so với genAtStart nếu
      // có một lượt ghi hoàn tất trong lúc chờ, nên refresh() vẫn bỏ áp đúng.
      if (busyRef.current || document.hidden) return;
      // Lỗi mạng: bỏ qua nhịp này, giữ dữ liệu cũ — poll là nền, không làm phiền.
      void refresh().catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [refresh, stopped]);

  async function update(id: string, checkedIn: boolean, checkedInAt: string | null) {
    setBusy(id);
    // Tăng thế hệ ghi NGAY khi bắt đầu — poll đang bay lúc này (nếu có) phải
    // thấy được rằng đã có một lượt ghi xen vào, kể cả khi ghi xong rất nhanh.
    writeGenRef.current += 1;
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
      // Tăng thế hệ ghi LẦN NỮA khi ghi xong. Nếu chỉ tăng lúc bắt đầu, ca sau
      // vẫn lọt lưới: một poll bắn ra SAU KHI ghi này đã bắt đầu (nên
      // genAtStart chụp được gen đã tăng sẵn từ lúc bắt đầu, trước khi poll đó
      // kịp chụp) nhưng có phản hồi về SAU KHI ghi đã xong (nên busyRef đã về
      // null) sẽ thấy writeGenRef không đổi kể từ lúc nó chụp genAtStart — vì
      // gen chỉ tăng một lần duy nhất, ngay từ đầu — tưởng nhầm là dữ liệu còn
      // mới rồi áp snapshot cũ đè lên kết quả tick. Tăng thêm ở đây khiến guard
      // lúc áp trong refresh() tự đứng vững, không phụ thuộc việc setInterval
      // có kịp thấy busyRef hay không.
      writeGenRef.current += 1;
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
              onClick={() => {
                // Bấm tay (manual: true): được fetch lại tối đa
                // MAX_MANUAL_REFRESH_RETRIES lần nếu đụng ghi chen vào; hết lượt
                // mà vẫn dính thì BỎ ÁP — poll nền lấy lại trong ≤5s, còn áp thì
                // sẽ thấy hàng nhảy ngược. Tự bắt lỗi mạng vì khác poll nền, đây
                // là yêu cầu chủ động, không được nuốt thành unhandled rejection.
                void refresh({ manual: true }).catch(() => {});
              }}
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
                      className="cursor-pointer text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
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
