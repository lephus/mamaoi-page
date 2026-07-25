"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  CHU_DE_QUAN_TAM,
  DA_DONG,
  HET_CHO,
  NGUON_BIET_DEN,
  PROVINCES,
  SUC_CHUA_MAC_DINH,
} from "@/lib/constants";
import { buildRegistrationPayload } from "@/lib/registration-payload";
import {
  daHetCho,
  datSauDangKy,
  docKho,
  taiKhoLanDau,
  theoDoiKho,
} from "@/lib/kho-cho-trong";
import { trackRegistration } from "@/lib/analytics";
import { homNayVN } from "@/lib/time";
import { useDaDongDangKy } from "./Countdown";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";

type Errors = Record<string, string>;

/** Field chỉ tồn tại tuỳ nhánh `trangThai` — xem comment tại onChange bên dưới. */
const BRANCH_ERROR_KEYS = [
  "trangThai",
  "thaiTuan",
  "tenBe",
  "beNgaySinh",
  "beGioiTinh",
] as const;

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

type LuaChon = { readonly value: string; readonly label: string };

/**
 * Nhóm lựa chọn dùng `<fieldset>`/`<legend>` chứ không `<label htmlFor>`: một
 * label chỉ trỏ được vào MỘT input, nên với nhóm 9 checkbox thì 8 cái còn lại
 * mất hẳn ngữ cảnh khi mẹ dùng trình đọc màn hình.
 *
 * `role="alert"` giữ nguyên trên thông báo lỗi — hàm cuộn-tới-lỗi-đầu-tiên
 * trong `onSubmit` bắt theo selector đó.
 */
