"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { THIEU } from "@/lib/constants";

type DaTao = { code: string; hoTen: string; email: string; daGuiMail: boolean; luc: string };

type KetQua =
  | {
      loai: "xong";
      code: string;
      hoTen: string;
      email: string;
      sdt: string;
      warnings: string[];
    }
  | { loai: "trung"; code: string; hoTen: string; text: string }
  | {
      loai: "loi";
      text: string;
      chiTiet?: string;
      fieldErrors?: Record<string, string>;
    };

/**
 * Những gì sẽ được ghi là "chưa hỏi". Hiện THẲNG ra trước khi ops bấm tạo —
 * dòng này sống trong bảng 500 mẹ và trong file Excel gửi khách, nên ops phải
 * thấy trước chính xác mình đang tạo ra cái gì, không phải phát hiện sau.
 *
 * SĐT KHÔNG nằm trong danh sách cứng này: nó là ô duy nhất ops điền được ngay,
 * nên nó tự được thêm vào / bỏ ra theo đúng thứ ops vừa gõ.
 */
const SE_THIEU = [
  "Tỉnh/Thành",
  "Tình trạng (mang thai / đã sinh…)",
  "Chủ đề quan tâm",
  "Nguồn biết đến",
  "Thông tin bé",
];

export function ThemDangKyTool() {
  const [hoTen, setHoTen] = useState("");
  const [email, setEmail] = useState("");
  const [sdt, setSdt] = useState("");
  const [guiEmail, setGuiEmail] = useState(true);
  const [dongYNhanTin, setDongYNhanTin] = useState(false);

  const [dangTao, setDangTao] = useState(false);
  const [ketQua, setKetQua] = useState<KetQua | null>(null);
  const [nhatKy, setNhatKy] = useState<DaTao[]>([]);

  const idHoTen = useId();
  const idEmail = useId();
  const idSdt = useId();

  const loiTruong = ketQua?.loai === "loi" ? ketQua.fieldErrors : undefined;
  /** Ô SĐT bỏ trống thì nó cũng là một dòng "--", nên phải nằm trong bảng bên phải. */
  const seThieu = sdt.trim() ? SE_THIEU : ["Số điện thoại", ...SE_THIEU];

  async function tao() {
    setDangTao(true);
    setKetQua(null);
    try {
      const res = await fetch("/api/admin/them-dang-ky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hoTen, email, sdt, guiEmail, dongYNhanTin }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setKetQua({ loai: "trung", code: data.code, hoTen: data.hoTen, text: data.error });
        return;
      }
      if (!res.ok) {
        setKetQua({
          loai: "loi",
          text: data.error ?? `Lỗi ${res.status}`,
          chiTiet: data.chiTiet,
          fieldErrors: data.fieldErrors,
        });
        return;
      }

      setKetQua({
        loai: "xong",
        code: data.code,
        hoTen: data.hoTen,
        email: data.email,
        sdt: data.sdt ?? "",
        warnings: data.warnings ?? [],
      });
      setNhatKy((n) => [
        {
          code: data.code,
          hoTen: data.hoTen,
          email: data.email,
          // Email CÓ THỂ đã hỏng dù lượt tạo thành công — nhật ký phải nói đúng
          // chuyện đã xảy ra, không phải chuyện ops vừa yêu cầu.
          daGuiMail: guiEmail && !(data.warnings ?? []).includes("email"),
          luc: new Date().toLocaleTimeString("vi-VN"),
        },
        ...n,
      ]);
      // Dọn ô nhập để gõ mẹ tiếp theo; giữ nguyên hai ô tick vì ops thường tạo
      // một loạt theo cùng một kiểu.
      setHoTen("");
      setEmail("");
      setSdt("");
    } catch (err) {
      setKetQua({
        loai: "loi",
        text: `Không gọi được server — chưa tạo gì cả. ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    } finally {
      setDangTao(false);
    }
  }

  const oNhap =
    "mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <main className="flex-1 bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Thêm đăng ký thủ công</h1>
            <p className="mt-1 text-sm text-ink-faded">
              Dành cho mẹ đăng ký qua kênh khác. Chỉ cần họ tên và email.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink-faded hover:bg-primary-faded-hover"
          >
            ← Về Admin
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
          {/* ── Cột trái: nhập + tạo ── */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-line bg-white p-5">
              <label htmlFor={idHoTen} className="block text-sm font-bold text-ink">
                Họ tên
              </label>
              <input
                id={idHoTen}
                type="text"
                value={hoTen}
                autoComplete="off"
                placeholder="Nguyễn Thị Lan"
                aria-invalid={Boolean(loiTruong?.hoTen)}
                onChange={(e) => setHoTen(e.target.value)}
                className={oNhap}
              />
              {loiTruong?.hoTen && (
                <p role="alert" className="mt-1.5 text-sm text-danger">
                  {loiTruong.hoTen}
                </p>
              )}

              <label htmlFor={idEmail} className="mt-5 block text-sm font-bold text-ink">
                Email
              </label>
              <input
                id={idEmail}
                type="email"
                value={email}
                autoComplete="off"
                placeholder="lan@example.com"
                aria-invalid={Boolean(loiTruong?.email)}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !dangTao) void tao();
                }}
                className={oNhap}
              />
              {loiTruong?.email && (
                <p role="alert" className="mt-1.5 text-sm text-danger">
                  {loiTruong.email}
                </p>
              )}

              <label htmlFor={idSdt} className="mt-5 block text-sm font-bold text-ink">
                Số điện thoại{" "}
                <span className="font-normal text-ink-faded">— không bắt buộc</span>
              </label>
              <input
                id={idSdt}
                type="tel"
                inputMode="tel"
                value={sdt}
                autoComplete="off"
                placeholder="0901234567"
                aria-invalid={Boolean(loiTruong?.sdt)}
                aria-describedby={`${idSdt}-mo-ta`}
                onChange={(e) => setSdt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !dangTao) void tao();
                }}
                className={oNhap}
              />
              {loiTruong?.sdt ? (
                <p role="alert" className="mt-1.5 text-sm text-danger">
                  {loiTruong.sdt}
                </p>
              ) : (
                <p id={`${idSdt}-mo-ta`} className="mt-1.5 text-sm text-ink-faded">
                  Bỏ trống nếu chưa có. Đã nhập thì phải là số Việt Nam hợp lệ.
                </p>
              )}

              <div className="mt-5 space-y-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={guiEmail}
                    onChange={(e) => setGuiEmail(e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
                  />
                  <span className="text-sm text-ink">
                    <strong className="font-bold">Gửi email xác nhận kèm mã QR</strong>
                    <span className="block text-ink-faded">
                      Bỏ tick nếu chỉ muốn tạo bản ghi. Gửi sau được ở “Gửi lại email QR”.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={dongYNhanTin}
                    onChange={(e) => setDongYNhanTin(e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
                  />
                  <span className="text-sm text-ink">
                    <strong className="font-bold">Mẹ đã đồng ý nhận thông tin</strong>
                    <span className="block text-ink-faded">
                      Chỉ tick khi mẹ thực sự đã đồng ý. Ô này chi phối mọi lượt gửi tin về sau.
                    </span>
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={tao}
                disabled={dangTao || !hoTen.trim() || !email.trim()}
                className="mt-5 w-full cursor-pointer rounded-full bg-primary px-5 py-3.5 text-base font-extrabold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {dangTao ? "Đang tạo…" : "Tạo đăng ký"}
              </button>

              {ketQua?.loai === "loi" && (
                <div role="alert" className="mt-4 rounded-xl bg-primary-faded px-4 py-3 text-sm text-danger">
                  <strong>{ketQua.text}</strong>
                  {ketQua.chiTiet && (
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">
                      {ketQua.chiTiet}
                    </pre>
                  )}
                  {/* Lỗi hay gặp nhất và tốn nhiều thời gian nhất để đoán ra:
                      file SQL nới `trang_thai` chưa được chạy trên Supabase.
                      Nhận diện thẳng từ câu lỗi Postgres và chỉ luôn cách sửa. */}
                  {ketQua.chiTiet?.includes("trang_thai") &&
                    ketQua.chiTiet.includes("not-null") && (
                      <p className="mt-2">
                        Chưa chạy migration. Mở Supabase → SQL editor và chạy nội dung file{" "}
                        <code className="font-mono">
                          supabase/2026-07-28-dang-ky-thu-cong.sql
                        </code>
                        .
                      </p>
                    )}
                </div>
              )}

              {ketQua?.loai === "trung" && (
                <div role="alert" className="mt-4 rounded-xl bg-warning-faded px-4 py-3 text-sm text-ink">
                  <strong>{ketQua.text}</strong>
                  <p className="mt-2">
                    Mã hiện tại của <strong>{ketQua.hoTen}</strong>:{" "}
                    <span className="font-mono font-bold text-primary">{ketQua.code}</span>
                  </p>
                  <Link href="/admin/gui-mail" className="mt-2 inline-block font-bold underline">
                    Sang trang gửi lại email QR →
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-faded">
                Đã tạo trong phiên này
              </h2>
              {nhatKy.length === 0 ? (
                <p className="mt-3 text-sm text-ink-faded">Chưa tạo đăng ký nào.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line text-sm">
                  {nhatKy.map((g, i) => (
                    <li key={`${g.code}-${i}`} className="py-2.5">
                      <span className="font-semibold text-ink">{g.hoTen}</span>
                      <span className="block text-xs text-ink-faded">
                        {g.code} · {g.email} · {g.daGuiMail ? "đã gửi mail" : "chưa gửi mail"} ·{" "}
                        {g.luc}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ── Cột phải: kết quả / những gì sẽ thiếu ── */}
          <div className="rounded-2xl border border-line bg-white p-5">
            {ketQua?.loai === "xong" ? (
              <>
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-faded">
                  Đã tạo xong
                </h2>
                <p className="mt-3 text-lg font-extrabold text-ink">{ketQua.hoTen}</p>
                <p className="text-sm text-ink-faded">
                  {ketQua.email}
                  {/* Số ĐÃ CHUẨN HOÁ, không phải chuỗi ops vừa gõ. */}
                  {ketQua.sdt && ` · ${ketQua.sdt}`}
                </p>

                <div className="mt-4 rounded-xl bg-cream px-4 py-3 text-center">
                  <p className="text-sm text-ink-faded">Mã check-in</p>
                  <p className="font-mono text-2xl font-extrabold tracking-wider text-primary">
                    {ketQua.code}
                  </p>
                </div>

                <div className="mt-4 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/qr?code=${encodeURIComponent(ketQua.code)}`}
                    alt={`Mã QR check-in ${ketQua.code}`}
                    width={168}
                    height={168}
                    className="inline-block rounded-xl border border-line"
                  />
                </div>

                {/* Cảnh báo phải to và nói rõ HỆ QUẢ. "warnings: [email]" nghĩa là
                    mẹ chưa cầm vé — ops phải biết ngay để đi gửi lại, chứ không
                    phải đọc được một chữ "thành công" rồi bỏ qua. */}
                {ketQua.warnings.includes("email") && (
                  <p role="alert" className="mt-4 rounded-xl bg-primary-faded px-4 py-3 text-sm text-danger">
                    <strong>Email KHÔNG gửi được — mẹ chưa nhận mã QR.</strong> Bản ghi đã lưu
                    an toàn. Vào{" "}
                    <Link href="/admin/gui-mail" className="font-bold underline">
                      Gửi lại email QR
                    </Link>{" "}
                    để gửi lại.
                  </p>
                )}
                {ketQua.warnings.includes("sheets") && (
                  <p role="alert" className="mt-3 rounded-xl bg-warning-faded px-4 py-3 text-sm text-ink">
                    <strong>Chưa ghi được vào Google Sheet.</strong> Mẹ vẫn check-in bình thường;
                    chỉ bản mirror cho ops là thiếu dòng này.
                  </p>
                )}
                {!ketQua.warnings.includes("email") && (
                  <p className="mt-4 rounded-xl bg-secondary-faded px-4 py-3 text-sm text-secondary">
                    {guiEmail
                      ? `Đã gửi email kèm mã QR tới ${ketQua.email}.`
                      : "Chưa gửi email (không tick). Mã đã sẵn sàng để gửi sau."}
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-faded">
                  Đăng ký này sẽ thiếu gì
                </h2>
                <p className="mt-3 text-sm text-ink-faded">
                  Các trường dưới đây được ghi là <strong className="text-ink">{THIEU}</strong> vì
                  chưa hỏi mẹ. Mẹ tự đăng ký lại bằng cùng email sẽ tự động điền đủ.
                </p>
                <ul className="mt-3 space-y-2">
                  {seThieu.map((t) => (
                    <li
                      key={t}
                      className="flex items-baseline justify-between gap-4 border-b border-line/60 py-2 last:border-0"
                    >
                      <span className="text-sm text-ink">{t}</span>
                      <span className="font-mono text-sm font-bold text-ink-placeholder">
                        {THIEU}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 rounded-xl bg-warning-faded px-4 py-3 text-sm text-ink">
                  Mẹ được tạo ở đây <strong>chiếm một chỗ</strong> trong sức chứa sự kiện, giống
                  đăng ký thật.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
