# Spec — Bổ sung nhân vật IP bé Gạo cho trang `/su-kien`

**Ngày:** 2026-07-16
**Trang:** `src/app/su-kien/page.tsx` (Mama Ơi Day event landing)
**Nguồn yêu cầu:** `MamaOi Landing Page Brief Agency v2.docx` — Mục 1 "Key Visual sự kiện"

---

## 1. Bối cảnh & mục tiêu

Brief (Mục 1) chỉ định key visual sự kiện lấy **nhân vật IP bé Gạo** làm tham chiếu
chính cho tone (hồng/trắng, ấm áp, premium) và không khí "gia đình nhỏ hạnh phúc".
Trong KV gốc, bé Gạo là một bé gái 3D đội nơ, tay cầm tấm **MAMA ƠI PASSPORT**, bên
cạnh có gấu bông và kỳ lân cầu vồng; speech bubble ghi *"Đến và giao lưu cùng Gạo ơi
là Gạo"*.

**Hiện trạng:** trang `/su-kien` chưa có bé Gạo — hero chỉ có chữ + glow coral. Brief
lại yêu cầu hero phải có "KV chính". Trang chủ (`/`) chỉ dùng `illo-baby-girl.png` một
lần, nhỏ (128px), ở section cầu nối sự kiện.

**Mục tiêu:** đưa bé Gạo vào trang sự kiện đúng vai trò linh vật/gương mặt cộng đồng,
tăng cảm giác ấm áp & premium, không phá vỡ design system đã khoá.

## 2. Phạm vi

Hai thay đổi trên `src/app/su-kien/page.tsx` (không đụng file khác trừ khi cần):

1. **Redesign Hero** thành lưới 2 cột: chữ + bé Gạo làm key visual chính.
2. **Thêm section "Gặp bé Gạo"** ngay sau section "Giới thiệu cộng đồng".

**Ngoài phạm vi:** trang chủ, các trang khác, tạo asset ảnh mới, thay đổi form/logic
đăng ký, thay đổi copy các section khác.

## 3. Quyết định về asset (đã chốt với chủ dự án)

- Dùng **`/images/illo-baby-girl.png`** (640×640, PNG nền trong suốt, ~288KB) làm bé
  Gạo. Ảnh đã tự chứa cầu vồng (tie-in Wonder Week), mây, mặt trời, hoa, sparkles.
- **Không** tạo asset mới, **không** cắt từ KV gốc (dính nền), **không** dùng AI.
- Thẻ passport và speech bubble dựng bằng **CSS/SVG + token**, không phải ảnh.

> **Lưu ý baked-art:** vì trang trí đã "nướng" sẵn trong PNG ở 4 góc (mặt trời TL, mây
> TR, cầu vồng BR, hoa BL), **KHÔNG** đặt overlay tuyệt đối chồng lên các góc ảnh.
> Speech bubble đặt *phía trên* ảnh; thẻ passport đặt trong *cột chữ*.

## 4. Thiết kế chi tiết

### 4.1 Hero (redesign)

Thay khối `.relative mx-auto max-w-3xl text-center` hiện tại bằng lưới 2 cột. Section
wrapper giữ nguyên (`relative flex min-h-[100dvh] flex-col justify-center overflow-hidden px-5 pt-20 pb-16`).

```
<div className="relative mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-12">

  {/* Bé Gạo — DOM đứng trước để mobile hiện lên trên; desktop đẩy sang phải */}
  <div className="order-1 flex justify-center md:order-2">
    <glow blob primary-faded, absolute, blur-3xl>       {/* tĩnh */}
    <Image src="/images/illo-baby-girl.png"
           alt="Bé Gạo — nhân vật của Mama Ơi Day"
           width={640} height={640}
           priority
           className="animate-float relative w-[240px] sm:w-[300px] md:w-[360px]" />
  </div>

  {/* Chữ — canh giữa trên mobile, canh trái trên desktop */}
  <div className="order-2 text-center md:order-1 md:text-left">
    badge "Miễn phí · Giới hạn {EVENT.capacity}"   (mx-auto md:mx-0)
    h1 "Mama Ơi Day"
    p  "Hành trình 1 năm đầu đời cùng con"
    info card (Thời gian / Địa điểm)               (inline-flex, mx-auto md:mx-0)
    CTA <ButtonLink href="#dang-ky">Đăng ký ngay</ButtonLink>
    stats <dl className="grid grid-cols-2 gap-6">  (2×2 thay vì 4-ngang)
  </div>
</div>
```