function NhomChon({
  legend,
  error,
  required,
  luoi,
  children,
}: {
  legend: string;
  error?: string;
  required?: boolean;
  luoi: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 block text-sm font-semibold text-ink">
        {legend}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </legend>
      {/* `luoi` mang cả lớp display: đa số nhóm là `grid ...`, riêng nhóm chủ
          đề dùng `flex flex-wrap` để chip ôm sát nội dung thay vì bị grid kéo giãn. */}
      <div className={luoi}>{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Union thay vì object phẳng: chặn 3 lỗi mà `tsc`/lint/build đều lọt qua, và
 * repo này không có hạ tầng test component React nào bắt được chúng ở runtime
 * — radio thiếu `name` chung (mỗi ô tự chọn độc lập, FormData vô nghĩa),
 * `checked` không kèm `onChange` (input chỉ đọc + warning), và checkbox bị
 * gán `name` dù state React đã là nguồn sự thật duy nhất (chủ đề quan tâm).
 */
type HangChonProps = { id: string; value: string; label: string; nhanManh?: boolean } & (
  | { type: "radio"; name: string; checked?: undefined; onChange?: undefined }
  | { type: "radio"; name: string; checked: boolean; onChange: () => void }
  | { type: "checkbox"; name?: never; checked: boolean; onChange: () => void }
);

/** Một hàng lựa chọn. Cả hàng là vùng chạm — mẹ bấm một tay, không nhắm ô nhỏ. */
function HangChon({
  id,
  type,
  name,
  value,
  checked,
  onChange,
  label,
  nhanManh,
}: HangChonProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 transition-colors hover:bg-primary-faded-hover has-checked:border-primary has-checked:bg-primary-faded"
    >
      <input
        id={id}
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className={`h-5 w-5 shrink-0 cursor-pointer accent-primary ${
          type === "checkbox" ? "rounded" : ""
        }`}
      />
      <span className={`text-base text-ink ${nhanManh ? "font-medium" : ""}`}>
        {label}
      </span>
    </label>
  );
}

/**
 * Đưa mẹ tới đúng ô ĐẦU TIÊN đang sai sau khi submit lỗi — thay vì để mẹ đứng ở
 * cuối form (nơi vừa bấm nút) tự dò lên xem chỗ nào tô đỏ. Bắt cả input/select
 * lỗi (`aria-invalid`), nhóm radio/checkbox lỗi (fieldset `aria-invalid`) và
 * thông báo lỗi chung ở đầu form (`role="alert"`) — cái nào xuất hiện trước
 * trong DOM thì cuộn tới cái đó.
 *
 * PHẢI gọi SAU `flushSync`: React 19 gom (batch) `setState`, nên nếu query ngay
 * thì DOM của lần lỗi này chưa gắn `aria-invalid`/`role="alert"`, querySelector
 * trả `null` và không cuộn đi đâu cả. `flushSync` ép React commit đồng bộ trước.
 */
function scrollToFirstError() {
  document
    .querySelector('[aria-invalid="true"], [role="alert"]')
    ?.scrollIntoView({ block: "center", behavior: "smooth" });
}

/**
 * Khối thay chỗ nút gửi khi form không còn nhận đăng ký nữa — dùng chung cho cả
 * hai lý do (hết hạn, hết chỗ). Một khuôn duy nhất để hai màn hình đó không trôi
 * lệch nhau về hình thức; chỉ chữ là khác.
 */
function ThongBaoDong({ tieuDe, mo, nut }: { tieuDe: string; mo: string; nut: string }) {
  return (
    <div role="alert" className="rounded-2xl bg-primary-faded px-5 py-6 text-center">
      <p className="text-lg font-extrabold text-ink">{tieuDe}</p>
      <p className="mt-1.5 text-base leading-6 text-ink-faded">{mo}</p>
      <Link
        href="/ung-dung#nhan-tin"
        className="mt-4 inline-block rounded-full bg-primary px-6 py-3 text-base font-bold text-white transition-colors hover:bg-primary-hover"
      >
        {nut}
      </Link>
    </div>
  );
}

export function RegistrationForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [trangThai, setTrangThai] = useState<
    "chuan_bi_mang_thai" | "ivf" | "mang_thai" | "da_sinh" | ""
  >("");
  const [chuDe, setChuDe] = useState<string[]>([]);
  const [nguon, setNguon] = useState("");
  const [tinhThanh, setTinhThanh] = useState("");
  /**
   * Số chỗ của sự kiện khi server từ chối vì đã hết — `null` là còn chỗ.
   *
   * Giữ CON SỐ chứ không giữ boolean: câu thông báo phải đọc đúng giới hạn
   * server đang áp dụng (ops nâng `EVENT_CAPACITY` lên 550 thì không được nói
   * "đã đủ 500 mẹ"), nên số phải đi theo từ response chứ không lấy hằng ở client.
   */
  const [hetChoTheoResponse, setHetChoTheoResponse] = useState<number | null>(null);
  /**
   * Số chỗ đọc lúc mở trang (`/api/cho-trong`, qua kho dùng chung).
   *
   * Nhờ nó mà form biết mình đã hết chỗ TRƯỚC khi mẹ điền — thay vì để mẹ gõ hết
   * hai chục ô rồi mới nhận câu từ chối. Cũng là đường mà cờ đóng thủ công
   * `DANG_KY_DA_DAY` đi tới client: endpoint đó trả `conLai: 0` khi cờ bật.
   *
   * Ảnh chụp phía server là `null` — `/` sinh HTML lúc build, không con số nào
   * đúng để nướng vào đó — nên lượt render đầu luôn còn nút gửi. Đoán sai theo
   * hướng chặn nhầm mẹ tệ hơn hẳn hiện thừa một nút sống trong một nhịp.
   */
  const soChoTuKho = useSyncExternalStore(theoDoiKho, docKho, () => null);
  const hetCho = hetChoTheoResponse ?? daHetCho(soChoTuKho);

  useEffect(() => {
    void taiKhoLanDau();
  }, []);
  /**
   * Server báo đã quá hạn đăng ký.
   *
   * Tách khỏi `useDaDongDangKy()` bên dưới vì hai nguồn khác nhau: hook đọc đồng
   * hồ MÁY MẸ (có thể chạy sai, có thể là tab mở từ hôm trước chưa reload), còn
   * cờ này là phán quyết của server. Server thắng.
   */
  const [dongTheoServer, setDongTheoServer] = useState(false);
  const daDong = useDaDongDangKy() || dongTheoServer;

  // Xoá lỗi của MỘT field ngay khi mẹ vừa chỉnh nó, thay vì để thông báo đỏ đứng
  // ì tới lần submit sau. Với radio/checkbox điều này quan trọng nhất: mẹ đã bấm
  // chọn mà lỗi vẫn còn thì tưởng thao tác chưa ăn. Trả nguyên `prev` khi field
  // không có lỗi để khỏi render thừa.
  function clearError(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function toggleChuDe(value: string) {
    setChuDe((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
    clearError("chuDeQuanTam");
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
        // flushSync ép DOM gắn lỗi ngay trong lượt này, để scrollToFirstError
        // tìm được ô sai và cuộn tới — nếu không mẹ chỉ thấy nút bật lại mà
        // không rõ vì sao đăng ký chưa xong.
        flushSync(() => {
          // Hết chỗ KHÔNG phải lỗi mẹ điền sai — không nhét vào ô đỏ validation,
          // mà thay hẳn nút gửi bằng khối thông báo riêng. `??` chứ không `||`:
          // giới hạn hợp lệ không bao giờ là 0, nhưng response thiếu field thì
          // phải rơi về hằng client chứ không hiện "đã đủ 0 mẹ".
          if (data.closed) {
            // Quá hạn: tab mở sẵn từ hôm trước, hoặc đồng hồ máy mẹ chạy chậm.
            setDongTheoServer(true);
          } else if (data.full) {
            const gioiHan =
              typeof data.gioiHan === "number" ? data.gioiHan : SUC_CHUA_MAC_DINH;
            setHetChoTheoResponse(gioiHan);
            // Server vừa nói đã đầy — widget "Còn N/500 chỗ" trên trang phải đổi
            // theo ngay, chứ không đứng mời đăng ký bên trên một khối báo hết chỗ.
            datSauDangKy({ gioiHan, conLai: 0 });
          } else {
            setErrors(data.fieldErrors ?? { form: data.error ?? "Có lỗi xảy ra" });
          }
          setSubmitting(false);
        });
        scrollToFirstError();
        return;
      }

      // Số chỗ còn lại đi kèm response, tính đúng lúc dòng Sheet được ghi. Đẩy
      // vào kho để widget đổi ngay — form điều hướng sang /cam-on bằng router
      // client-side, nên mẹ bấm quay lại `/` phải thấy số mới chứ không phải số
      // đã đọc lúc mở trang.
      if (typeof data.conLai === "number" && typeof data.gioiHan === "number") {
        datSauDangKy({ gioiHan: data.gioiHan, conLai: data.conLai });
      }

      trackRegistration("su-kien");
      router.push(`/cam-on?code=${encodeURIComponent(data.code ?? "")}`);
    } catch {
      flushSync(() => {
        setErrors({ form: "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại." });
        setSubmitting(false);
      });
      scrollToFirstError();
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
              maxLength={200}
              placeholder="Link hoặc tên Facebook"
              className={`${inputBase} ${ring("facebook")}`}
              {...err("facebook")}
            />
          </Field>

          <Field label="Thành phố" htmlFor="tinhThanh" error={errors.tinhThanh} required>
            <Select
              id="tinhThanh"
              name="tinhThanh"
              value={tinhThanh}
              onChange={(v) => {
                setTinhThanh(v);
                clearError("tinhThanh");
              }}
              options={PROVINCES}
              placeholder="Chọn thành phố"
              timPlaceholder="Tìm tỉnh/thành..."
              khongThayLabel="Không tìm thấy tỉnh/thành"
              invalid={Boolean(errors.tinhThanh)}
              describedBy={errors.tinhThanh ? "tinhThanh-error" : undefined}
              className={`${inputBase} ${ring("tinhThanh")}`}
            />
          </Field>
        </div>
      </Nhom>

      {/* The segmentation question. Radio rather than a dropdown: two options,
          both worth seeing at a glance, and one tap instead of two. */}
      <NhomChon
        legend="Tình trạng hiện tại"
        error={errors.trangThai}
        required
        luoi="grid gap-3 sm:grid-cols-2"
      >
        {(
          [
            { value: "chuan_bi_mang_thai", label: "Chuẩn bị mang thai" },
            { value: "ivf", label: "IVF" },
            { value: "mang_thai", label: "Đang mang thai" },
            { value: "da_sinh", label: "Bé đã chào đời" },
          ] as const
        ).map((opt) => (
          <HangChon
            key={opt.value}
            id={`trangThai-${opt.value}`}
            type="radio"
            name="trangThai"
            value={opt.value}
            checked={trangThai === opt.value}
            onChange={() => {
              setTrangThai(opt.value);
              // Đổi nhánh là unmount field của nhánh cũ. Không xoá lỗi ở đây
              // thì field vừa remount rỗng vẫn đeo thông báo đỏ của lần
              // submit trước — mẹ thấy lỗi cho ô mình chưa hề chạm tới.
              //
              // Chỉ xoá đúng các key thuộc nhánh (trangThai + field của cả hai
              // nhánh con), KHÔNG phải toàn bộ `errors`: xoá sạch sẽ giấu mất
              // lỗi thật ở field chung (vd. email sai) nếu mẹ đổi nhánh trước
              // khi sửa nó — lỗi biến mất nhưng field vẫn sai.
              setErrors((prev) => {
                const next = { ...prev };
                for (const k of BRANCH_ERROR_KEYS) delete next[k];
                return next;
              });
            }}
            label={opt.label}
            nhanManh
          />
        ))}
      </NhomChon>

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
                max={homNayVN()}
                className={`${inputBase} ${ring("beNgaySinh")}`}
                {...err("beNgaySinh")}
              />
            </Field>

            <NhomChon
              legend="Giới tính"
              error={errors.beGioiTinh}
              required
              luoi="grid grid-cols-2 gap-3"
            >
              {(
                [
                  { value: "nam", label: "Bé trai" },
                  { value: "nu", label: "Bé gái" },
                ] as const
              ).map((opt) => (
                <HangChon
                  key={opt.value}
                  id={`beGioiTinh-${opt.value}`}
                  type="radio"
                  name="beGioiTinh"
                  value={opt.value}
                  label={opt.label}
                  nhanManh
                />
              ))}
            </NhomChon>
          </div>
        </Nhom>
      )}

      {/* Chip ôm sát nội dung, tự xuống hàng. KHÔNG dùng grid: nhãn chủ đề dài
          ngắn rất khác nhau ("Nuôi con bằng sữa mẹ" vs "Ngủ"), grid sẽ kéo mọi ô
          theo ô rộng nhất cột và trông vỡ. flex-wrap cho mỗi ô đúng bằng chữ. */}
      <NhomChon
        legend="Chủ đề mẹ quan tâm"
        error={errors.chuDeQuanTam}
        required
        luoi="flex flex-wrap gap-3"
      >
        {CHU_DE_QUAN_TAM.map((c: LuaChon) => (
          <HangChon
            key={c.value}
            id={`chuDe-${c.value}`}
            type="checkbox"
            value={c.value}
            checked={chuDe.includes(c.value)}
            onChange={() => toggleChuDe(c.value)}
            label={c.label}
          />
        ))}
      </NhomChon>

      <Field label="Chủ đề khác (nếu có)" htmlFor="chuDeKhac" error={errors.chuDeKhac}>
        <input
          id="chuDeKhac"
          name="chuDeKhac"
          type="text"
          maxLength={200}
          placeholder="Mẹ còn quan tâm điều gì khác không?"
          className={`${inputBase} ${ring("chuDeKhac")}`}
          {...err("chuDeKhac")}
        />
      </Field>

      <NhomChon
        legend="Mẹ biết đến chương trình từ đâu?"
        error={errors.nguonBietDen}
        required
        luoi="grid gap-3 sm:grid-cols-3"
      >
        {NGUON_BIET_DEN.map((n: LuaChon) => (
          <HangChon
            key={n.value}
            id={`nguonBietDen-${n.value}`}
            type="radio"
            name="nguonBietDen"
            value={n.value}
            checked={nguon === n.value}
            onChange={() => {
              setNguon(n.value);
              clearError("nguonBietDen");
            }}
            label={n.label}
          />
        ))}
      </NhomChon>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="diCungChong"
          className="h-5 w-5 cursor-pointer rounded accent-primary"
        />
        <span className="text-base text-ink">Tôi đi cùng chồng</span>
      </label>

      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="dongYNhanTin"
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-primary"
            {...err("dongYNhanTin")}
          />
          <span className="text-base leading-6 text-ink">
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

      {/* Hết hạn / hết chỗ thì bỏ hẳn nút gửi: để nút lại chỉ mời mẹ bấm thêm
          vài lần nữa rồi nhận đúng câu trả lời đó. `role="alert"` để trình đọc
          màn hình đọc ngay, và để `scrollToFirstError` cuộn tới — nó bắt theo
          selector này.

          Quá hạn xét TRƯỚC hết chỗ: sự kiện đã qua thì "còn chỗ hay không" không
          còn là câu hỏi nữa, và câu mời phải hướng sang sự kiện SAU. */}
      {daDong ? (
        <ThongBaoDong
          tieuDe={DA_DONG.tieuDe}
          mo={DA_DONG.mo}
          nut={DA_DONG.nutTin}
        />
      ) : hetCho !== null ? (
        <ThongBaoDong
          tieuDe={HET_CHO.tieuDe(hetCho)}
          mo={HET_CHO.mo}
          nut={HET_CHO.nut}
        />
      ) : (
        <>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Đang gửi..." : "Đăng ký ngay"}
          </Button>

          <p className="text-center text-xs leading-4 text-ink-faded">
            Sự kiện miễn phí, giới hạn {SUC_CHUA_MAC_DINH} mẹ. Mẹ sẽ nhận email xác nhận
            kèm mã QR check-in.
          </p>
        </>
      )}
    </form>
  );
}
