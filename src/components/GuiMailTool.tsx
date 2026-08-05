"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MAU_THU_TU, NHAN_MAU, VI_DU, type MauEmail } from "@/lib/mau-email";
import type { RegistrationRow } from "@/lib/supabase";
import { boDau } from "@/lib/text";

/** Bao nhiêu kết quả hiện trong dropdown. Đủ để chọn, không đủ để phải cuộn mỏi tay. */
const GIOI_HAN_GOI_Y = 40;

type DaGui = { code: string; hoTen: string; email: string; mau: MauEmail; luc: string };

export function GuiMailTool({ rows }: { rows: RegistrationRow[] }) {
  const [q, setQ] = useState("");
  const [moGoiY, setMoGoiY] = useState(false);
  const [chon, setChon] = useState<RegistrationRow | null>(null);
  const [conTro, setConTro] = useState(0);
  const [mau, setMau] = useState<MauEmail>("capLai");

  const [xemTruoc, setXemTruoc] = useState<{ subject: string; html: string } | null>(null);
  const [loiXemTruoc, setLoiXemTruoc] = useState("");

  const [dangGui, setDangGui] = useState(false);
  const [ketQua, setKetQua] = useState<{ ok: boolean; text: string; chiTiet?: string } | null>(null);
  const [nhatKy, setNhatKy] = useState<DaGui[]>([]);

  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  /* Tìm theo mã, tên, email, SĐT — bỏ dấu để gõ "nguyen thi lan" vẫn ra
     "Nguyễn Thị Lan". Ops đọc mã từ Zalo/điện thoại, không ai gõ đủ dấu. */
  const goiY = useMemo(() => {
    const s = boDau(q.trim());
    if (!s) return rows.slice(0, GIOI_HAN_GOI_Y);
    return rows
      .filter((r) =>
        [r.checkin_code, r.ho_ten, r.email, r.sdt].some((v) => boDau(v ?? "").includes(s)),
      )
      .slice(0, GIOI_HAN_GOI_Y);
  }, [rows, q]);

  // Bấm ra ngoài thì đóng gợi ý.
  useEffect(() => {
    function ngoai(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setMoGoiY(false);
    }
    document.addEventListener("mousedown", ngoai);
    return () => document.removeEventListener("mousedown", ngoai);
  }, []);

  /* Bản xem trước lấy TỪ SERVER, không dựng lại HTML ở client: dựng hai nơi là
     bản xem trước và bản gửi thật sẽ trôi lệch, mà đó đúng là thứ trang này
     sinh ra để chống.
     Effect này CHỈ đi lấy dữ liệu — mọi lượt dọn state nằm ở `doiLuaChon()`
     bên dưới, nơi người dùng thực sự bấm. */
  useEffect(() => {
    const huy = new AbortController();
    /* Chưa chọn mẹ vẫn xem được câu chữ của mẫu, chỉ là bằng dữ liệu ví dụ.
       Khoá bản xem trước sau việc chọn mẹ (bản đầu tôi làm vậy) khiến dropdown
       "Mẫu email" trông như hỏng: đổi mẫu mà bên cạnh không nhúc nhích, vì bố
       cục mẫu vốn chẳng phụ thuộc vào ai — chỉ tên và mã mới phụ thuộc. */
    const qs = chon
      ? `code=${encodeURIComponent(chon.checkin_code)}&mau=${mau}`
      : `mau=${mau}&mauThu=1`;
    fetch(`/api/admin/gui-mail?${qs}`, { signal: huy.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Lỗi ${res.status}`);
        setXemTruoc({ subject: data.subject, html: data.html });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLoiXemTruoc(err.message);
      });
    return () => huy.abort();
  }, [chon, mau]);

  /* Suy ra, không lưu thành state: "chưa có kết quả lẫn lỗi" ĐÚNG BẰNG định
     nghĩa của đang tải. Thêm một biến state song song chỉ tạo cơ hội cho nó
     lệch pha với hai biến kia. */
  const dangTai = xemTruoc === null && loiXemTruoc === "";
  /** Mã mà khung xem trước đang minh hoạ — của mẹ đã chọn, hoặc mã ví dụ. */
  const maDangXem = chon?.checkin_code ?? VI_DU.code;

  /**
   * Dọn sạch mọi thứ phụ thuộc vào lựa chọn hiện tại.
   *
   * Gọi ở CHỖ NGƯỜI DÙNG BẤM chứ không trong effect: dọn trong effect vừa bị
   * lint chặn (cascading render), vừa để lọt một khoảnh khắc bản xem trước của
   * mẹ CŨ nằm cạnh tên mẹ MỚI — trên một trang mà bấm nhầm là gửi nhầm vé cho
   * người lạ, khoảnh khắc đó là thứ không được phép có.
   */
  function doiLuaChon(moi: RegistrationRow | null) {
    setChon(moi);
    setXemTruoc(null);
    setLoiXemTruoc("");
    setKetQua(null);
  }

  function chonMe(r: RegistrationRow) {
    doiLuaChon(r);
    setQ(`${r.checkin_code} — ${r.ho_ten}`);
    setMoGoiY(false);
  }

  function phim(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!moGoiY && (e.key === "ArrowDown" || e.key === "Enter")) {
      setMoGoiY(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setConTro((i) => Math.min(i + 1, goiY.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setConTro((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (goiY[conTro]) chonMe(goiY[conTro]);
    } else if (e.key === "Escape") {
      setMoGoiY(false);
    }
  }

  async function gui() {
    if (!chon) return;
    setDangGui(true);
    setKetQua(null);
    try {
      const res = await fetch("/api/admin/gui-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: chon.checkin_code, mau }),
      });
      const data = await res.json();
      if (!res.ok) {
        setKetQua({
          ok: false,
          text: `Gửi THẤT BẠI — ${chon.ho_ten} CHƯA nhận được email.`,
          chiTiet: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setKetQua({ ok: true, text: `Đã gửi tới ${data.email}` });
      setNhatKy((n) => [
        {
          code: chon.checkin_code,
          hoTen: data.hoTen,
          email: data.email,
          mau,
          luc: new Date().toLocaleTimeString("vi-VN"),
        },
        ...n,
      ]);
    } catch (err) {
      setKetQua({
        ok: false,
        text: "Không gọi được server — email CHƯA được gửi.",
        chiTiet: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDangGui(false);
    }
  }

  /* Cảnh báo nghiệp vụ: gửi email KHÔNG gỡ dấu đã-check-in. Không nói ở đây thì
     ops gửi mail "cấp lại mã" xong yên tâm, tới ngày sự kiện mẹ vẫn bị chặn ở
     cổng vì mã vẫn mang dấu đã dùng. */
  const canGoCheckin = chon?.checked_in && mau === "capLai";

  return (
    <main className="flex-1 bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Gửi lại email mã QR</h1>
            <p className="mt-1 text-sm text-ink-faded">
              Chọn mẹ theo mã check-in, hệ thống tự điền tên và email.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink-faded hover:bg-primary-faded-hover"
          >
            ← Về Admin
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          {/* ── Cột trái: chọn + gửi ── */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-line bg-white p-5">
              <label htmlFor="tim" className="block text-sm font-bold text-ink">
                Mã check-in
              </label>
              <div ref={boxRef} className="relative mt-2">
                <input
                  id="tim"
                  type="text"
                  role="combobox"
                  aria-expanded={moGoiY}
                  aria-controls={listId}
                  aria-autocomplete="list"
                  autoComplete="off"
                  value={q}
                  placeholder="Gõ mã, tên, email hoặc SĐT…"
                  onChange={(e) => {
                    setQ(e.target.value);
                    setConTro(0);
                    doiLuaChon(null);
                    setMoGoiY(true);
                  }}
                  onFocus={() => setMoGoiY(true)}
                  onKeyDown={phim}
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {moGoiY && (
                  <ul
                    id={listId}
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-line bg-white shadow-lg"
                  >
                    {goiY.length === 0 && (
                      <li className="px-4 py-3 text-sm text-ink-faded">Không tìm thấy mẹ nào.</li>
                    )}
                    {goiY.map((r, i) => (
                      <li key={r.id} role="option" aria-selected={i === conTro}>
                        <button
                          type="button"
                          onMouseEnter={() => setConTro(i)}
                          onClick={() => chonMe(r)}
                          className={`block w-full cursor-pointer px-4 py-2.5 text-left ${
                            i === conTro ? "bg-primary-faded-hover" : ""
                          }`}
                        >
                          <span className="block font-mono text-sm font-bold text-primary">
                            {r.checkin_code}
                          </span>
                          <span className="block text-sm font-semibold text-ink">{r.ho_ten}</span>
                          <span className="block text-xs text-ink-faded">
                            {r.email} · {r.sdt}
                            {r.checked_in && " · đã check-in"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {chon && (
                <dl className="mt-4 space-y-1.5 rounded-xl bg-cream px-4 py-3 text-sm">
                  {[
                    ["Họ tên", chon.ho_ten],
                    ["Email", chon.email],
                    ["SĐT", chon.sdt],
                    ["Check-in", chon.checked_in ? "Đã check-in" : "Chưa check-in"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                      <dt className="w-20 shrink-0 text-ink-faded">{k}</dt>
                      <dd className="font-semibold text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <label htmlFor="mau" className="mt-5 block text-sm font-bold text-ink">
                Mẫu email
              </label>
              <select
                id="mau"
                value={mau}
                onChange={(e) => {
                  setMau(e.target.value as MauEmail);
                  setXemTruoc(null);
                  setLoiXemTruoc("");
                  setKetQua(null);
                }}
                className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {MAU_THU_TU.map((m, i) => (
                  <option key={m} value={m}>
                    {i + 1} · {NHAN_MAU[m]}
                  </option>
                ))}
              </select>

              {canGoCheckin && (
                <p role="alert" className="mt-4 rounded-xl bg-warning-faded px-4 py-3 text-sm text-ink">
                  <strong>Mã này đang mang dấu “đã check-in”.</strong> Gửi email không gỡ dấu đó —
                  mẹ tới cổng vẫn bị báo đã vào. Vào{" "}
                  <Link href="/admin" className="font-bold underline">
                    Admin
                  </Link>{" "}
                  bỏ tick check-in cho dòng này trước.
                </p>
              )}

              <button
                type="button"
                onClick={gui}
                disabled={!chon || dangGui || !xemTruoc}
                className="mt-5 w-full cursor-pointer rounded-full bg-primary px-5 py-3.5 text-base font-extrabold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {dangGui ? "Đang gửi…" : chon ? `Gửi email tới ${chon.email}` : "Chọn một mẹ để gửi"}
              </button>

              {ketQua && (
                <div
                  role="alert"
                  className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                    ketQua.ok
                      ? "bg-secondary-faded text-secondary"
                      : "bg-primary-faded text-danger"
                  }`}
                >
                  <strong>{ketQua.text}</strong>
                  {ketQua.chiTiet && (
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">
                      {ketQua.chiTiet}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-faded">
                Đã gửi trong phiên này
              </h2>
              {nhatKy.length === 0 ? (
                <p className="mt-3 text-sm text-ink-faded">Chưa gửi email nào.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line text-sm">
                  {nhatKy.map((g, i) => (
                    <li key={`${g.code}-${i}`} className="py-2.5">
                      <span className="font-semibold text-ink">{g.hoTen}</span>
                      <span className="block text-xs text-ink-faded">
                        {g.code} · {g.email} · mẫu {MAU_THU_TU.indexOf(g.mau) + 1} · {g.luc}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ── Cột phải: xem trước ── */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-faded">Xem trước</h2>

            {/* Nhãn BẢN MẪU phải đập vào mắt: không ai được nhầm dữ liệu ví dụ
                với một mẹ có thật rồi tưởng mình sắp gửi cho người đó. */}
            {!chon && !dangTai && (
              <p className="mt-3 rounded-xl bg-warning-faded px-4 py-3 text-sm text-ink">
                <strong>Bản mẫu — dữ liệu ví dụ.</strong> Chọn một mẹ ở bên trái để xem đúng
                email sắp gửi.
              </p>
            )}
            {dangTai && <p className="mt-3 text-sm text-ink-faded">Đang dựng bản xem trước…</p>}
            {loiXemTruoc && (
              <p role="alert" className="mt-3 rounded-xl bg-primary-faded px-4 py-3 text-sm text-danger">
                {loiXemTruoc}
              </p>
            )}

            {xemTruoc && (
              <>
                <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-sm">
                  <span className="text-ink-faded">Tiêu đề: </span>
                  <span className="font-bold text-ink">{xemTruoc.subject}</span>
                </p>
                <div className="mt-4 text-center">
                  {/* Ảnh QR đúng bằng endpoint mà email dùng, để soi trước khi gửi. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/qr?code=${encodeURIComponent(maDangXem)}`}
                    alt={`Mã QR check-in ${maDangXem}`}
                    width={168}
                    height={168}
                    className="inline-block rounded-xl border border-line"
                  />
                </div>
                <iframe
                  title="Xem trước email"
                  srcDoc={xemTruoc.html}
                  className="mt-4 h-[640px] w-full rounded-xl border border-line bg-white"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