- Copy hero **giữ nguyên** (không thêm chữ mới trong hero).
- Stats đổi `sm:grid-cols-4` → `grid-cols-2` để vừa cột trái hẹp hơn.
- Badge / info card thêm `mx-auto md:mx-0` để canh giữa mobile, canh trái desktop.
- Glow: giữ 1 blob ambient; có thể đặt thêm 1 blob sau bé Gạo. Cả hai **tĩnh** (không
  animation) — tuân rule `excessive-motion`.

### 4.2 Section "Gặp bé Gạo" (mới)

Chèn **ngay sau** section "Giới thiệu" (kết thúc ở dòng ~251), **trước** "Điểm nổi bật".

```
<section className="flex min-h-[100dvh] flex-col justify-center px-5 py-16">
  <Reveal className="mx-auto grid max-w-5xl items-center gap-10 rounded-3xl bg-primary-faded p-8 sm:p-12 md:grid-cols-2 md:gap-16">

    {/* Cột hình: speech bubble ở TRÊN + bé Gạo (không overlay lên góc ảnh) */}
    <div className="order-1 flex flex-col items-center">
      <div className="speech-bubble ...">Gạo ơi là Gạo! Mẹ ơi, đến chơi với Gạo nha!</div>
      <Image src="/images/illo-baby-girl.png"
             alt="Bé Gạo vẫy tay chào mẹ"
             width={640} height={640}
             className="animate-float w-[220px] sm:w-[260px]" />
    </div>

    {/* Cột chữ + thẻ passport (dựng bằng CSS, nằm trong cột này) */}
    <div className="order-2">
      <span chip bg-white text-primary>Bé Gạo</span>
      <h2>Gặp bé Gạo tại Mama Ơi Day</h2>
      <p>{đoạn 1}</p>
      <div className="passport-card ...">MAMA ƠI · PASSPORT + <SVG heart></div>
      <p>{đoạn 2 — passport}</p>
      {/* optional 3-step, xem §6 TODO(client) */}
    </div>
  </Reveal>
</section>
```

**Speech bubble** (CSS thuần, chữ thật — đọc được, không phải ảnh):
- `rounded-2xl bg-white px-4 py-2 text-sm font-bold text-ink shadow-[var(--shadow-card)]`
- Đuôi bubble: một `span` vuông xoay 45° đặt dưới đáy bubble, cùng nền trắng
  (`aria-hidden`), trỏ xuống bé Gạo.

**Passport card** (CSS thuần):
- `inline-flex ... rotate-[-4deg] rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-primary-border`
- Nội dung: nhãn nhỏ "MAMA ƠI" (uppercase, tracking, `text-primary`), dòng "PASSPORT"
  (font-extrabold), một **SVG trái tim** (không emoji) tô `text-primary`.

## 5. Copy tiếng Việt (bản nháp — chờ client duyệt wording cuối)

| Chỗ | Nội dung |
|---|---|
| Speech bubble | Gạo ơi là Gạo! Mẹ ơi, đến chơi với Gạo nha! |
| Eyebrow chip | Bé Gạo |
| Heading | Gặp bé Gạo tại Mama Ơi Day |
| Đoạn 1 | Bé Gạo là người bạn nhỏ của cộng đồng Mama Ơi — cô bé sẽ cùng mẹ và bé đi hết một ngày thật vui: từ lúc check-in, qua từng hoạt động, đến khi ra về. |
| Passport card | MAMA ƠI · PASSPORT |
| Đoạn 2 | Đến check-in, mỗi mẹ nhận một tấm **MAMA ƠI PASSPORT** xinh xắn. Cùng bé Gạo ghi dấu qua mỗi hoạt động trong ngày — và mang tấm passport về nhà làm kỷ niệm. |

