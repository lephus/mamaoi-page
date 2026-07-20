"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CHU_DE_QUAN_TAM, NGUON_BIET_DEN, PROVINCES } from "@/lib/constants";
import { buildRegistrationPayload } from "@/lib/registration-payload";
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

/** Tiêu đề nhóm field. Form v2 dài hơn hẳn v1 — không chia nhóm thì mẹ điền
    trên điện thoại sẽ mất phương hướng giữa chừng. */
function Nhom({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-5">
      <legend className="mb-1 text-base font-extrabold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

export function RegistrationForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [trangThai, setTrangThai] = useState<"mang_thai" | "da_sinh" | "">("");
  const [chuDe, setChuDe] = useState<string[]>([]);

  function toggleChuDe(value: string) {
    setChuDe((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    const fd = new FormData(e.currentTarget);
    const payload = buildRegistrationPayload(fd, chuDe);

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

      <Nhom title="Thông tin mẹ">
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

          <Field label="Thành phố" htmlFor="tinhThanh" error={errors.tinhThanh} required>
            <select
              id="tinhThanh"
              name="tinhThanh"
              defaultValue=""
              className={`${inputBase} ${ring("tinhThanh")} cursor-pointer`}
              {...err("tinhThanh")}
            >
              <option value="" disabled>
                Chọn thành phố
              </option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Nhom>

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

      {/* Hiện đúng nhánh đang chọn. Mẹ mang thai không bao giờ bị hỏi ngày sinh
          của bé chưa chào đời; mẹ đã sinh không bị hỏi tuần thai. Schema phía
          server ép cùng quy tắc này — đây chỉ là phép lịch sự. */}
      {trangThai === "mang_thai" && (
        <Field
          label="Thai bao nhiêu tuần?"
          htmlFor="thaiTuan"
          error={errors.thaiTuan}
          required
        >
          <input
            id="thaiTuan"
            name="thaiTuan"
            type="number"
            inputMode="numeric"
            min={1}
            max={42}
            placeholder="Ví dụ: 20"
            className={`${inputBase} ${ring("thaiTuan")}`}
            {...err("thaiTuan")}
          />
        </Field>
      )}

      {trangThai === "da_sinh" && (
        <Nhom title="Thông tin bé">
          <Field label="Tên bé" htmlFor="tenBe" error={errors.tenBe} required>
            <input
              id="tenBe"
              name="tenBe"
              placeholder="Gạo"
              className={`${inputBase} ${ring("tenBe")}`}
              {...err("tenBe")}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Ngày sinh của bé"
              htmlFor="beNgaySinh"
              error={errors.beNgaySinh}
              required
            >
              <input
                id="beNgaySinh"
                name="beNgaySinh"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                className={`${inputBase} ${ring("beNgaySinh")}`}
                {...err("beNgaySinh")}
              />
            </Field>

            <Field
              label="Giới tính"
              htmlFor="beGioiTinh-nam"
              error={errors.beGioiTinh}
              required
            >
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { value: "nam", label: "Bé trai" },
                    { value: "nu", label: "Bé gái" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    htmlFor={`beGioiTinh-${opt.value}`}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3 transition-colors hover:bg-primary-faded-hover has-checked:border-primary has-checked:bg-primary-faded"
                  >
                    <input
                      id={`beGioiTinh-${opt.value}`}
                      type="radio"
                      name="beGioiTinh"
                      value={opt.value}
                      className="h-4 w-4 cursor-pointer accent-[#f08f8c]"
                    />
                    <span className="text-base font-medium text-ink">{opt.label}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </Nhom>
      )}

      <Field
        label="Chủ đề mẹ quan tâm"
        htmlFor="chuDe-thai_ky"
        error={errors.chuDeQuanTam}
        required
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {CHU_DE_QUAN_TAM.map((c) => (
            <label
              key={c.value}
              htmlFor={`chuDe-${c.value}`}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-2.5 transition-colors ${
                chuDe.includes(c.value)
                  ? "border-primary bg-primary-faded"
                  : "border-line bg-white hover:bg-primary-faded-hover"
              }`}
            >
              <input
                id={`chuDe-${c.value}`}
                type="checkbox"
                checked={chuDe.includes(c.value)}
                onChange={() => toggleChuDe(c.value)}
                className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded accent-[#f08f8c]"
              />
              <span className="text-base text-ink">{c.label}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field
        label="Mẹ biết đến chương trình từ đâu?"
        htmlFor="nguonBietDen-facebook"
        error={errors.nguonBietDen}
        required
      >
        <div className="grid gap-2.5 sm:grid-cols-3">
          {NGUON_BIET_DEN.map((n) => (
            <label
              key={n.value}
              htmlFor={`nguonBietDen-${n.value}`}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-2.5 transition-colors hover:bg-primary-faded-hover has-checked:border-primary has-checked:bg-primary-faded"
            >
              <input
                id={`nguonBietDen-${n.value}`}
                type="radio"
                name="nguonBietDen"
                value={n.value}
                className="h-4 w-4 shrink-0 cursor-pointer accent-[#f08f8c]"
              />
              <span className="text-base text-ink">{n.label}</span>
            </label>
          ))}
        </div>
      </Field>

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
            Tôi đồng ý cho Mama Ơi lưu trữ thông tin để gửi email xác nhận, tài liệu
            chương trình và các thông tin hữu ích.
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
