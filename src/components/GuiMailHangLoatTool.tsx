"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { choDienLa } from "@/lib/cho-dien";
import type { RegistrationRow } from "@/lib/supabase";
import { boDau } from "@/lib/text";

type KetQua = { ok: boolean; text: string };

/** Bản xem trước gắn kèm đúng bộ nội dung đã dùng để dựng nó — so để biết CŨ. */
type XemTruoc = { subject: string; html: string; tieuDe: string; noiDung: string; idMau: string };

// Khoá sessionStorage cất bản nháp khi phiên đăng nhập hết hạn giữa chừng lúc
// admin đang gõ. Một tab (không phải toàn trình duyệt) là đủ — mục tiêu chỉ là
// sống sót qua một lượt "đăng nhập lại rồi quay lại trang này", không cần bền
// qua việc đóng tab hay khởi động lại máy.
const KHOA_NHAP_TAM = "mo-gui-mail-hang-loat-nhap";

export function GuiMailHangLoatTool({
  rows,
  emailMacDinh,
}: {
  rows: RegistrationRow[];
  emailMacDinh: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [chon, setChon] = useState<Set<string>>(new Set());
  const [tieuDe, setTieuDe] = useState("");
  const [noiDung, setNoiDung] = useState("");
  const [toiEmail, setToiEmail] = useState(emailMacDinh);
  const [soXacNhan, setSoXacNhan] = useState("");
  const [xemTruoc, setXemTruoc] = useState<XemTruoc | null>(null);
  const [dangChay, setDangChay] = useState<"" | "xem" | "thu" | "that">("");
  const [ketQua, setKetQua] = useState<KetQua | null>(null);

  // Phục hồi bản nháp bị 401 văng mất — CHỈ MỘT LẦN, ngay khi màn hình này mở
  // (không nhất thiết ngay sau đăng nhập — admin có thể quay lại trang sau).
  // Xoá khoá ngay sau khi đọc để không phục hồi lặp ở lần mở kế tiếp.
  //
  // Đọc qua microtask thay vì gọi setState thẳng trong effect: HTML server
  // render ra rỗng (sessionStorage không tồn tại ở server) — đọc và áp ngay
  // trong effect sẽ lệch với lượt hydrate đầu tiên. Trì hoãn một nhịp microtask
  // để hydrate xong với đúng bản rỗng khớp server trước, rồi mới nạp bản nháp —
  // giống hệt một lượt fetch cập nhật state sau khi effect đã chạy xong.
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = sessionStorage.getItem(KHOA_NHAP_TAM);
        if (!raw) return;
        sessionStorage.removeItem(KHOA_NHAP_TAM);
        const nhap = JSON.parse(raw) as { tieuDe?: string; noiDung?: string; ids?: string[] };
        if (typeof nhap.tieuDe === "string") setTieuDe(nhap.tieuDe);
        if (typeof nhap.noiDung === "string") setNoiDung(nhap.noiDung);
        if (Array.isArray(nhap.ids)) {
          setChon(new Set(nhap.ids.filter((id): id is string => typeof id === "string")));
        }
      } catch {
        // Dữ liệu hỏng hoặc sessionStorage bị chặn (chế độ ẩn danh) — bỏ qua,
        // mất một bản nháp còn hơn crash cả trang.
      }
    });
  }, []);

  const hienThi = useMemo(() => {
    const s = boDau(q.trim());
    if (!s) return rows;
    return rows.filter((r) =>
      [r.ho_ten, r.email, r.sdt, r.checkin_code].some((v) => boDau(v ?? "").includes(s)),
    );
  }, [rows, q]);

  const la = [...choDienLa(tieuDe), ...choDienLa(noiDung)];
  const soChon = chon.size;
  const idMau = rows.find((r) => chon.has(r.id))?.id ?? "";
  const duNoiDung = tieuDe.trim() !== "" && noiDung.trim() !== "";
  const sanSang = soChon > 0 && duNoiDung && la.length === 0 && dangChay === "";
  const khopSo = soXacNhan.trim() === String(soChon);
  // Bản xem trước chỉ còn đúng khi tiêu đề, nội dung VÀ mẹ làm mẫu đều chưa đổi
  // kể từ lúc dựng nó — sửa một trong ba mà không xem lại thì bản xem trước cũ
  // không còn phản ánh đúng thứ sắp bay tới hàng trăm hộp thư.
  const xemCu =
    xemTruoc !== null &&
    (xemTruoc.tieuDe !== tieuDe || xemTruoc.noiDung !== noiDung || xemTruoc.idMau !== idMau);
  const xemMoi = xemTruoc !== null && !xemCu;

  function bat(id: string) {
    setChon((cu) => {
      const moi = new Set(cu);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });
  }

  async function goi(che_do: "xem" | "thu" | "that") {
    setDangChay(che_do);
    setKetQua(null);
    try {
      const res = await fetch("/api/admin/gui-mail-hang-loat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          che_do,
          tieuDe,
          noiDung,
          ...(che_do === "that"
            ? { ids: [...chon], xacNhanSoLuong: chon.size }
            : { idMau, ...(che_do === "thu" ? { toiEmail } : {}) }),
        }),
      });
      if (res.status === 401) {
        // Phiên có thể hết hạn giữa lúc admin đang gõ dở (tab để mở qua đêm,
        // TTL 12h). Mất trắng một bản nháp 5000 ký tự và cả trăm mẹ đã tick
        // không phải cái giá admin nên trả — cất tạm vào sessionStorage, effect
        // ở đầu component sẽ phục hồi lại khi trang này mở lần kế tiếp.
        try {
          sessionStorage.setItem(
            KHOA_NHAP_TAM,
            JSON.stringify({ tieuDe, noiDung, ids: [...chon] }),
          );
        } catch {
          // sessionStorage bị chặn (chế độ ẩn danh, quota đầy) — mất nháp còn
          // hơn chặn luôn việc đăng nhập lại.
        }
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setKetQua({ ok: false, text: data.error ?? "Thất bại" });
        // Xem lại thất bại thì bản xem trước CŨ (nếu có) không còn đáng tin —
        // xoá hẳn, đừng để nó nằm cạnh dòng lỗi đỏ trông như vẫn dùng được.
        if (che_do === "xem") setXemTruoc(null);
        return;
      }
      if (che_do === "xem") {
        setXemTruoc({ subject: data.subject, html: data.html, tieuDe, noiDung, idMau });
      } else if (che_do === "thu") {
        setKetQua({ ok: true, text: `Đã gửi thử tới ${toiEmail}` });
      } else {
        setKetQua({ ok: true, text: `Đã gửi ${data.daGui} email` });
        setSoXacNhan("");
        // Bỏ chọn hết ngay sau khi gửi: không có cổng chống trùng phía server
        // (cố tình ngoài phạm vi), nên nút "Gửi thật" tự tắt lại là lớp chắn
        // DUY NHẤT chống một cú bấm nhầm gửi lặp lại đúng lượt vừa xong.
        setChon(new Set());
      }
    } catch {
      // KHÔNG nói "chưa gửi": request đã bay đi thì client không biết Brevo đã
      // nhận chưa. Nói "chưa gửi" là dụ admin bấm lại và 500 mẹ nhận hai lần.
      setKetQua({
        ok: false,
        text:
          che_do === "that"
            ? "Mất kết nối. KHÔNG chắc đã gửi hay chưa — kiểm tra nhật ký Brevo trước khi gửi lại."
            : "Không kết nối được. Thử lại.",
      });
      // Cùng lý do với nhánh !res.ok ở trên: đừng để bản xem trước cũ đứng
      // cạnh thông báo lỗi trông như vẫn còn dùng được.
      if (che_do === "xem") setXemTruoc(null);
    } finally {
      setDangChay("");
    }
  }

  return (
    <main className="flex-1 bg-cream">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-ink">Gửi email hàng loạt</h1>
          <Link
            href="/admin"
            className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink-faded hover:bg-primary-faded-hover"
          >
            ← Danh sách
          </Link>
        </div>

        {/* ---------- Chọn người nhận ---------- */}
        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink">
              Đã chọn <strong className="text-primary">{soChon}</strong> / {rows.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setChon((cu) => new Set([...cu, ...hienThi.map((r) => r.id)]))}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-primary-faded-hover"
              >
                Chọn tất cả đang hiện ({hienThi.length})
              </button>
              <button
                onClick={() => setChon(new Set())}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-faded hover:bg-primary-faded-hover"
              >
                Bỏ chọn tất cả
              </button>
            </div>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên, email, SĐT hoặc mã..."
            className="mt-4 w-full rounded-xl border border-line px-4 py-3 text-base text-ink placeholder:text-ink-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary sm:max-w-md"
          />

          <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 border-b border-line bg-white text-ink-faded">
                <tr>
                  <th className="px-3 py-2 font-semibold">Chọn</th>
                  <th className="px-3 py-2 font-semibold">Họ tên</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Tỉnh/thành</th>
                  <th className="px-3 py-2 font-semibold">Đồng ý nhận tin</th>
                </tr>
              </thead>
              <tbody>
                {hienThi.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={chon.has(r.id)}
                        onChange={() => bat(r.id)}
                        aria-label={`Chọn ${r.ho_ten}`}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-ink">{r.ho_ten}</div>
                      <div className="text-xs text-ink-faded">{r.checkin_code}</div>
                    </td>
                    <td className="px-3 py-2 text-ink">{r.email}</td>
                    <td className="px-3 py-2 text-ink">{r.tinh_thanh}</td>
                    <td className="px-3 py-2 text-ink">
                      {r.dong_y_nhan_tin ? "Có" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- Soạn ---------- */}
        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          <label htmlFor="tieu-de" className="text-sm font-semibold text-ink">
            Tiêu đề
          </label>
          <input
            id="tieu-de"
            value={tieuDe}
            onChange={(e) => setTieuDe(e.target.value)}
            maxLength={200}
            className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <label htmlFor="noi-dung" className="mt-4 block text-sm font-semibold text-ink">
            Nội dung
          </label>
          <textarea
            id="noi-dung"
            value={noiDung}
            onChange={(e) => setNoiDung(e.target.value)}
            rows={10}
            maxLength={5000}
            className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-base leading-6 text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="mt-2 text-sm text-ink-faded">
            Gõ chữ thường. Dòng trống ngăn đoạn. Dùng được{" "}
            <code className="rounded bg-cream px-1">{"{{ten}}"}</code> và{" "}
            <code className="rounded bg-cream px-1">{"{{ma}}"}</code>.
          </p>
          {la.length > 0 && (
            <p role="alert" className="mt-2 text-sm font-semibold text-danger">
              Chỗ điền không hợp lệ: {la.join(", ")} — chỉ dùng {"{{ten}}"} và {"{{ma}}"}.
            </p>
          )}
        </section>

        {/* ---------- Xem trước / gửi thử ---------- */}
        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          {soChon === 0 && (
            <p className="text-sm text-ink-faded">
              Chọn ít nhất một mẹ để xem trước — bản xem trước dựng bằng dữ liệu thật
              của mẹ đầu tiên đã chọn.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <button
              onClick={() => void goi("xem")}
              disabled={!sanSang}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dangChay === "xem" ? "Đang dựng..." : "Xem trước"}
            </button>
            <div>
              <label htmlFor="toi-email" className="text-xs text-ink-faded">
                Gửi thử tới
              </label>
              <input
                id="toi-email"
                value={toiEmail}
                onChange={(e) => setToiEmail(e.target.value)}
                className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => void goi("thu")}
              disabled={!sanSang || !toiEmail.trim()}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dangChay === "thu" ? "Đang gửi..." : "Gửi thử"}
            </button>
          </div>

          {xemTruoc && (
            <div className="mt-4">
              <p className="text-sm text-ink">
                Tiêu đề: <strong>{xemTruoc.subject}</strong>
              </p>
              <div className="relative mt-2">
                {xemCu && (
                  <p
                    role="alert"
                    className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-danger bg-white px-4 py-1.5 text-xs font-bold text-danger shadow"
                  >
                    Bản xem trước đã CŨ — bấm &quot;Xem trước&quot; lại trước khi gửi
                  </p>
                )}
                <iframe
                  title="Xem trước email"
                  srcDoc={xemTruoc.html}
                  className={`h-96 w-full rounded-xl border bg-white ${
                    xemCu ? "border-danger opacity-50" : "border-line"
                  }`}
                />
              </div>
            </div>
          )}
        </section>

        {/* ---------- Gửi thật ---------- */}
        <section className="mt-6 rounded-2xl border-2 border-danger bg-white p-5">
          <p className="text-sm font-semibold text-ink">
            Gửi thật cho {soChon} mẹ — không thu hồi được
          </p>
          <p className="mt-1 text-sm text-ink-faded">
            Gõ đúng số <strong className="text-ink">{soChon}</strong> vào ô dưới để mở nút gửi.
          </p>
          {/* Bắt buộc phải có một bản xem trước CÒN MỚI (đúng tiêu đề, nội dung,
              mẹ làm mẫu hiện tại) mới cho gửi thật — chặn đúng ca sửa nội dung
              sau khi đã xem trước rồi bấm gửi luôn mà không xem lại. */}
          {!xemMoi && (
            <p className="mt-1 text-sm font-semibold text-danger">
              {xemTruoc === null
                ? 'Chưa có bản xem trước — bấm "Xem trước" ở trên trước khi gửi thật.'
                : 'Bản xem trước đã cũ — bấm "Xem trước" lại trước khi gửi thật.'}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              value={soXacNhan}
              onChange={(e) => setSoXacNhan(e.target.value)}
              inputMode="numeric"
              placeholder={String(soChon)}
              aria-label="Gõ số người nhận để xác nhận"
              className="w-32 rounded-xl border border-line px-4 py-3 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => void goi("that")}
              disabled={!sanSang || !khopSo || !xemMoi}
              className="rounded-full bg-danger px-6 py-3 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dangChay === "that" ? "Đang gửi..." : `Gửi cho ${soChon} mẹ`}
            </button>
          </div>
        </section>

        {ketQua && (
          <p
            role="alert"
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              ketQua.ok
                ? "border-success bg-white text-ink"
                : "border-danger bg-white text-danger"
            }`}
          >
            {ketQua.text}
          </p>
        )}
      </div>
    </main>
  );
}
