"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROVINCES } from "@/lib/constants";
import { trackRegistration } from "@/lib/analytics";
import { Button } from "./ui/Button";

type Errors = Record<string, string>;

const inputBase =
  "w-full rounded-xl border bg-white px-4 py-3 text-base text-ink " +
  "placeholder:text-ink-placeholder transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary";

function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function RegistrationForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [trangThai, setTrangThai] = useState<"mang_thai" | "da_sinh" | "">("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    const fd = new FormData(e.currentTarget);
    const payload = {
      nguon: "su-kien" as const,
      hoTen: String(fd.get("hoTen") ?? ""),
      email: String(fd.get("email") ?? ""),
      sdt: String(fd.get("sdt") ?? ""),
      facebook: String(fd.get("facebook") ?? ""),
      tinhThanh: String(fd.get("tinhThanh") ?? ""),
      trangThai: fd.get("trangThai"),
      // Left undefined when she is pregnant, so the server never records a
      // baby age of 0 months for a baby that has not been born.
      beThangTuoi:
        fd.get("trangThai") === "da_sinh" ? fd.get("beThangTuoi") : undefined,
      diCungChong: fd.get("diCungChong") === "on",
      dongYNhanTin: fd.get("dongYNhanTin") === "on",
      website: String(fd.get("website") ?? ""),
    };

    try {
      const res = await fetch("/api/dang-ky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors(data.fieldErrors ?? { form: data.error ?? "Có lỗi xảy ra" });
        setSubmitting(false);
        // Move the user to the first thing that is wrong, rather than leaving
        // them staring at an unchanged form wondering what happened.
        document
          .querySelector('[aria-invalid="true"], [role="alert"]')
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }

      trackRegistration("su-kien");
      router.push(`/cam-on?code=${encodeURIComponent(data.code ?? "")}`);
    } catch {
      setErrors({ form: "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại." });
      setSubmitting(false);
    }
  }

  const err = (k: string) =>
    errors[k]
      ? { "aria-invalid": true as const, "aria-describedby": `${k}-error` }
      : {};
  const ring = (k: string) =>
    errors[k] ? "border-danger" : "border-line";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {errors.form && (
        <div role="alert" className="rounded-xl bg-primary-faded px-4 py-3 text-sm text-danger">
          {errors.form}
        </div>
      )}

      <Field label="Họ tên" htmlFor="hoTen" error={errors.hoTen} required>
        <input
          id="hoTen"
          name="hoTen"
          autoComplete="name"
          placeholder="Nguyễn Thị Mai"
          className={`${inputBase} ${ring("hoTen")}`}
          {...err("hoTen")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Số điện thoại" htmlFor="sdt" error={errors.sdt} required>
          <input
            id="sdt"
            name="sdt"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="0901234567"
            className={`${inputBase} ${ring("sdt")}`}
            {...err("sdt")}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email} required>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="mai@email.com"
            className={`${inputBase} ${ring("email")}`}
            {...err("email")}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Facebook" htmlFor="facebook" error={errors.facebook}>
          <input
            id="facebook"
            name="facebook"
            placeholder="Link hoặc tên Facebook"
            className={`${inputBase} ${ring("facebook")}`}
            {...err("facebook")}
          />
        </Field>

        <Field label="Tỉnh/Thành" htmlFor="tinhThanh" error={errors.tinhThanh} required>
          <select
            id="tinhThanh"
            name="tinhThanh"
            defaultValue=""
            className={`${inputBase} ${ring("tinhThanh")} cursor-pointer`}
            {...err("tinhThanh")}
          >
            <option value="" disabled>
              Chọn tỉnh/thành
            </option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* The segmentation question. Radio rather than a dropdown: two options,
          both worth seeing at a glance, and one tap instead of two. */}
      <Field
        label="Tình trạng hiện tại"
        htmlFor="trangThai-mang_thai"
        error={errors.trangThai}
        required
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: "mang_thai", label: "Đang mang thai" },
              { value: "da_sinh", label: "Bé đã chào đời" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              htmlFor={`trangThai-${opt.value}`}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                trangThai === opt.value
                  ? "border-primary bg-primary-faded"
                  : "border-line bg-white hover:bg-primary-faded-hover"
              }`}
            >
              <input
                id={`trangThai-${opt.value}`}
                type="radio"
                name="trangThai"
                value={opt.value}
                checked={trangThai === opt.value}
                onChange={() => setTrangThai(opt.value)}
                className="h-4 w-4 cursor-pointer accent-[#f08f8c]"
              />
              <span className="text-base font-medium text-ink">{opt.label}</span>
            </label>
          ))}
        </div>
      </Field>

      {/* Revealed only when it applies — a pregnant mother is never asked how
          many months old her unborn baby is. */}
      {trangThai === "da_sinh" && (
        <Field
          label="Bé được bao nhiêu tháng?"
          htmlFor="beThangTuoi"
          error={errors.beThangTuoi}
          required
        >
          <input
            id="beThangTuoi"
            name="beThangTuoi"
            type="number"
            inputMode="numeric"
            min={0}
            max={36}
            placeholder="Ví dụ: 8"
            className={`${inputBase} ${ring("beThangTuoi")}`}
            {...err("beThangTuoi")}
          />
        </Field>
      )}

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="diCungChong"
          className="h-5 w-5 cursor-pointer rounded accent-[#f08f8c]"
        />
        <span className="text-base text-ink">Tôi đi cùng chồng</span>
      </label>

      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="dongYNhanTin"
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[#f08f8c]"
            {...err("dongYNhanTin")}
          />
          <span className="text-sm leading-5 text-ink-faded">
            Tôi đồng ý nhận thông tin về sự kiện, chương trình và ứng dụng từ Mama Ơi.
            <span className="ml-0.5 text-danger">*</span>
          </span>
        </label>
        {errors.dongYNhanTin && (
          <p id="dongYNhanTin-error" role="alert" className="mt-1.5 text-sm text-danger">
            {errors.dongYNhanTin}
          </p>
        )}
      </div>

      {/* Honeypot — hidden from people, irresistible to bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Đang gửi..." : "Đăng ký ngay"}
      </Button>

      <p className="text-center text-xs leading-4 text-ink-faded">
        Sự kiện miễn phí, giới hạn 500 mẹ. Mẹ sẽ nhận email xác nhận kèm mã QR check-in.
      </p>
    </form>
  );
}
