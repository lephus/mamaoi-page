"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { boDau } from "@/lib/text";

/**
 * Dropdown có ô tìm kiếm, dựng tay thay cho `<select>` gốc.
 *
 * Vì sao không dùng `<select>`: danh sách hiện tại là 63 tỉnh/thành, và phần
 * bung ra của select gốc do HỆ ĐIỀU HÀNH vẽ — không nhận CSS, nên nó là mảng
 * duy nhất trên trang không theo được ngôn ngữ hình ảnh của app (bo góc, đổ
 * bóng mềm, tô coral cho mục đang chọn). Nó cũng không cho gõ để lọc, mà cuộn
 * tay qua 63 dòng khi đang bế bé là thao tác tệ.
 *
 * HAI HÌNH DẠNG, chọn theo loại con trỏ ngay lúc mở:
 * - Chuột (`pointer: fine`) → panel bung ngay dưới ô, đúng thói quen desktop.
 * - Ngón tay (`pointer: coarse`) → popup dán đáy màn hình, khoá cuộn nền. Panel
 *   240px lơ lửng giữa một form dài là chỗ tệ nhất để vuốt: ngón tay trượt ra
 *   ngoài một chút là trúng nền và panel đóng. Popup cho vùng cuộn cao 80dvh,
 *   nằm trong tầm ngón cái, và nền không thể trôi sau lưng.
 *
 * Giá trị vẫn đi vào form qua MỘT `<input type="hidden">`: `onSubmit` của form
 * đọc bằng `new FormData(e.currentTarget)`, nên `buildRegistrationPayload`,
 * schema Zod, Supabase và Sheets không hề biết chỗ này đã đổi.
 */

/** Chiều cao ước lượng của panel, dùng để quyết định bung lên hay xuống. */
const CAO_PANEL = 320;

