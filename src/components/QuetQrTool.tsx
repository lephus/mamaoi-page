"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { maTuQr } from "@/lib/ma-tu-qr";

/** Kiểu tối thiểu của instance qr-scanner mà file này dùng tới. */
type Scanner = {
  start: () => Promise<void>;
  pause: () => void;
  destroy: () => void;
};

type Man =
  | { loai: "cho" }
  | { loai: "quet" }
  | { loai: "docDuoc"; ma: string }
  | { loai: "loi"; text: string };

export function QuetQrTool() {
  const [man, setMan] = useState<Man>({ loai: "cho" });
  const [dangBat, setDangBat] = useState(false);
  const [maGoTay, setMaGoTay] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<Scanner | null>(null);
  // `man` đọc qua ref trong callback giải mã: callback được tạo MỘT lần lúc
  // dựng scanner, nên nó sẽ mãi thấy giá trị `man` của lần render đầu nếu đọc
  // thẳng. Đồng bộ trong useEffect, KHÔNG gán khi render — React cấm ghi ref
  // trong lúc render (cùng lý do `busyRef` ở AdminDashboard.tsx).
  const manRef = useRef<Man>(man);
  useEffect(() => {
    manRef.current = man;
  }, [man]);

  // Dừng và giải phóng hẳn scanner đang giữ (nếu có). Gọi ở MỌI lối thoát khỏi
  // "quet" không phải do đọc mã thành công, và trước khi tạo scanner mới:
  // `pause()` mà `nhanMa` dùng cho ca đọc-mã-thành-công đã đủ, vì bản thân
  // thư viện tự tắt stream ~300ms sau đó — nhưng khi `start()` ném lỗi (đúng ca
  // Safari iOS reject `play()` sau khi stream đã gán vào <video>), qr-scanner
  // KHÔNG tự dừng stream đó (đã soi trong mã nguồn `qr-scanner.min.js`). Không
  // destroy tay ở những chỗ này thì đèn camera vẫn sáng dù màn hình đang báo
  // lỗi — đúng thứ effect dọn dẹp lúc rời trang bên dưới đang cố tránh.
  const dungScanner = useCallback(() => {
    scannerRef.current?.destroy();
    scannerRef.current = null;
  }, []);

  const nhanMa = useCallback((ma: string) => {
    scannerRef.current?.pause();
    setMan({ loai: "docDuoc", ma });
  }, []);

  /**
   * Bật camera. Nạp thư viện bằng `import()` động chứ không import ở đầu file vì
   * hai lý do: (1) `qr-scanner` đụng `document`/`Worker` nên không sống được ở
   * bước SSR mà Next vẫn chạy cho component client; (2) 15KB đó chỉ cần khi
   * người dùng thật sự quét.
   *
   * Có nút bấm chứ không tự mở lúc tải trang: Safari trên iOS chỉ tin
   * `getUserMedia` khi nó nằm trong một cử chỉ người dùng; tự xin quyền lúc tải
   * dễ bị chặn im lặng, và nhân viên chỉ thấy màn hình đen mà không hiểu vì sao.
   */
  const batCamera = useCallback(async () => {
    if (!videoRef.current || dangBat) return;
    setDangBat(true);
    try {
      const { default: QrScanner } = await import("qr-scanner");

      if (!(await QrScanner.hasCamera())) {
        setMan({
          loai: "loi",
          text: "Máy này không có camera dùng được. Nhập mã bằng tay ở dưới.",
        });
        return;
      }

      // Dọn instance cũ trước khi tạo cái mới — phòng một lượt "Bật camera"
      // trước đó đã gán scanner vào ref rồi hỏng giữa chừng mà chưa kịp destroy
      // (ví dụ đúng nhánh lỗi bên dưới, hoặc ca gõ tay sai lúc đang quét).
      dungScanner();

      const scanner = new QrScanner(
        videoRef.current,
        (kq: { data: string }) => {
          // Chỉ nhận khi đang ở màn quét — tránh một khung hình đến muộn ghi đè
          // lên thẻ xác nhận vừa hiện.
          if (manRef.current.loai !== "quet") return;
          const ma = maTuQr(kq.data);
          // QR lạ (wifi, Momo, tờ rơi) → BỎ QUA IM LẶNG, quét tiếp. Báo lỗi ở
          // đây sẽ nhấp nháy mỗi khung hình.
          if (!ma) return;
          nhanMa(ma);
        },
        {
          returnDetailedScanResult: true,
          preferredCamera: "environment",
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
        },
      );
      scannerRef.current = scanner as unknown as Scanner;
      await scanner.start();
      setMan({ loai: "quet" });
    } catch {
      // `start()` có thể ném lỗi SAU KHI đã gán MediaStream vào <video>.srcObject
      // (đúng ca Safari iOS reject `play()`) — thư viện không tự dừng stream
      // trong nhánh này, nên phải destroy tay, không thì camera vẫn sáng dù
      // màn hình đang báo lỗi "Không mở được".
      dungScanner();
      setMan({
        loai: "loi",
        text: "Không mở được camera. Kiểm tra quyền camera trong Cài đặt trình duyệt, hoặc nhập mã bằng tay ở dưới.",
      });
    } finally {
      setDangBat(false);
    }
  }, [dangBat, nhanMa, dungScanner]);

  // Tắt camera khi rời trang — không để đèn camera sáng suốt buổi.
  useEffect(() => {
    return () => {
      dungScanner();
    };
  }, [dungScanner]);

  function guiMaGoTay(e: React.FormEvent) {
    e.preventDefault();
    const ma = maTuQr(maGoTay);
    if (!ma) {
      // Gõ sai ngay lúc camera đang "quet": destroy luôn, không thì stream vẫn
      // sống dưới màn báo lỗi này, và lượt "Bật camera" kế tiếp (đi từ "Thử
      // lại") tạo thêm một scanner mới đè lên mà không tắt cái cũ — rò rỉ y hệt
      // ca `start()` fail ở `batCamera`.
      dungScanner();
      setMan({ loai: "loi", text: `Mã "${maGoTay.trim()}" không đúng định dạng MO-XXXXXX.` });
      return;
    }
    setMaGoTay("");
    nhanMa(ma);
  }

  return (
    <main className="flex-1 bg-cream">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-ink">Quét QR check-in</h1>
          <Link
            href="/admin"
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-faded hover:bg-primary-faded-hover"
          >
            ← Danh sách
          </Link>
        </div>

        {/* Khung camera. Giữ trong DOM ở MỌI trạng thái: qr-scanner gắn vào
            đúng thẻ <video> này, tháo nó ra khi hiện thẻ xác nhận là mất luôn
            instance. Chỉ ẩn bằng CSS. */}
        <div className={`mt-5 ${man.loai === "quet" ? "" : "hidden"}`}>
          <video
            ref={videoRef}
            className="aspect-square w-full rounded-2xl border border-line bg-black object-cover"
            playsInline
            muted
          />
          <p className="mt-3 text-center text-sm text-ink-faded">
            Đưa mã QR trên điện thoại của mẹ vào khung.
          </p>
        </div>

        {man.loai === "cho" && (
          <div className="mt-5 rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-sm leading-6 text-ink-faded">
              Bấm để mở camera. Trình duyệt sẽ hỏi quyền — chọn &ldquo;Cho
              phép&rdquo;.
            </p>
            <button
              onClick={batCamera}
              disabled={dangBat}
              className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-base font-bold text-white disabled:opacity-60"
            >
              {dangBat ? "Đang mở camera..." : "Bật camera"}
            </button>
          </div>
        )}

        {man.loai === "docDuoc" && (
          <div className="mt-5 rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-sm text-ink-faded">Đọc được mã</p>
            <p className="mt-2 font-mono text-xl font-bold tracking-wider text-ink">
              {man.ma}
            </p>
            <button
              onClick={() => {
                setMan({ loai: "quet" });
                // `.start()` resume có thể fail (stream đã bị hệ điều hành thu
                // hồi, quyền camera mất giữa chừng…) — không bắt thì màn hình
                // đứng ở "quet" trong khi camera thật ra đã tắt mà không nói gì.
                // Dọn scanner hỏng rồi trả về "loi" để nhân viên còn thấy ô
                // nhập mã tay ngay bên dưới.
                scannerRef.current?.start().catch(() => {
                  dungScanner();
                  setMan({
                    loai: "loi",
                    text: "Không mở lại được camera. Bấm Thử lại, hoặc nhập mã bằng tay ở dưới.",
                  });
                });
              }}
              className="mt-4 w-full rounded-full border border-line px-6 py-3 text-base font-bold text-ink"
            >
              Quét tiếp
            </button>
          </div>
        )}

        {man.loai === "loi" && (
          <div className="mt-5 rounded-2xl border border-danger bg-white p-6">
            <p role="alert" className="text-sm leading-6 text-danger">
              {man.text}
            </p>
            <button
              onClick={() => setMan({ loai: "cho" })}
              className="mt-4 w-full rounded-full border border-line px-6 py-3 text-base font-bold text-ink"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Ô nhập mã tay là đường thoát BẮT BUỘC, không phải phụ kiện: vé của mẹ
            đã tính sẵn ca "Không tạo được mã QR — mẹ đọc mã cho nhân viên"
            (CheckinPass.tsx). Cộng thêm màn hình vỡ, độ sáng thấp, ảnh chụp màn
            hình bị nén, và ca nhân viên lỡ từ chối quyền camera. */}
        <form onSubmit={guiMaGoTay} className="mt-6">
          <label htmlFor="ma-tay" className="text-sm font-semibold text-ink">
            Hoặc nhập mã bằng tay
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="ma-tay"
              value={maGoTay}
              onChange={(e) => setMaGoTay(e.target.value)}
              placeholder="MO-ABC234"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 font-mono text-base uppercase text-ink placeholder:font-sans placeholder:text-ink-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!maGoTay.trim()}
              className="shrink-0 rounded-xl bg-primary px-5 py-3 text-base font-bold text-white disabled:opacity-50"
            >
              Tra
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
