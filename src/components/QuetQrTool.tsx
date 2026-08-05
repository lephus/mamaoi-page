"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { nguonCheckinLabel, trangThaiLabel } from "@/lib/constants";
import { maTuQr } from "@/lib/ma-tu-qr";
import type { ThongTinQuet } from "@/lib/thong-tin-quet";
import { formatCheckinTime } from "@/lib/time";

/** Kiểu tối thiểu của instance qr-scanner mà file này dùng tới. */
type Scanner = {
  start: () => Promise<void>;
  pause: () => void;
  destroy: () => void;
};

/** Bao lâu thì màn báo thành công tự nhường chỗ cho camera. */
const NGHI_SAU_KHI_XONG_MS = 2000;

type Man =
  | { loai: "cho" }
  | { loai: "quet" }
  | { loai: "dangTra"; ma: string }
  | { loai: "xacNhan"; row: ThongTinQuet }
  | { loai: "dangGhi"; row: ThongTinQuet }
  | { loai: "xong"; hoTen: string }
  // `ma` có mặt thì nút chính là "Thử lại" cho ĐÚNG mã đó — nhân viên không
  // phải bảo mẹ giơ điện thoại lên quét lại chỉ vì wifi rớt một nhịp.
  | { loai: "loi"; text: string; ma?: string };

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

  const router = useRouter();
  // Hẹn giờ tự quay lại camera. Giữ qua ref để huỷ được khi nhân viên bấm
  // "Quét tiếp ngay" hoặc rời trang — nếu không, một setTimeout còn treo sẽ
  // kéo màn hình về "quet" giữa lúc mẹ sau đang xem thẻ xác nhận.
  const hensRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const huyHen = useCallback(() => {
    if (hensRef.current) clearTimeout(hensRef.current);
    hensRef.current = null;
  }, []);

  const quetTiep = useCallback(() => {
    huyHen();
    setMan({ loai: "quet" });
    // `.start()` resume có thể fail (stream đã bị hệ điều hành thu hồi, quyền
    // camera mất giữa chừng…) — không bắt thì màn hình đứng ở "quet" trong khi
    // camera thật ra đã tắt mà không nói gì. Dọn scanner hỏng rồi trả về "loi"
    // để nhân viên còn thấy ô nhập mã tay ngay bên dưới.
    scannerRef.current?.start().catch(() => {
      dungScanner();
      setMan({
        loai: "loi",
        text: "Không mở lại được camera. Bấm Thử lại, hoặc nhập mã bằng tay ở dưới.",
      });
    });
  }, [huyHen, dungScanner]);

  /** Tra mã ở server. Gọi mỗi lượt quét — xem doc `/api/admin/tra-ma`. */
  const traMa = useCallback(
    async (ma: string) => {
      scannerRef.current?.pause();
      setMan({ loai: "dangTra", ma });
      try {
        const res = await fetch(`/api/admin/tra-ma?code=${encodeURIComponent(ma)}`);
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (res.status === 404) {
          setMan({ loai: "loi", text: `Không tìm thấy mã ${ma} trong danh sách.` });
          return;
        }
        if (!res.ok) {
          setMan({ loai: "loi", text: "Không đọc được dữ liệu đăng ký.", ma });
          return;
        }
        const data = (await res.json()) as { row: ThongTinQuet };
        setMan({ loai: "xacNhan", row: data.row });
      } catch {
        // Giữ `ma` để nút "Thử lại" tra đúng mã đó — mẹ không phải giơ điện
        // thoại lên lần nữa chỉ vì wifi hội trường rớt một nhịp.
        setMan({ loai: "loi", text: "Không kết nối được. Kiểm tra mạng rồi thử lại.", ma });
      }
    },
    [router],
  );

  const nhanMa = useCallback(
    (ma: string) => {
      void traMa(ma);
    },
    [traMa],
  );

  /**
   * Ghi check-in. Dùng CHUNG route với nút tick tay ở /admin, nên Google Sheet
   * cũng được mirror (route lo, chạy nền).
   *
   * `new Date()` gọi trong HÀM XỬ LÝ SỰ KIỆN, không phải lúc render — đọc đồng
   * hồ trong lúc render là hàm không thuần, React Compiler cấm.
   */
  const ghiCheckin = useCallback(
    async (row: ThongTinQuet) => {
      setMan({ loai: "dangGhi", row });
      try {
        const res = await fetch("/api/admin/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.id,
            checkedIn: true,
            checkedInAt: new Date().toISOString(),
          }),
        });
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (!res.ok) {
          // KHÔNG bao giờ hiện màn xanh khi chưa ghi được. Báo thành công giả
          // là cách chắc chắn nhất để một mẹ bị coi như đã vào cửa mà chưa vào.
          setMan({
            loai: "loi",
            text: "Ghi check-in thất bại. Bấm Thử lại.",
            ma: row.checkin_code,
          });
          return;
        }
        setMan({ loai: "xong", hoTen: row.ho_ten });
        hensRef.current = setTimeout(quetTiep, NGHI_SAU_KHI_XONG_MS);
      } catch {
        setMan({
          loai: "loi",
          text: "Không kết nối được. Chưa ghi được check-in — bấm Thử lại.",
          ma: row.checkin_code,
        });
      }
    },
    [quetTiep, router],
  );

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

  // Rời trang thì huỷ CẢ hẹn giờ tự quét tiếp LẪN scanner — không để đèn
  // camera sáng suốt buổi, và không để một setTimeout còn treo bắn vào state
  // của component đã unmount.
  useEffect(() => {
    return () => {
      huyHen();
      dungScanner();
    };
  }, [huyHen, dungScanner]);

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

        {man.loai === "dangTra" && (
          <div className="mt-5 rounded-2xl border border-line bg-white p-6 text-center">
            <p className="font-mono text-lg font-bold tracking-wider text-ink">{man.ma}</p>
            <p className="mt-2 text-sm text-ink-faded">Đang tra danh sách...</p>
          </div>
        )}

        {(man.loai === "xacNhan" || man.loai === "dangGhi") && (
          <TheXacNhan
            row={man.row}
            dangGhi={man.loai === "dangGhi"}
            onXacNhan={() => void ghiCheckin(man.row)}
            onBoQua={quetTiep}
          />
        )}

        {man.loai === "xong" && (
          <div className="mt-5 rounded-2xl border-2 border-success bg-white p-8 text-center">
            <p className="text-4xl" aria-hidden="true">
              ✓
            </p>
            <p className="mt-3 text-lg font-extrabold text-ink">
              Chị {man.hoTen} đã check-in
            </p>
            <button
              onClick={quetTiep}
              className="mt-5 w-full rounded-full bg-primary px-6 py-3 text-base font-bold text-white"
            >
              Quét tiếp ngay
            </button>
          </div>
        )}

        {man.loai === "loi" && (
          <div className="mt-5 rounded-2xl border border-danger bg-white p-6">
            <p role="alert" className="text-sm leading-6 text-danger">
              {man.text}
            </p>
            <button
              onClick={() => {
                const ma = man.ma;
                if (ma) {
                  void traMa(ma);
                } else if (scannerRef.current) {
                  // Scanner còn sống, chỉ đang pause (ca "Không tìm thấy mã") —
                  // resume thẳng, khỏi bắt nhân viên bấm "Bật camera" lại.
                  quetTiep();
                } else {
                  // Các lỗi còn lại (mở camera thất bại, gõ tay sai định dạng,
                  // resume thất bại) đều đã dungScanner() — hết scanner để
                  // resume, phải xin quyền camera lại từ đầu. Vẫn nằm trong
                  // đúng cú bấm này nên iOS Safari vẫn tính là cử chỉ người
                  // dùng hợp lệ cho getUserMedia.
                  void batCamera();
                }
              }}
              className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-base font-bold text-white"
            >
              {man.ma ? "Thử lại" : "Quét tiếp"}
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

/** Một dòng "nhãn — giá trị" trong thẻ xác nhận. */
function Dong({ nhan, gia }: { nhan: string; gia: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-ink-faded">{nhan}</span>
      <span className="text-right text-sm font-semibold text-ink">{gia}</span>
    </div>
  );
}

/**
 * Thẻ xác nhận — màn hình nhân viên nhìn trước khi bấm.
 *
 * KHÁC vé của mẹ (`CheckinPass.tsx`): ô "--" ở đây được HIỆN, không ẩn. Với mẹ
 * thì "Tình trạng: --" chỉ làm chị ấy tưởng vé mình hỏng; với ops thì "chưa
 * hỏi" chính là thông tin cần biết (dòng do ops tạo tay ở /admin/them-dang-ky).
 *
 * "Đi cùng chồng" đứng ở đây có chủ đích: người phát Welcome Kit cần biết ngay
 * một suất hay hai, không phải mở màn hình khác để tra.
 */
function TheXacNhan({
  row,
  dangGhi,
  onXacNhan,
  onBoQua,
}: {
  row: ThongTinQuet;
  dangGhi: boolean;
  onXacNhan: () => void;
  onBoQua: () => void;
}) {
  const tinhTrang =
    row.trang_thai === "mang_thai" && row.thai_tuan != null
      ? `${trangThaiLabel(row.trang_thai)} · ${row.thai_tuan} tuần`
      : row.trang_thai === "da_sinh" && row.be_thang_tuoi != null
        ? `${trangThaiLabel(row.trang_thai)} · ${row.be_thang_tuoi} tháng`
        : trangThaiLabel(row.trang_thai);

  return (
    <div className="mt-5 rounded-2xl border border-line bg-white p-6">
      <p className="text-center text-xl font-extrabold text-ink">{row.ho_ten}</p>
      <p className="mt-1 text-center font-mono text-sm tracking-wider text-ink-faded">
        {row.checkin_code}
      </p>

      <div className="mt-4 divide-y divide-line rounded-xl bg-cream px-4">
        <Dong nhan="Tình trạng" gia={tinhTrang} />
        <Dong nhan="Tỉnh/thành" gia={row.tinh_thanh} />
        <Dong nhan="Đi cùng chồng" gia={row.di_cung_chong ? "Có — 2 suất" : "Không"} />
      </div>

      {row.checked_in ? (
        <>
          <div className="mt-4 rounded-xl border border-warning bg-white px-4 py-3 text-center">
            <p className="text-sm font-semibold text-ink">
              Đã check-in
              {row.checked_in_at ? ` lúc ${formatCheckinTime(row.checked_in_at)}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-ink-faded">
              {nguonCheckinLabel(row.checked_in_source)}
            </p>
          </div>
          {/* "Check-in lại" là nút PHỤ, có chủ đích. Quét trùng vô ý không được
              phép ghi đè mất giờ đúng — ghi đè phải là hành động cố ý. */}
          <button
            onClick={onBoQua}
            className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-base font-bold text-white"
          >
            Quét mẹ tiếp theo
          </button>
          <button
            onClick={onXacNhan}
            disabled={dangGhi}
            className="mt-2 w-full rounded-full border border-line px-6 py-3 text-sm font-bold text-ink-faded disabled:opacity-60"
          >
            {dangGhi ? "Đang ghi..." : "Check-in lại (ghi đè giờ cũ)"}
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onXacNhan}
            disabled={dangGhi}
            className="mt-5 w-full rounded-full bg-primary px-6 py-3.5 text-base font-bold text-white disabled:opacity-60"
          >
            {dangGhi ? "Đang ghi..." : "✓ Xác nhận check-in"}
          </button>
          <button
            onClick={onBoQua}
            disabled={dangGhi}
            className="mt-2 w-full rounded-full border border-line px-6 py-3 text-sm font-bold text-ink-faded disabled:opacity-60"
          >
            Bỏ qua, quét mẹ khác
          </button>
        </>
      )}
    </div>
  );
}