export function Select({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  timPlaceholder = "Tìm nhanh...",
  khongThayLabel = "Không tìm thấy",
  invalid,
  describedBy,
  className = "",
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder: string;
  timPlaceholder?: string;
  khongThayLabel?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const [mo, setMo] = useState(false);
  const [tim, setTim] = useState("");
  const [toSang, setToSang] = useState(0);
  const [bungLen, setBungLen] = useState(false);
  const [dungPopup, setDungPopup] = useState(false);
  const [caoBanPhim, setCaoBanPhim] = useState(0);

  const boc = useRef<HTMLDivElement>(null);
  const nut = useRef<HTMLButtonElement>(null);
  const oTim = useRef<HTMLInputElement>(null);
  const dsRef = useRef<HTMLUListElement>(null);

  const dsId = useId();
  const mucId = (i: number) => `${dsId}-${i}`;
  const tieuDeId = `${dsId}-tieu-de`;

  const q = boDau(tim.trim());
  const loc = q ? options.filter((o) => boDau(o).includes(q)) : options;

  function dong(traLaiFocus = true) {
    setMo(false);
    setTim("");
    if (traLaiFocus) nut.current?.focus();
  }

  function batDau() {
    // Quyết định hình dạng NGAY LÚC MỞ, không trong effect: panel chỉ tồn tại
    // sau một cú chạm nên `window` chắc chắn có, và không có nhịp nào panel
    // hiện sai kiểu rồi nhảy sang kiểu kia.
    const chamTay = window.matchMedia("(pointer: coarse)").matches;
    setDungPopup(chamTay);
    setCaoBanPhim(0);

    // Đo chỗ trống trước khi bung: field này nằm gần cuối một form dài, mở
    // xuống khi sát đáy màn hình thì panel bị cắt và mẹ không thấy danh sách.
    // Popup dán đáy màn hình nên không cần đo.
    const r = nut.current?.getBoundingClientRect();
    if (!chamTay && r) {
      const duoi = window.innerHeight - r.bottom;
      setBungLen(duoi < CAO_PANEL && r.top > duoi);
    }
    setTim("");
    setToSang(Math.max(0, options.indexOf(value)));
    setMo(true);
  }

  function chon(v: string) {
    onChange(v);
    dong();
  }

  // Bấm ra ngoài thì đóng. `pointerdown` chứ không `click`: click chỉ bắn sau
  // khi nhả chuột, nên panel còn đứng đó suốt thao tác kéo — thấy rõ là trễ.
  // Chỉ cho panel bung tại chỗ: popup nằm trong portal ở `document.body`, cây
  // DOM khác hẳn, `boc.contains` luôn sai — để nguyên thì vừa chạm vào popup
  // đã đóng. Popup có nền mờ của riêng nó lo việc đóng.
  useEffect(() => {
    if (!mo || dungPopup) return;
    function ngoai(e: PointerEvent) {
      if (!boc.current?.contains(e.target as Node)) dong(false);
    }
    document.addEventListener("pointerdown", ngoai);
    return () => document.removeEventListener("pointerdown", ngoai);
  }, [mo, dungPopup]);

  // Escape nghe ở document chứ không ở ô tìm: trong popup, mẹ chưa chắc đang
  // focus vào đâu — phím bấm từ ô tìm vẫn nổi bọt lên đây nên vẫn bắt được.
  useEffect(() => {
    if (!mo) return;
    function phimEsc(e: KeyboardEvent) {
      if (e.key === "Escape") dong();
    }
    document.addEventListener("keydown", phimEsc);
    return () => document.removeEventListener("keydown", phimEsc);
  }, [mo]);

  useEffect(() => {
    if (!mo) return;
    // Trên điện thoại KHÔNG tự focus ô tìm: bàn phím ảo bật lên che mất chính
    // danh sách vừa mở. Mẹ chạm vào ô tìm khi thật sự muốn gõ. Trên máy tính
    // thì focus ngay để gõ được liền, không phải với chuột.
    if (!dungPopup) oTim.current?.focus();
  }, [mo, dungPopup]);

  // Khoá cuộn nền khi popup mở, trả lại đúng giá trị cũ khi đóng.
  useEffect(() => {
    if (!mo || !dungPopup) return;
    const truoc = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = truoc;
    };
  }, [mo, dungPopup]);

  // Nâng popup lên trên bàn phím ảo. Popup dán đáy theo khung nhìn BỐ CỤC, mà
  // bàn phím chỉ thu nhỏ khung nhìn THẤY ĐƯỢC — không bù thì mẹ gõ tìm kiếm
  // xong cả popup nằm sau bàn phím.
  useEffect(() => {
    const kn = window.visualViewport;
    if (!mo || !dungPopup || !kn) return;
    function do_() {
      const vv = window.visualViewport;
      if (vv) setCaoBanPhim(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    }
    do_();
    kn.addEventListener("resize", do_);
    kn.addEventListener("scroll", do_);
    return () => {
      kn.removeEventListener("resize", do_);
      kn.removeEventListener("scroll", do_);
    };
  }, [mo, dungPopup]);

  // Giữ dòng đang tô sáng trong tầm nhìn khi đi bằng phím mũi tên.
  useEffect(() => {
    if (!mo) return;
    dsRef.current
      ?.querySelector('[data-to-sang="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [mo, toSang]);

  function phim(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setToSang((i) => Math.min(i + 1, loc.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setToSang((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Chặn submit form: Enter ở đây là "chọn dòng này", không phải "gửi form".
      e.preventDefault();
      if (loc[toSang]) chon(loc[toSang]);
    } else if (e.key === "Tab") {
      // Để Tab đi tiếp bình thường, chỉ dọn panel lại phía sau.
      dong(false);
    }
  }

  const oTimUI = (
    <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-faded">
        <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={oTim}
        type="text"
        // Ô này là bộ LỌC, không phải combobox — combobox là cái nút mở ở
        // trên. Hai role combobox lồng nhau sẽ báo cho trình đọc màn hình
        // hai điều khiển ở chỗ chỉ có một. Vẫn giữ aria-activedescendant
        // vì focus đang nằm đây khi mẹ đi bằng phím mũi tên.
        aria-controls={dsId}
        aria-activedescendant={loc.length ? mucId(toSang) : undefined}
        aria-label={timPlaceholder}
        value={tim}
        onChange={(e) => {
          setTim(e.target.value);
          // Danh sách vừa đổi, chỉ số cũ trỏ vào dòng khác — về đầu.
          setToSang(0);
        }}
        onKeyDown={phim}
        placeholder={timPlaceholder}
        className="w-full bg-transparent text-base text-ink placeholder:text-ink-placeholder focus:outline-none"
      />
    </div>
  );

  const danhSachUI = (lopUl: string) =>
    loc.length === 0 ? (
      <p className={`px-4 py-3 text-base text-ink-faded ${lopUl}`}>{khongThayLabel}</p>
    ) : (
      <ul ref={dsRef} id={dsId} role="listbox" className={`${lopUl} py-1`}>
        {loc.map((o, i) => {
          const dangChon = o === value;
          return (
            <li key={o}>
              {/* onClick chứ KHÔNG onPointerDown: pointerdown bắn ngay lúc ngón
                  tay chạm xuống, nên vuốt để cuộn danh sách lại hoá ra chọn
                  luôn dòng vừa chạm rồi đóng panel — mẹ không cuộn tay được.
                  Trình duyệt chỉ bắn click khi cú chạm KHÔNG biến thành cuộn,
                  đó đúng là ranh giới "chạm chọn" với "vuốt cuộn". */}
              <div
                id={mucId(i)}
                role="option"
                aria-selected={dangChon}
                data-to-sang={i === toSang}
                onClick={() => chon(o)}
                onMouseEnter={() => setToSang(i)}
                // Vệt tô "đang trỏ tới" chỉ dành cho chuột và phím mũi tên. Ngón
                // tay không có trạng thái rê, nên trong popup nó thành ra dòng
                // đầu tự sáng lên như thể đã chọn sẵn — mẹ chưa chọn gì cả.
                className={`flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-base ${
                  dangChon
                    ? "bg-primary-faded font-bold text-ink"
                    : i === toSang && !dungPopup
                      ? "bg-primary-faded-hover text-ink"
                      : "text-ink"
                }`}
              >
                <span>{o}</span>
                {dangChon && (
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-primary">
                    <path
                      d="m4 10.5 4 4 8-9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );

  return (
    <div ref={boc} className="relative">
      {/* Nguồn sự thật cho FormData. Không đặt aria-invalid ở đây: input ẩn
          không cuộn tới được, mà scrollToFirstError trong form lại tìm đúng
          selector đó — mẹ sẽ thấy nút bật lại mà màn hình không nhúc nhích. */}
      <input type="hidden" name={name} value={value} />

      <button
        ref={nut}
        id={id}
        type="button"
        onClick={() => (mo ? dong() : batDau())}
        // role="combobox" chứ không để mặc định là button: vai trò `button`
        // KHÔNG hỗ trợ aria-invalid (eslint-plugin-jsx-a11y bắt đúng), mà
        // scrollToFirstError trong form lại tìm theo `[aria-invalid="true"]` —
        // để nguyên button thì ô này sai mà màn hình không cuộn tới.
        // Đây cũng chính là mẫu "select-only combobox" của ARIA APG.
        role="combobox"
        aria-haspopup="listbox"
        aria-controls={dsId}
        aria-expanded={mo}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${className} flex cursor-pointer items-center justify-between gap-2 text-left ${
          mo ? "border-primary ring-2 ring-primary" : ""
        }`}
      >
        <span className={value ? "text-ink" : "text-ink-placeholder"}>
          {value || placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-ink-faded transition-transform ${
            mo ? "rotate-180" : ""
          }`}
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {mo && !dungPopup && (
        <div
          className={`absolute z-30 w-full overflow-hidden rounded-xl border border-line bg-white shadow-card ${
            bungLen ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {oTimUI}
          {danhSachUI("max-h-60 overflow-y-auto")}
        </div>
      )}

      {mo &&
        dungPopup &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/40"
            onClick={(e) => {
              // Chỉ nền mờ mới đóng, không phải mọi click nổi bọt từ trong ra.
              if (e.target === e.currentTarget) dong();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={tieuDeId}
              style={{ marginBottom: caoBanPhim }}
              className="flex max-h-[80dvh] flex-col overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-card"
            >
              <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line" aria-hidden="true" />
              <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-2 pb-2.5">
                <span id={tieuDeId} className="text-base font-bold text-ink">
                  {placeholder}
                </span>
                <button
                  type="button"
                  onClick={() => dong()}
                  aria-label="Đóng"
                  className="-mr-1 rounded-full px-2 py-1 text-lg leading-none text-ink-faded"
                >
                  ✕
                </button>
              </div>
              {oTimUI}
              {/* overscroll-contain: cuộn hết danh sách rồi vuốt tiếp thì dừng ở
                  đó, không kéo lê trang nền phía sau. */}
              {danhSachUI("flex-1 overflow-y-auto overscroll-contain")}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
