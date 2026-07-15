"use client";

import Link from "next/link";
import { useState } from "react";
import { trackRegistration } from "@/lib/analytics";
import { Button } from "./ui/Button";

/**
 * The app waitlist: one email, one consent box.
 *
 * Deliberately not the event form. Someone browsing the app page has shown far
 * less intent than someone claiming one of 500 event seats, so asking for a
 * phone number here would cost more sign-ups than the data is worth.
 */
export function WaitlistForm() {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    setError("");

    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/dang-ky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nguon: "app-waitlist",
          email: String(fd.get("email") ?? ""),
          dongYNhanTin: fd.get("dongYNhanTin") === "on",
          website: String(fd.get("website") ?? ""),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.fieldErrors?.email ?? data.fieldErrors?.dongYNhanTin ?? data.error);
        setState("idle");
        return;
      }
      trackRegistration("app-waitlist");
      setState("done");
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-primary-border bg-primary-faded px-6 py-5 text-center"
      >
        <p className="text-lg font-bold text-ink">Cảm ơn mẹ! 🎉</p>
        <p className="mt-1 text-sm text-ink-faded">
          Mẹ sẽ là một trong những người đầu tiên biết khi Mama Ơi ra mắt.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {/* Input and button share one pill — the button is nested inside the field
          with a small inset; focus lights up the whole pill via focus-within. */}
      <div
        className={`flex items-center gap-2 rounded-full border bg-cream py-1.5 pr-1.5 pl-5 transition focus-within:border-primary focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/15 ${
          error ? "border-danger" : "border-line"
        }`}
      >
        <label htmlFor="waitlist-email" className="sr-only">
          Email của mẹ
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email của mẹ"
          aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink placeholder:text-ink-placeholder focus:outline-none"
        />
        <Button type="submit" disabled={state === "sending"} className="shrink-0">
          {state === "sending" ? "Đang gửi..." : "Nhận tin"}
        </Button>
      </div>

      {/* Input + label are SIBLINGS (htmlFor), not nested — a link inside a
          wrapping <label> toggles the box instead of navigating. stopPropagation
          keeps a link tap from also flipping the checkbox. */}
      <div className="flex items-start gap-2.5 px-1">
        <input
          id="waitlist-consent"
          type="checkbox"
          name="dongYNhanTin"
          className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded accent-primary"
        />
        <label
          htmlFor="waitlist-consent"
          className="cursor-pointer text-[13px] leading-5 text-ink-faded"
        >
          Tôi đồng ý nhận thông tin về ứng dụng và các chương trình từ Mama Ơi, đồng thời
          chấp nhận{" "}
          <Link
            href="/privacy-policy"
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Chính sách bảo mật
          </Link>{" "}
          và{" "}
          <Link
            href="/terms-conditions"
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Điều khoản sử dụng
          </Link>
          .
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {/* Honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
    </form>
  );
}