Locked facts (ngày/địa điểm/quy mô) không xuất hiện mới trong hai phần này; mọi tham
chiếu dùng biến từ `EVENT` trong `src/lib/constants.ts`, không hard-code.

## 6. TODO(client) — chờ xác nhận

Theo CLAUDE.md, chỉ locked facts mới được ghi verbatim; cơ chế chưa duyệt không khẳng
định như "fact". Đánh dấu bằng comment `TODO(client)` (đúng convention repo — xem
placeholder ảnh diễn giả, logo sponsor):

- **Cơ chế passport chi tiết** (ví dụ "đóng dấu đủ hoạt động → đổi quà đặc biệt cuối
  ngày"): nếu client xác nhận, thêm một hàng 3 bước `Nhận passport → Ghi dấu từng hoạt
  động → Đổi quà`. Mặc định on-page giữ copy "làm kỷ niệm" (an toàn, không cam kết cơ
  chế chưa chốt).

## 7. UX/A11y (đã đối chiếu ui-ux-pro-max)

- `reduced-motion`: dựa vào block global có sẵn (đã tắt animation khi user yêu cầu). ✓
- `excessive-motion`: **tối đa 1 phần tử động mỗi khung** = `animate-float` trên bé Gạo;
  không thêm animation nào khác. Cầu vồng/mây/sao trong ảnh là tĩnh.
- `image-dimension`: khai báo `width={640} height={640}` để reserve chỗ, CLS≈0. Ảnh hero
  đặt `priority` (above the fold); ảnh section để mặc định lazy.
- `no-emoji-icons`: trái tim passport là **SVG inline**, không emoji.
- `color-contrast` ≥ 4.5:1: chữ speech bubble & passport dùng `text-ink`/`text-primary`
  trên nền trắng — đạt. Không dùng chữ xám-trên-hồng nhạt cho nội dung.
- `mobile-first`: bé Gạo hiện trên cả mobile (đúng brief), verify ở 375/768/1024/1440.
- `alt-text`: ảnh bé Gạo có alt mô tả (không để rỗng như ảnh trang trí). Đuôi bubble &
  glow blob `aria-hidden`.
- Không thêm link/nút mới cần focus ring; nếu thêm, dùng focus-visible như `ButtonLink`.

## 8. Kỹ thuật

- **Không thêm dependency.** Chỉ `next/image` + Tailwind + token trong `globals.css`.
- Tái dùng `Reveal` (scroll fade-up) và `animate-float`, `ButtonLink`, `CountUp`.
- Không invent màu — chỉ dùng `primary`, `primary-faded`, `primary-border`, `ink`,
  `shadow-card`… đã định nghĩa.
- Speech bubble & passport có thể để inline trong `page.tsx`; nếu lặp/nặng, tách thành
  component nhỏ trong `src/components/` (một mục đích rõ ràng mỗi file).

## 9. Danh sách thay đổi file

- `src/app/su-kien/page.tsx`
  - Sửa khối hero (dòng ~151–195): text-center → grid 2 cột + `<Image>` bé Gạo; stats 2×2.
  - Thêm `import Image` đã có sẵn (đang dùng). Không import thừa.
  - Chèn section "Gặp bé Gạo" sau section "Giới thiệu" (~sau dòng 251).
- (Tùy chọn) `src/components/BeGaoIntro.tsx` nếu tách section ra riêng cho gọn.

## 10. Kiểm chứng

1. `npm run lint` — 0 lỗi.
2. `npm run build` — build pass.
3. `npm run dev`, mở `/su-kien`, kiểm mắt:
   - Hero: bé Gạo nổi bật, chữ đọc tốt, stats 2×2 cân, không tràn ngang ở 375px.
   - Section "Gặp bé Gạo": speech bubble không chồng baked-art, passport rõ, 2 cột về 1
     cột mượt trên mobile.
   - Bật "Reduce Motion" (OS) → không còn float; nội dung hiện ngay.
4. Đối chiếu Pre-Delivery Checklist (Visual/Interaction/Layout/A11y) của ui-ux-pro-max.
