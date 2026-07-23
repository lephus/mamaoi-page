"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Speaker = {
  name: string;
  role: string;
  photo: string;
  bio: readonly string[];
};

/**
 * Card diễn giả: ảnh + tên + vai trò + 2 dòng tiểu sử. Bấm "Xem thêm" mở popup
 * hiện đầy đủ tiểu sử thay vì mở rộng tại chỗ.
 *
 * Modal render qua portal ra <body> vì card nằm trong <Reveal> (đặt
 * `will-change: transform`) và trong slider (`overflow-x-auto`) — cả hai đều
 * "nhốt" một phần tử `position: fixed` lại thay vì cho nó phủ toàn màn hình.
 */
export function SpeakerCard({ speaker }: { speaker: Speaker }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = `speaker-${speaker.name.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="flex h-full flex-col items-center rounded-2xl bg-white p-6 text-center shadow-[var(--shadow-card)] ring-1 ring-line">
      <Image
        src={speaker.photo}
        alt={speaker.name}
        width={320}
        height={320}
        className="h-28 w-28 rounded-full object-cover shadow-md ring-4 ring-primary-faded"
      />
      <h3 className="mt-4 text-lg font-bold text-ink">{speaker.name}</h3>
      <span className="mt-2 rounded-full bg-primary-faded px-3 py-1 text-xs font-semibold text-primary">
        {speaker.role}
      </span>
      <p className="mt-4 line-clamp-2 text-base leading-6 text-ink-faded">
        {speaker.bio[0]}
      </p>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-bold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      >
        Xem thêm
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {open && (
        <SpeakerModal
          speaker={speaker}
          titleId={titleId}
          onClose={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function SpeakerModal({
  speaker,
  titleId,
  onClose,
}: {
  speaker: Speaker;
  titleId: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Khoá cuộn nền khi popup mở, trả lại đúng giá trị cũ khi đóng.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-reveal relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-[var(--shadow-hover)] ring-1 ring-line sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-primary-faded text-primary transition hover:bg-primary hover:text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col items-center text-center">
          <Image
            src={speaker.photo}
            alt={speaker.name}
            width={320}
            height={320}
            className="h-24 w-24 rounded-full object-cover shadow-md ring-4 ring-primary-faded sm:h-28 sm:w-28"
          />
          <h2 id={titleId} className="mt-4 text-2xl font-extrabold text-ink">
            {speaker.name}
          </h2>
          <span className="mt-2 rounded-full bg-primary-faded px-3.5 py-1 text-sm font-semibold text-primary">
            {speaker.role}
          </span>
        </div>

        <div className="mt-6 space-y-3 text-left">
          {speaker.bio.map((p) => (
            <p
              key={p.slice(0, 24)}
              className="text-base leading-7 text-ink-faded"
            >
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
