"use client";

import { useEffect, useId, useRef, useState } from "react";
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
 * Giá trị vẫn đi vào form qua MỘT `<input type="hidden">`: `onSubmit` của form
 * đọc bằng `new FormData(e.currentTarget)`, nên `buildRegistrationPayload`,
 * schema Zod, Brevo và Sheets không hề biết chỗ này đã đổi.
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

  const boc = useRef<HTMLDivElement>(null);
  const nut = useRef<HTMLButtonElement>(null);
  const oTim = useRef<HTMLInputElement>(null);
  const dsRef = useRef<HTMLUListElement>(null);

  const dsId = useId();
  const mucId = (i: number) => `${dsId}-${i}`;

  const q = boDau(tim.trim());
  const loc = q ? options.filter((o) => boDau(o).includes(q)) : options;

  function dong(traLaiFocus = true) {
    setMo(false);
    setTim("");
    if (traLaiFocus) nut.current?.focus();
  }

  function batDau() {
    // Đo chỗ trống trước khi bung: field này nằm gần cuối một form dài, mở
    // xuống khi sát đáy màn hình thì panel bị cắt và mẹ không thấy danh sách.
    const r = nut.current?.getBoundingClientRect();
    if (r) {
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
  useEffect(() => {
    if (!mo) return;
    function ngoai(e: PointerEvent) {
      if (!boc.current?.contains(e.target as Node)) dong(false);
    }
    document.addEventListener("pointerdown", ngoai);
    return () => document.removeEventListener("pointerdown", ngoai);
  }, [mo]);

  useEffect(() => {
    if (!mo) return;
    // Trên điện thoại KHÔNG tự focus ô tìm: bàn phím ảo bật lên che mất chính
    // danh sách vừa mở. Mẹ chạm vào ô tìm khi thật sự muốn gõ. Trên máy tính
    // thì focus ngay để gõ được liền, không phải với chuột.
    const chamTay = window.matchMedia("(pointer: coarse)").matches;
    if (!chamTay) oTim.current?.focus();
  }, [mo]);

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
    } else if (e.key === "Escape") {
      e.preventDefault();
      dong();
    } else if (e.key === "Tab") {
      // Để Tab đi tiếp bình thường, chỉ dọn panel lại phía sau.
      dong(false);
    }
  }

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

      {mo && (
        <div
          className={`absolute z-30 w-full overflow-hidden rounded-xl border border-line bg-white shadow-card ${
            bungLen ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
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

          {loc.length === 0 ? (
            <p className="px-4 py-3 text-base text-ink-faded">{khongThayLabel}</p>
          ) : (
            <ul ref={dsRef} id={dsId} role="listbox" className="max-h-60 overflow-y-auto py-1">
              {loc.map((o, i) => {
                const dangChon = o === value;
                return (
                  <li key={o}>
                    {/* onPointerDown chứ không onClick: listener đóng-khi-bấm-ra-ngoài
                        cũng nghe pointerdown, nên phải chốt lựa chọn ở cùng nhịp
                        đó — không thì panel đóng trước và click rơi vào khoảng không. */}
                    <div
                      id={mucId(i)}
                      role="option"
                      aria-selected={dangChon}
                      data-to-sang={i === toSang}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        chon(o);
                      }}
                      onMouseEnter={() => setToSang(i)}
                      className={`flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-base ${
                        dangChon
                          ? "bg-primary-faded font-bold text-ink"
                          : i === toSang
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
          )}
        </div>
      )}
    </div>
  );
}
