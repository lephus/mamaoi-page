# Gửi email hàng loạt cho mẹ đăng ký sự kiện — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin mở `/admin/gui-mail-hang-loat`, tick chọn mẹ nhận, tự gõ tiêu đề + nội dung, xem trước, gửi thử vào hộp thư thật, rồi gõ số để xác nhận và gửi cho tới 500 mẹ trong một lượt gọi Brevo.

**Architecture:** Phần dựng nội dung là **hàm thuần**, tách làm hai file vì lý do bundle (xem Global Constraints). Phần gửi nằm trong `brevo.ts` — nơi đã sở hữu mọi việc nói chuyện với Brevo. Route điều phối và giữ mọi cổng an toàn. Đường gửi là `POST /v3/smtp/email` với `messageVersions`: một lượt gọi HTTP, mỗi mẹ một bản riêng, không ai thấy email của ai.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19.2.4, TypeScript, Tailwind v4, Vitest 4, Supabase, Brevo REST API.

**Spec:** `docs/superpowers/specs/2026-08-05-gui-mail-hang-loat-design.md`

## Global Constraints

- **`AGENTS.md`:** đây KHÔNG phải Next.js quen thuộc. Đọc guide liên quan trong `node_modules/next/dist/docs/` trước khi viết code Next mới.
- **Vitest chỉ chạy `src/**/*.test.ts`** (`vitest.config.ts`), `environment: "node"`. **Không viết test `.tsx`** — nó sẽ không bao giờ chạy, jsdom chưa cài. Mọi logic cần test phải nằm trong file `.ts` thuần.
- **`brevo.ts` KHÔNG được import vào component `"use client"`.** Nó kéo theo `nodemailer` và `qrcode` (thuần server) — import vào client là gãy build. Đây là lý do `src/lib/mau-email.ts` tồn tại (đọc doc đầu file đó). Vì vậy plan này tách **hai** file: `cho-dien.ts` (client import được) và `mail-hang-loat.ts` (server-only).
- **Chuỗi hiển thị và comment bằng tiếng Việt.** Định danh dùng tiếng Việt không dấu theo phong cách repo.
- **Escape trước, thay chỗ điền sau.** Đảo thứ tự là lỗ hổng XSS trong email. Xem Task 2.
- **Không bao giờ báo thành công giả.** Gửi hỏng phải trả lỗi thật kèm nguyên văn phản hồi Brevo.
- **Địa chỉ người nhận THẬT chỉ đọc từ Supabase theo `ids`**, không bao giờ lấy từ client. Chế độ gửi thử là ngoại lệ có chủ ý, giới hạn đúng một địa chỉ (spec §7).
- Chạy `npm test`, `npm run lint`, `npm run build` sạch trước mỗi commit. `npm run lint` có sẵn 5 warning (0 error) ở `src/lib/validation.test.ts` — không phải của bạn, để nguyên.
- Nhánh: `feat/gui-mail-hang-loat`, tách từ `main`.

## Hai chỗ plan này CỐ Ý khác spec — đã cân nhắc, không phải trôi lệch

1. **Spec §6 phác `dungEmail(...)` trả `{ tieuDe, html }`; plan dùng `{ subject, html }`.** Khớp `noiDungEmail` ngay cạnh trong cùng file miền, và khớp đúng tên trường của payload Brevo — bớt một lần đổi tên ở route.
2. **Spec §7 ghi chế độ `"thu"` chỉ cần `tieuDe`, `noiDung`, `toiEmail`. Plan thêm `idMau` bắt buộc.** Spec bỏ sót: gửi thử mà không có một mẹ làm mẫu thì `{{ten}}` không biết thay bằng gì. Dùng đúng mẹ đầu tiên đã chọn, để email thử là **bản y hệt** thứ mẹ đó sẽ nhận, chỉ khác địa chỉ giao.
3. **Spec §4 liệt kê 6 file; plan có 8 — thêm `cho-dien.ts` và test của nó.** Spec ghi component phụ thuộc `mail-hang-loat` "chỉ type + hàm kiểm chỗ điền", nhưng điều đó **không thực hiện được**: `mail-hang-loat.ts` phải import `brevo.ts` để lấy khung HTML, mà `brevo.ts` kéo theo `nodemailer` + `qrcode` (thuần server) — import vào `"use client"` là gãy build. Tách `cho-dien.ts` không phụ thuộc gì là cách duy nhất để client kiểm được chỗ điền ngay lúc gõ. Đây đúng là lý do `mau-email.ts` tồn tại (đọc doc đầu file đó).

---

### Task 1: `cho-dien.ts` — danh mục chỗ điền, client import được

**Files:**
- Create: `src/lib/cho-dien.ts`
- Test: `src/lib/cho-dien.test.ts`

**Interfaces:**
- Consumes: — (không phụ thuộc gì)
- Produces:
  - `CHO_DIEN: readonly ["ten", "ma"]`
  - `type ChoDien = "ten" | "ma"`
  - `choDienLa(s: string): string[]` — mảng token nguyên văn (kèm dấu ngoặc) của những chỗ điền KHÔNG hợp lệ; rỗng nghĩa là sạch

**Vì sao file này tồn tại tách riêng:** component soạn mail phải cảnh báo chỗ điền sai **ngay lúc admin gõ**, nên nó cần `choDienLa` ở client. Nếu hàm đó sống trong `mail-hang-loat.ts` (file import `brevo.ts`), client sẽ kéo theo `nodemailer` + `qrcode` và build gãy — đúng cái bẫy `mau-email.ts` sinh ra để tránh.

- [ ] **Step 1: Viết test trước**

Tạo `src/lib/cho-dien.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { choDienLa } from "@/lib/cho-dien";

describe("choDienLa", () => {
  it("chỗ điền hợp lệ → mảng rỗng", () => {
    expect(choDienLa("Chào chị {{ten}}, mã của chị là {{ma}}.")).toEqual([]);
    expect(choDienLa("{{ten}}")).toEqual([]);
    expect(choDienLa("{{ma}}")).toEqual([]);
  });

  it("không có chỗ điền nào → mảng rỗng", () => {
    expect(choDienLa("Sự kiện đổi địa điểm sang ThiSkyHall Sala.")).toEqual([]);
    expect(choDienLa("")).toEqual([]);
  });

  /**
   * Ca này là lý do cả hàm tồn tại: gõ {{name}} thay vì {{ten}} mà không ai
   * chặn thì 500 mẹ nhận email mở đầu bằng "Chào chị {{name}}" — lỗi không
   * sửa lại được sau khi email đã đi.
   */
  it("chỗ điền lạ → trả nguyên văn token để báo đúng chỗ sai", () => {
    expect(choDienLa("Chào {{name}}")).toEqual(["{{name}}"]);
    expect(choDienLa("{{ho_ten}} và {{code}}")).toEqual(["{{ho_ten}}", "{{code}}"]);
  });

  /**
   * KHÔNG bỏ qua khoảng trắng, có chủ ý. Chấp nhận `{{ ten }}` nghĩa là phải
   * đồng bộ luật cắt khoảng trắng giữa chỗ KIỂM và chỗ THAY thật; lệch nhau ở
   * đó là 500 email mang chữ `{{ ten }}` nguyên si.
   */
  it("có khoảng trắng trong ngoặc → coi là sai", () => {
    expect(choDienLa("{{ ten }}")).toEqual(["{{ ten }}"]);
    expect(choDienLa("{{ten }}")).toEqual(["{{ten }}"]);
  });

  it("ngoặc rỗng → coi là sai", () => {
    expect(choDienLa("{{}}")).toEqual(["{{}}"]);
  });

  it("lọc đúng cái sai, giữ nguyên cái đúng", () => {
    expect(choDienLa("{{a}} {{ten}} {{b}} {{ma}}")).toEqual(["{{a}}", "{{b}}"]);
  });

  it("một token sai xuất hiện hai lần thì báo hai lần", () => {
    expect(choDienLa("{{x}} rồi {{x}}")).toEqual(["{{x}}", "{{x}}"]);
  });
});
```

- [ ] **Step 2: Chạy test để thấy nó hỏng**

Run: `npm test -- cho-dien`
Expected: FAIL — không resolve được `@/lib/cho-dien`.

- [ ] **Step 3: Viết `src/lib/cho-dien.ts`**

```ts
/**
 * Danh mục chỗ điền được phép trong email gửi hàng loạt, và phép kiểm chúng.
 *
 * File này CỐ Ý không import gì từ `brevo.ts`. `brevo.ts` kéo theo nodemailer và
 * qrcode (thuần server); import nó vào một component "use client" là gãy build —
 * cùng lý do `mau-email.ts` được tách ra khỏi `brevo.ts`. Màn hình soạn mail phải
 * cảnh báo chỗ điền sai ngay lúc admin gõ, nên phép kiểm phải sống được ở client.
 *
 * Phép THAY thật nằm ở `mail-hang-loat.ts` (server-only, cần khung HTML của
 * brevo.ts). Hai nơi đọc chung `CHO_DIEN` nên không bao giờ lệch danh mục.
 */
export const CHO_DIEN = ["ten", "ma"] as const;

export type ChoDien = (typeof CHO_DIEN)[number];

/** Bắt MỌI cụm `{{...}}`, kể cả rỗng và có khoảng trắng — để báo đúng cái sai. */
const MOI_CHO_DIEN = /\{\{([^}]*)\}\}/g;

/**
 * Những chỗ điền KHÔNG hợp lệ trong `s`. Trả token NGUYÊN VĂN (kèm dấu ngoặc)
 * để thông báo lỗi chỉ đúng thứ admin đã gõ, chứ không bắt họ tự dò.
 *
 * Mảng rỗng nghĩa là sạch.
 */
export function choDienLa(s: string): string[] {
  const la: string[] = [];
  for (const m of s.matchAll(MOI_CHO_DIEN)) {
    if (!(CHO_DIEN as readonly string[]).includes(m[1])) la.push(m[0]);
  }
  return la;
}
```

- [ ] **Step 4: Chạy test để thấy nó xanh**

Run: `npm test -- cho-dien`
Expected: PASS cả 7 ca.

- [ ] **Step 5: Lint + toàn bộ test**

Run: `npm run lint && npm test`
Expected: sạch.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cho-dien.ts src/lib/cho-dien.test.ts
git commit -m "feat: danh mục chỗ điền email hàng loạt, kiểm được ở cả client"
```

---

### Task 2: `mail-hang-loat.ts` — dựng tiêu đề + HTML cho một mẹ

**Files:**
- Modify: `src/lib/brevo.ts` (đổi 5 khai báo từ private sang `export`)
- Create: `src/lib/mail-hang-loat.ts`
- Test: `src/lib/mail-hang-loat.test.ts`

**Interfaces:**
- Consumes: `CHO_DIEN` (Task 1); `escapeHtml`, `shell`, `P`, `KY_TEN_BTC`, `FOOTNOTE_BTC` từ `brevo.ts`
- Produces:
  - `type MeNhan = Pick<RegistrationRow, "ho_ten" | "checkin_code">`
  - `dungEmail(tieuDe: string, noiDung: string, row: MeNhan): { subject: string; html: string }`

> **THỨ TỰ TRONG `thanThanhHtml` LÀ VẤN ĐỀ BẢO MẬT.** Escape chữ admin gõ TRƯỚC, thay chỗ điền SAU. Đảo lại thì giá trị thay vào sẽ bị escape đúng nhưng chữ admin gõ thì không — và spec §2 quyết định #5 chốt là admin **không** được gõ HTML thô. Test có ca `<script>` để ghim điều này.

- [ ] **Step 1: Export 5 khai báo từ `brevo.ts`**

Thêm từ khoá `export` vào đúng 5 dòng, **không đổi một ký tự logic nào** — email xác nhận đang chạy production không được nhúc nhích:

- dòng 177: `function escapeHtml(` → `export function escapeHtml(`
- dòng 193: `function shell(` → `export function shell(`
- dòng 272: `const P =` → `export const P =`
- dòng 274: `const KY_TEN_BTC =` → `export const KY_TEN_BTC =`
- dòng 275: `const FOOTNOTE_BTC =` → `export const FOOTNOTE_BTC =`

Thêm ngay trên `escapeHtml` một dòng doc giải thích vì sao chúng thành public:

```ts
/**
 * Năm khai báo dưới đây được export để `mail-hang-loat.ts` dựng email gửi hàng
 * loạt bằng ĐÚNG khung này. Dựng khung thứ hai ở file khác là mầm mống hai email
 * cùng thương hiệu mà trông khác nhau, và không ai phát hiện cho tới khi mẹ hỏi.
 */
```

- [ ] **Step 2: Viết test trước**

Tạo `src/lib/mail-hang-loat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dungEmail } from "@/lib/mail-hang-loat";

const LAN = { ho_ten: "Nguyễn Thị Lan", checkin_code: "MO-ABC234" };

describe("dungEmail — nội dung", () => {
  it("{{ten}} ra tên thật, {{ma}} ra mã thật", () => {
    const { html } = dungEmail("x", "Chào chị {{ten}}, mã {{ma}} nhé.", LAN);
    expect(html).toContain("Chào chị Nguyễn Thị Lan, mã MO-ABC234 nhé.");
    expect(html).not.toContain("{{");
  });

  /**
   * Ca quan trọng nhất của file. Spec chốt admin gõ CHỮ THƯỜNG, không phải HTML.
   * Nếu escape sau khi thay chỗ điền (hoặc quên escape), một dòng admin dán vào
   * có thể chèn thẻ vào email của 500 mẹ.
   */
  it("chữ admin gõ được escape — thẻ ra CHỮ, không ra thẻ", () => {
    const { html } = dungEmail("x", "<script>alert(1)</script>", LAN);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("tên mẹ có ký tự đặc biệt cũng được escape", () => {
    const { html } = dungEmail("x", "Chào {{ten}}", {
      ho_ten: "Trần & Lê <b>",
      checkin_code: "MO-ABC234",
    });
    expect(html).toContain("Trần &amp; Lê &lt;b&gt;");
    expect(html).not.toContain("<b>");
  });

  it("dòng trống ngăn đoạn → hai thẻ <p>", () => {
    const { html } = dungEmail("x", "Đoạn một.\n\nĐoạn hai.", LAN);
    expect(html).toContain("Đoạn một.");
    expect(html).toContain("Đoạn hai.");
    expect(html.match(/<p /g)?.length).toBe(2);
  });

  it("xuống dòng đơn trong một đoạn → <br>, không tách đoạn", () => {
    const { html } = dungEmail("x", "Dòng một\nDòng hai", LAN);
    expect(html).toContain("Dòng một<br>Dòng hai");
    expect(html.match(/<p /g)?.length).toBe(1);
  });

  it("bỏ đoạn rỗng do admin gõ thừa dòng trống", () => {
    const { html } = dungEmail("x", "A.\n\n\n\nB.", LAN);
    expect(html.match(/<p /g)?.length).toBe(2);
  });

  it("giữ nguyên khung thương hiệu: chân trang và chữ ký BTC", () => {
    const { html } = dungEmail("x", "Nội dung", LAN);
    expect(html).toContain("Bạn nhận được email này vì đã đăng ký tham dự");
    expect(html).toContain("Mama Ơi Team");
  });
});

describe("dungEmail — tiêu đề", () => {
  it("thay chỗ điền trong tiêu đề", () => {
    const { subject } = dungEmail("Chị {{ten}} ơi — mã {{ma}}", "x", LAN);
    expect(subject).toBe("Chị Nguyễn Thị Lan ơi — mã MO-ABC234");
  });

  /**
   * Tiêu đề là chuỗi THƯỜNG, không phải HTML. Escape ở đây làm mẹ nhận email
   * tiêu đề "Chào chị Trần &amp; Lê".
   */
  it("tiêu đề KHÔNG escape", () => {
    const { subject } = dungEmail("Chào {{ten}}", "x", {
      ho_ten: "Trần & Lê",
      checkin_code: "MO-ABC234",
    });
    expect(subject).toBe("Chào Trần & Lê");
  });

  it("tiêu đề không có chỗ điền thì giữ nguyên văn", () => {
    expect(dungEmail("Sự kiện đổi địa điểm", "x", LAN).subject).toBe(
      "Sự kiện đổi địa điểm",
    );
  });
});
```

- [ ] **Step 3: Chạy test để thấy nó hỏng**

Run: `npm test -- mail-hang-loat`
Expected: FAIL — không resolve được `@/lib/mail-hang-loat`.

- [ ] **Step 4: Viết `src/lib/mail-hang-loat.ts`**

```ts
import { escapeHtml, FOOTNOTE_BTC, KY_TEN_BTC, P, shell } from "./brevo";
import { CHO_DIEN } from "./cho-dien";
import type { RegistrationRow } from "./supabase";

/**
 * Dựng nội dung email gửi hàng loạt. THUẦN — không gọi mạng, không đọc DB, nên
 * test được đủ ca. Việc GỬI nằm ở `guiHangLoat` trong brevo.ts.
 *
 * Server-only (import brevo.ts). Phần client cần dùng thì lấy ở `cho-dien.ts`.
 */

/** Chỉ hai cột này được dùng để thay chỗ điền — không nhận cả dòng để khỏi lỡ tay dùng thêm. */
export type MeNhan = Pick<RegistrationRow, "ho_ten" | "checkin_code">;

function giaTri(row: MeNhan): Record<string, string> {
  return { ten: row.ho_ten, ma: row.checkin_code };
}

/**
 * Thay `{{ten}}` / `{{ma}}` bằng `bien`. Chỗ điền lạ giữ NGUYÊN VĂN thay vì
 * thành chuỗi rỗng: route đã chặn chúng từ trước (`choDienLa`), nên tới được
 * đây nghĩa là cổng chặn hỏng — và lúc đó `{{name}}` hiện ra trong email thử là
 * cách nhanh nhất để ai đó thấy, còn nuốt thành rỗng thì không ai biết.
 */
function thay(s: string, bien: Record<string, string>): string {
  return s.replace(/\{\{([^}]*)\}\}/g, (nguyenVan, ten: string) =>
    ten in bien ? bien[ten] : nguyenVan,
  );
}

/**
 * Chữ admin gõ → HTML an toàn.
 *
 * THỨ TỰ Ở ĐÂY LÀ VẤN ĐỀ BẢO MẬT, đừng đảo:
 *  1. escape chữ admin gõ TRƯỚC — spec chốt không cho gõ HTML thô, nên
 *     `<script>` phải ra chữ chứ không ra thẻ;
 *  2. xuống dòng đơn thành `<br>`;
 *  3. RỒI mới thay chỗ điền, bằng giá trị đã escape riêng.
 *
 * `{{ten}}` không chứa ký tự đặc biệt nên nó sống sót nguyên vẹn qua bước 1;
 * còn mẹ tên "Trần & Lê" thì dấu `&` được escape đúng ở bước 3.
 */
function thanThanhHtml(noiDung: string, row: MeNhan): string {
  const v = giaTri(row);
  const bien = Object.fromEntries(CHO_DIEN.map((k) => [k, escapeHtml(v[k])]));
  return noiDung
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((doan) => doan.trim())
    .filter(Boolean)
    .map(
      (doan) => `<p ${P}>${thay(escapeHtml(doan).replace(/\n/g, "<br>"), bien)}</p>`,
    )
    .join("\n");
}

/**
 * Tiêu đề + HTML đã sẵn sàng gửi cho MỘT mẹ.
 *
 * Trả `{ subject, html }` để khớp `noiDungEmail` ngay cạnh và khớp đúng tên
 * trường của payload Brevo — bớt một lần đổi tên ở route.
 *
 * Tiêu đề KHÔNG escape: nó là chuỗi thường, không phải HTML. Escape ở đây làm
 * mẹ nhận email tiêu đề "Chào chị Trần &amp; Lê".
 */
export function dungEmail(
  tieuDe: string,
  noiDung: string,
  row: MeNhan,
): { subject: string; html: string } {
  return {
    subject: thay(tieuDe, giaTri(row)),
    html: shell(thanThanhHtml(noiDung, row), FOOTNOTE_BTC, KY_TEN_BTC),
  };
}
```

- [ ] **Step 5: Chạy test để thấy nó xanh**

Run: `npm test -- mail-hang-loat`
Expected: PASS cả 10 ca.

- [ ] **Step 6: Toàn bộ test + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: sạch. Đặc biệt xác nhận `brevo.test.ts` vẫn xanh — việc export không được đổi hành vi email cũ.

- [ ] **Step 7: Commit**

```bash
git add src/lib/brevo.ts src/lib/mail-hang-loat.ts src/lib/mail-hang-loat.test.ts
git commit -m "feat: dựng tiêu đề và HTML email hàng loạt từ chữ admin gõ"
```

---

### Task 3: `guiHangLoat()` — gửi qua Brevo, chia lô, không lộ email

**Files:**
- Modify: `src/lib/brevo.ts` (thêm hằng + type + hàm ở cuối file)
- Test: `src/lib/brevo.test.ts` (thêm `describe` mới)

**Interfaces:**
- Consumes: hàm private `brevo(path, body)` sẵn có trong cùng file (`brevo.ts:16`)
- Produces:
  - `type BanGuiMot = { email: string; hoTen: string; subject: string; html: string }`
  - `guiHangLoat(ban: BanGuiMot[]): Promise<number>` — trả số email đã gửi; **ném lỗi** nếu Brevo từ chối

> **Không nhét nhiều địa chỉ vào một trường `to`.** Làm thế là lộ email của cả 500 mẹ cho nhau — một sự cố riêng tư thật, không phải chi tiết kỹ thuật. `messageVersions` cho mỗi bản một `to` riêng.

- [ ] **Step 1: Mở rộng phần import ở ĐẦU `src/lib/brevo.test.ts`**

Dòng 1 hiện là `import { describe, expect, it } from "vitest";`. Sửa thành hai dòng (import phải nằm ở đầu file, không nhét xuống cuối được):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guiHangLoat, noiDungEmail } from "./brevo";
```

và **xoá** dòng `import { noiDungEmail } from "./brevo";` cũ để không import trùng.

- [ ] **Step 2: Viết test — thêm vào cuối `src/lib/brevo.test.ts`**

```ts
describe("guiHangLoat", () => {
  const goi = vi.fn();

  beforeEach(() => {
    goi.mockReset();
    goi.mockResolvedValue({ ok: true, status: 201, text: async () => "" });
    vi.stubGlobal("fetch", goi);
    process.env.BREVO_API_KEY = "xkeysib-test";
    process.env.BREVO_SENDER_EMAIL = "hello@mamaoi.vn";
    process.env.BREVO_SENDER_NAME = "Mama Ơi";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ban = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      email: `me${i}@example.com`,
      hoTen: `Mẹ ${i}`,
      subject: `Tiêu đề ${i}`,
      html: `<p>Nội dung ${i}</p>`,
    }));

  /** Đọc body JSON của lượt gọi fetch thứ `i`. */
  const body = (i: number) => JSON.parse(goi.mock.calls[i][1].body as string);

  it("gửi đúng endpoint transactional của Brevo", async () => {
    await guiHangLoat(ban(2));
    expect(goi).toHaveBeenCalledTimes(1);
    expect(goi.mock.calls[0][0]).toBe("https://api.brevo.com/v3/smtp/email");
  });

  /**
   * Tính chất quan trọng nhất của hàm này. Một trường `to` mang 500 địa chỉ là
   * lộ email của cả 500 mẹ cho nhau — sự cố riêng tư thật, không phải chi tiết
   * kỹ thuật.
   */
  it("mỗi mẹ một messageVersion riêng, mỗi bản đúng MỘT người nhận", async () => {
    await guiHangLoat(ban(3));
    const v = body(0).messageVersions;
    expect(v).toHaveLength(3);
    for (const [i, ban1] of v.entries()) {
      expect(ban1.to).toHaveLength(1);
      expect(ban1.to[0].email).toBe(`me${i}@example.com`);
      expect(ban1.subject).toBe(`Tiêu đề ${i}`);
      expect(ban1.htmlContent).toBe(`<p>Nội dung ${i}</p>`);
    }
  });

  it("500 mẹ vẫn đúng MỘT lượt gọi — sức chứa sự kiện nằm gọn trong một lô", async () => {
    expect(await guiHangLoat(ban(500))).toBe(500);
    expect(goi).toHaveBeenCalledTimes(1);
  });

  /**
   * Brevo giới hạn 1000 messageVersions mỗi lượt. Vòng chia lô tồn tại để ngày
   * nào đó EVENT_CAPACITY được nâng lên thì hệ thống không ÂM THẦM cắt bớt
   * người nhận — im lặng bỏ rơi 500 mẹ là kiểu hỏng tệ nhất ở đây.
   */
  it("1500 mẹ chia đúng 2 lô, không bỏ sót ai", async () => {
    expect(await guiHangLoat(ban(1500))).toBe(1500);
    expect(goi).toHaveBeenCalledTimes(2);
    expect(body(0).messageVersions).toHaveLength(1000);
    expect(body(1).messageVersions).toHaveLength(500);
  });

  it("danh sách rỗng thì không gọi Brevo", async () => {
    expect(await guiHangLoat([])).toBe(0);
    expect(goi).not.toHaveBeenCalled();
  });

  it("Brevo từ chối → ném lỗi kèm nguyên văn phản hồi, không báo thành công giả", async () => {
    goi.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"message":"Invalid sender"}',
    });
    await expect(guiHangLoat(ban(2))).rejects.toThrow("Invalid sender");
  });

  it("hỏng ở lô thứ hai thì lỗi nói rõ đã gửi được bao nhiêu", async () => {
    goi
      .mockResolvedValueOnce({ ok: true, status: 201, text: async () => "" })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" });
    await expect(guiHangLoat(ban(1500))).rejects.toThrow("1000/1500");
  });

  it("thiếu BREVO_SENDER_EMAIL → lỗi rõ ràng, không gọi Brevo", async () => {
    delete process.env.BREVO_SENDER_EMAIL;
    await expect(guiHangLoat(ban(1))).rejects.toThrow("BREVO_SENDER_EMAIL");
    expect(goi).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Chạy test để thấy nó hỏng**

Run: `npm test -- brevo`
Expected: FAIL — `guiHangLoat` chưa được export.

- [ ] **Step 4: Viết `guiHangLoat` ở cuối `src/lib/brevo.ts`**

```ts
/** Giới hạn messageVersions mỗi lượt gọi — luật của Brevo, không phải con số tuỳ chọn. */
const TOI_DA_MOI_LO = 1000;

export type BanGuiMot = {
  email: string;
  hoTen: string;
  subject: string;
  html: string;
};

/**
 * Gửi hàng loạt qua API GIAO DỊCH của Brevo, mỗi người nhận một bản riêng.
 *
 * KHÔNG dùng `send()` ở trên: nó đi qua SMTP relay, mỗi lần một email tuần tự —
 * 500 mẹ là 500 lượt bắt tay SMTP, không sống nổi trong giới hạn thời gian một
 * hàm trên Vercel.
 *
 * KHÔNG nhét nhiều địa chỉ vào một trường `to`: làm thế là lộ email của cả 500
 * mẹ cho nhau. `messageVersions` cho mỗi bản một `to` riêng.
 *
 * Chia lô 1000 (giới hạn Brevo). Với sức chứa 500 hiện tại thì luôn đúng một
 * lượt gọi; vòng lặp tồn tại chỉ để ngày nào đó EVENT_CAPACITY được nâng lên
 * thì hệ thống không ÂM THẦM cắt bớt người nhận.
 *
 * Ném lỗi kèm nguyên văn phản hồi Brevo VÀ số đã gửi được. Báo "đã gửi" khi
 * chưa gửi được nghĩa là không ai gửi lại, và 500 mẹ không biết tin.
 */
export async function guiHangLoat(ban: BanGuiMot[]): Promise<number> {
  if (ban.length === 0) return 0;

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME ?? SITE.name;
  if (!senderEmail) throw new Error("BREVO_SENDER_EMAIL chưa được cấu hình");

  let daGui = 0;
  for (let i = 0; i < ban.length; i += TOI_DA_MOI_LO) {
    const lo = ban.slice(i, i + TOI_DA_MOI_LO);
    const res = await brevo("/smtp/email", {
      sender: { name: senderName, email: senderEmail },
      // Bản gốc chỉ là chỗ dựa cho payload; mỗi messageVersion tự mang
      // subject/htmlContent riêng và đó mới là thứ tới hộp thư của mẹ.
      subject: lo[0].subject,
      htmlContent: lo[0].html,
      messageVersions: lo.map((b) => ({
        to: [{ email: b.email, name: b.hoTen }],
        subject: b.subject,
        htmlContent: b.html,
      })),
    });
    if (!res.ok) {
      const chiTiet = await res.text().catch(() => "");
      throw new Error(
        `Brevo từ chối (đã gửi ${daGui}/${ban.length}): ${res.status} ${chiTiet}`.trim(),
      );
    }
    daGui += lo.length;
  }
  return daGui;
}
```

- [ ] **Step 5: Chạy test để thấy nó xanh**

Run: `npm test -- brevo`
Expected: PASS — 8 ca mới, và mọi ca `noiDungEmail` cũ vẫn xanh.

- [ ] **Step 6: Toàn bộ test + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: sạch.

- [ ] **Step 7: Commit**

```bash
git add src/lib/brevo.ts src/lib/brevo.test.ts
git commit -m "feat: guiHangLoat gửi qua messageVersions, mỗi mẹ một bản riêng"
```

---

### Task 4: Route `/api/admin/gui-mail-hang-loat` — ba chế độ và mọi cổng an toàn

**Files:**
- Create: `src/app/api/admin/gui-mail-hang-loat/route.ts`
- Test: `src/app/api/admin/gui-mail-hang-loat/route.test.ts`

**Interfaces:**
- Consumes: `isAdmin` (`@/lib/admin-auth`); `choDienLa` (Task 1); `dungEmail`, `MeNhan` (Task 2); `guiHangLoat`, `BanGuiMot` (Task 3); `listRegistrations` (`@/lib/supabase`)
- Produces: `POST /api/admin/gui-mail-hang-loat`

| `che_do` | Bắt buộc kèm | Trả về |
|---|---|---|
| `"xem"` | `tieuDe`, `noiDung`, `idMau` | `{ ok, subject, html }` — không gửi gì |
| `"thu"` | `tieuDe`, `noiDung`, `idMau`, `toiEmail` | `{ ok, daGui: 1 }` |
| `"that"` | `tieuDe`, `noiDung`, `ids[]`, `xacNhanSoLuong` | `{ ok, daGui }` |

- [ ] **Step 1: Viết test trước**

Tạo `src/app/api/admin/gui-mail-hang-loat/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as adminAuth from "@/lib/admin-auth";
import * as brevo from "@/lib/brevo";
import * as supabase from "@/lib/supabase";

vi.mock("@/lib/admin-auth", () => ({ isAdmin: vi.fn(async () => true) }));
vi.mock("@/lib/supabase", () => ({ listRegistrations: vi.fn() }));
vi.mock("@/lib/brevo", async (goc) => ({
  // `dungEmail` gọi shell/escapeHtml thật qua brevo.ts — giữ nguyên bản thật để
  // test này khẳng định được HTML thật, chỉ thay đúng phần GỬI.
  ...(await goc<typeof brevo>()),
  guiHangLoat: vi.fn(async (ban: brevo.BanGuiMot[]) => ban.length),
}));

const ROWS = [
  {
    id: "id-1",
    ho_ten: "Nguyễn Thị Lan",
    email: "lan@example.com",
    checkin_code: "MO-ABC234",
  },
  {
    id: "id-2",
    ho_ten: "Trần Thị Mai",
    email: "mai@example.com",
    checkin_code: "MO-BCDEFG",
  },
] as unknown as supabase.RegistrationRow[];

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/admin/gui-mail-hang-loat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const CO_BAN = { tieuDe: "Sự kiện đổi địa điểm", noiDung: "Chào chị {{ten}}." };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminAuth.isAdmin).mockResolvedValue(true);
  vi.mocked(supabase.listRegistrations).mockResolvedValue(ROWS);
  vi.mocked(brevo.guiHangLoat).mockImplementation(async (ban) => ban.length);
});

describe("/api/admin/gui-mail-hang-loat", () => {
  it("chặn người chưa đăng nhập, và KHÔNG gửi gì", async () => {
    vi.mocked(adminAuth.isAdmin).mockResolvedValue(false);
    const res = await post({ ...CO_BAN, che_do: "that", ids: ["id-1"], xacNhanSoLuong: 1 });
    expect(res.status).toBe(401);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("chế độ lạ → 400", async () => {
    expect((await post({ ...CO_BAN, che_do: "xoaHet" })).status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("thiếu tiêu đề hoặc nội dung → 400", async () => {
    expect((await post({ che_do: "xem", noiDung: "x", idMau: "id-1" })).status).toBe(400);
    expect((await post({ che_do: "xem", tieuDe: "x", idMau: "id-1" })).status).toBe(400);
    expect(
      (await post({ che_do: "xem", tieuDe: "  ", noiDung: "  ", idMau: "id-1" })).status,
    ).toBe(400);
  });

  /**
   * Không chặn thì 500 mẹ nhận email mở đầu bằng "Chào chị {{name}}" — lỗi
   * không ai sửa lại được sau khi email đã đi.
   */
  it("chỗ điền lạ → 400 kèm token sai, KHÔNG gửi", async () => {
    const res = await post({
      che_do: "that",
      tieuDe: "x",
      noiDung: "Chào {{name}}",
      ids: ["id-1"],
      xacNhanSoLuong: 1,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("{{name}}");
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("chỗ điền lạ trong TIÊU ĐỀ cũng bị chặn", async () => {
    const res = await post({
      che_do: "that",
      tieuDe: "Chào {{name}}",
      noiDung: "x",
      ids: ["id-1"],
      xacNhanSoLuong: 1,
    });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("xem trước: trả HTML thật, KHÔNG gửi gì", async () => {
    const res = await post({ ...CO_BAN, che_do: "xem", idMau: "id-1" });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.html).toContain("Chào chị Nguyễn Thị Lan.");
    expect(data.subject).toBe("Sự kiện đổi địa điểm");
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("xem trước với idMau không tồn tại → 404", async () => {
    expect((await post({ ...CO_BAN, che_do: "xem", idMau: "khong-co" })).status).toBe(404);
  });

  it("gửi thử: đúng 1 email, tới địa chỉ admin gõ, nội dung của mẹ mẫu", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "thu",
      idMau: "id-1",
      toiEmail: "toi@digitalunicorn.tech",
    });
    expect(res.status).toBe(200);
    expect(brevo.guiHangLoat).toHaveBeenCalledTimes(1);
    const ban = vi.mocked(brevo.guiHangLoat).mock.calls[0][0];
    expect(ban).toHaveLength(1);
    expect(ban[0].email).toBe("toi@digitalunicorn.tech");
    expect(ban[0].html).toContain("Chào chị Nguyễn Thị Lan.");
  });

  it("gửi thử với email sai định dạng → 400", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "thu",
      idMau: "id-1",
      toiEmail: "khong-phai-email",
    });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  /**
   * Cổng chặn quan trọng nhất của route. Một lượt "thu" không thể vô tình biến
   * thành lượt bắn 500 email: muốn thế nó phải mang đủ 500 ids VÀ đúng con số.
   */
  it("gửi thật: xacNhanSoLuong lệch ids.length → 400, KHÔNG gửi", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1", "id-2"],
      xacNhanSoLuong: 1,
    });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("gửi thật: ids rỗng → 400", async () => {
    const res = await post({ ...CO_BAN, che_do: "that", ids: [], xacNhanSoLuong: 0 });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  /**
   * Client chỉ được nói "gửi cho id nào", không được nói "gửi tới email nào" —
   * nếu không, một tab admin bị chiếm có thể chuyển hướng cả đợt gửi sang hòm
   * thư lạ. Cùng nguyên tắc /api/admin/export đang dùng.
   */
  it("gửi thật: đọc email TỪ DB, bỏ qua email client khai", async () => {
    await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1", "id-2"],
      xacNhanSoLuong: 2,
      emails: ["ke-gian@evil.com"],
    });
    const ban = vi.mocked(brevo.guiHangLoat).mock.calls[0][0];
    expect(ban.map((b) => b.email).sort()).toEqual([
      "lan@example.com",
      "mai@example.com",
    ]);
  });

  it("gửi thật: mỗi mẹ nhận bản có tên mình", async () => {
    await post({ ...CO_BAN, che_do: "that", ids: ["id-1", "id-2"], xacNhanSoLuong: 2 });
    const ban = vi.mocked(brevo.guiHangLoat).mock.calls[0][0];
    expect(ban.find((b) => b.email === "lan@example.com")!.html).toContain(
      "Chào chị Nguyễn Thị Lan.",
    );
    expect(ban.find((b) => b.email === "mai@example.com")!.html).toContain(
      "Chào chị Trần Thị Mai.",
    );
  });

  it("gửi thật: có id không tồn tại trong DB → 400, KHÔNG gửi", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1", "id-khong-co"],
      xacNhanSoLuong: 2,
    });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("gửi thật thành công → trả số đã gửi", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1", "id-2"],
      xacNhanSoLuong: 2,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).daGui).toBe(2);
  });

  it("Brevo hỏng → 502 kèm lỗi thật, không báo thành công giả", async () => {
    vi.mocked(brevo.guiHangLoat).mockRejectedValue(new Error("Brevo từ chối: 400"));
    const res = await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1"],
      xacNhanSoLuong: 1,
    });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("Brevo từ chối");
  });
});
```

- [ ] **Step 2: Chạy test để thấy nó hỏng**

Run: `npm test -- gui-mail-hang-loat`
Expected: FAIL — không resolve được `./route`.

- [ ] **Step 3: Viết `src/app/api/admin/gui-mail-hang-loat/route.ts`**

```ts
import { isAdmin } from "@/lib/admin-auth";
import { guiHangLoat, type BanGuiMot } from "@/lib/brevo";
import { choDienLa } from "@/lib/cho-dien";
import { dungEmail } from "@/lib/mail-hang-loat";
import { listRegistrations, type RegistrationRow } from "@/lib/supabase";

/**
 * Gửi email hàng loạt cho mẹ đăng ký sự kiện — nội dung do admin gõ tay.
 *
 * KHÁC HẲN `/api/admin/gui-mail`: cái kia gửi MẪU CỐ ĐỊNH đã duyệt câu chữ cho
 * MỘT mẹ theo mã. Cái này gửi chữ gõ tay cho HÀNG TRĂM mẹ. Hai mức rủi ro khác
 * nhau nên tách route, đừng gộp.
 *
 * Ba chế độ, phân biệt bằng THAM SỐ BẮT BUỘC KHÁC NHAU chứ không chỉ bằng một
 * cờ — để một lượt "thu" không thể vô tình biến thành lượt bắn 500 email.
 */
// Một lượt gọi Brevo mang 500 bản riêng cần thời gian thật.
export const maxDuration = 60;

const TOI_DA_TIEU_DE = 200;
const TOI_DA_NOI_DUNG = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const loi = (text: string, status: number) =>
  Response.json({ error: text }, { status });

/** Dòng DB → một bản gửi. Địa chỉ nhận truyền riêng vì chế độ "thu" đổi nó. */
function banGui(row: RegistrationRow, toiEmail: string, tieuDe: string, noiDung: string): BanGuiMot {
  const { subject, html } = dungEmail(tieuDe, noiDung, row);
  return { email: toiEmail, hoTen: row.ho_ten, subject, html };
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return loi("Chưa đăng nhập", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return loi("Dữ liệu không hợp lệ", 400);
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const che_do = b.che_do;
  if (che_do !== "xem" && che_do !== "thu" && che_do !== "that") {
    return loi("Chế độ không hợp lệ", 400);
  }

  const tieuDe = typeof b.tieuDe === "string" ? b.tieuDe.trim() : "";
  const noiDung = typeof b.noiDung === "string" ? b.noiDung.trim() : "";
  if (!tieuDe || !noiDung) return loi("Thiếu tiêu đề hoặc nội dung", 400);
  if (tieuDe.length > TOI_DA_TIEU_DE) return loi(`Tiêu đề quá ${TOI_DA_TIEU_DE} ký tự`, 400);
  if (noiDung.length > TOI_DA_NOI_DUNG) return loi(`Nội dung quá ${TOI_DA_NOI_DUNG} ký tự`, 400);

  // Chặn chỗ điền lạ TRƯỚC mọi thứ khác: đây là lỗi duy nhất mà admin không
  // thấy được cho tới khi mẹ mở email ra.
  const la = [...choDienLa(tieuDe), ...choDienLa(noiDung)];
  if (la.length > 0) {
    return loi(`Chỗ điền không hợp lệ: ${la.join(", ")}. Chỉ dùng {{ten}} và {{ma}}.`, 400);
  }

  let rows: RegistrationRow[];
  try {
    rows = await listRegistrations();
  } catch (err) {
    console.error("[admin/gui-mail-hang-loat] đọc DB hỏng:", err);
    return loi("Không đọc được danh sách đăng ký", 502);
  }

  // ---------- xem trước / gửi thử: cần một mẹ làm dữ liệu mẫu ----------
  if (che_do === "xem" || che_do === "thu") {
    const idMau = typeof b.idMau === "string" ? b.idMau : "";
    if (!idMau) return loi("Thiếu mẹ làm mẫu", 400);
    const mau = rows.find((r) => r.id === idMau);
    if (!mau) return loi("Không tìm thấy mẹ làm mẫu", 404);

    if (che_do === "xem") {
      const { subject, html } = dungEmail(tieuDe, noiDung, mau);
      return Response.json({ ok: true, subject, html });
    }

    const toiEmail = typeof b.toiEmail === "string" ? b.toiEmail.trim() : "";
    if (!EMAIL_RE.test(toiEmail)) return loi("Địa chỉ nhận thử không hợp lệ", 400);

    // Có dấu vết cho lượt gửi thử: đây là đường DUY NHẤT của route này chấp
    // nhận địa chỉ do client khai (spec §7), nên nó phải để lại log.
    console.log("[admin/gui-mail-hang-loat] gửi thử tới:", toiEmail);
    try {
      await guiHangLoat([banGui(mau, toiEmail, tieuDe, noiDung)]);
    } catch (err) {
      console.error("[admin/gui-mail-hang-loat] gửi thử hỏng:", err);
      return loi(err instanceof Error ? err.message : "Gửi thử thất bại", 502);
    }
    return Response.json({ ok: true, daGui: 1 });
  }

  // ---------- gửi thật ----------
  const ids = b.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== "string")) {
    return loi("Thiếu danh sách người nhận", 400);
  }
  // Cổng chặn cốt lõi: admin phải GÕ đúng số người nhận. Một cú bấm nhầm không
  // vượt qua được cái này, vì nó đòi cả danh sách id lẫn con số khớp.
  if (b.xacNhanSoLuong !== ids.length) {
    return loi(`Số xác nhận không khớp — cần đúng ${ids.length}`, 400);
  }

  const muon = new Set(ids as string[]);
  const nhan = rows.filter((r) => muon.has(r.id));
  // Lệch nghĩa là client và DB không cùng một danh sách — con số admin vừa gõ
  // không còn nghĩa như họ tưởng. Dừng thay vì gửi cho một tập khác.
  if (nhan.length !== ids.length) {
    return loi("Danh sách người nhận đã thay đổi. Tải lại trang rồi chọn lại.", 400);
  }

  try {
    // Địa chỉ lấy từ `r.email` của DB, KHÔNG từ client — cùng nguyên tắc
    // /api/admin/export: client chỉ được nói "gửi cho id nào".
    const daGui = await guiHangLoat(
      nhan.map((r) => banGui(r, r.email, tieuDe, noiDung)),
    );
    return Response.json({ ok: true, daGui });
  } catch (err) {
    console.error("[admin/gui-mail-hang-loat] gửi hỏng:", err);
    return loi(err instanceof Error ? err.message : "Gửi email thất bại", 502);
  }
}
```

- [ ] **Step 4: Chạy test để thấy nó xanh**

Run: `npm test -- gui-mail-hang-loat`
Expected: PASS cả 16 ca.

- [ ] **Step 5: Toàn bộ test + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: sạch.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/gui-mail-hang-loat/
git commit -m "feat: route gửi mail hàng loạt ba chế độ, cổng xác nhận số lượng"
```

---

### Task 5: Trang `/admin/gui-mail-hang-loat` và lối vào từ `/admin`

**Files:**
- Create: `src/app/admin/gui-mail-hang-loat/page.tsx`
- Create: `src/components/GuiMailHangLoatTool.tsx`
- Modify: `src/components/AdminDashboard.tsx` (thêm một `<Link>` vào cụm nút đầu trang)

**Interfaces:**
- Consumes: `POST /api/admin/gui-mail-hang-loat` (Task 4); `choDienLa`, `CHO_DIEN` (Task 1); `listRegistrations`, `RegistrationRow` (`@/lib/supabase`); `boDau` (`@/lib/text`)
- Produces: — (task cuối)

> **KHÔNG có test tự động cho task này** — cả hai file mới là `.tsx`, mà `vitest.config.ts` chỉ include `src/**/*.test.ts` với `environment: "node"`, jsdom chưa cài. Kiểm chứng bằng `npm run lint` + `npm run build` + `npm test` (suite cũ phải giữ nguyên số ca xanh) + gửi thử vào hộp thư thật ở Step 6.
>
> **KHÔNG import `@/lib/mail-hang-loat` vào component.** File đó import `brevo.ts` → kéo theo `nodemailer` + `qrcode` → gãy build client. Component chỉ được import `@/lib/cho-dien`.

- [ ] **Step 1: Tạo `src/app/admin/gui-mail-hang-loat/page.tsx`**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GuiMailHangLoatTool } from "@/components/GuiMailHangLoatTool";
import { isAdmin } from "@/lib/admin-auth";
import { listRegistrations } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Admin — Gửi email hàng loạt",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GuiMailHangLoatPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <GuiMailHangLoatTool
      rows={await listRegistrations()}
      emailMacDinh={process.env.ADMIN_EMAIL ?? ""}
    />
  );
}
```

- [ ] **Step 2: Tạo `src/components/GuiMailHangLoatTool.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { choDienLa } from "@/lib/cho-dien";
import type { RegistrationRow } from "@/lib/supabase";
import { boDau } from "@/lib/text";

type KetQua = { ok: boolean; text: string };

export function GuiMailHangLoatTool({
  rows,
  emailMacDinh,
}: {
  rows: RegistrationRow[];
  emailMacDinh: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [chon, setChon] = useState<Set<string>>(new Set());
  const [tieuDe, setTieuDe] = useState("");
  const [noiDung, setNoiDung] = useState("");
  const [toiEmail, setToiEmail] = useState(emailMacDinh);
  const [soXacNhan, setSoXacNhan] = useState("");
  const [xemTruoc, setXemTruoc] = useState<{ subject: string; html: string } | null>(null);
  const [dangChay, setDangChay] = useState<"" | "xem" | "thu" | "that">("");
  const [ketQua, setKetQua] = useState<KetQua | null>(null);

  const hienThi = useMemo(() => {
    const s = boDau(q.trim());
    if (!s) return rows;
    return rows.filter((r) =>
      [r.ho_ten, r.email, r.sdt, r.checkin_code].some((v) => boDau(v ?? "").includes(s)),
    );
  }, [rows, q]);

  const la = [...choDienLa(tieuDe), ...choDienLa(noiDung)];
  const soChon = chon.size;
  const idMau = rows.find((r) => chon.has(r.id))?.id ?? "";
  const duNoiDung = tieuDe.trim() !== "" && noiDung.trim() !== "";
  const sanSang = soChon > 0 && duNoiDung && la.length === 0 && dangChay === "";
  const khopSo = soXacNhan.trim() === String(soChon);

  function bat(id: string) {
    setChon((cu) => {
      const moi = new Set(cu);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });
  }

  async function goi(che_do: "xem" | "thu" | "that") {
    setDangChay(che_do);
    setKetQua(null);
    try {
      const res = await fetch("/api/admin/gui-mail-hang-loat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          che_do,
          tieuDe,
          noiDung,
          ...(che_do === "that"
            ? { ids: [...chon], xacNhanSoLuong: chon.size }
            : { idMau, ...(che_do === "thu" ? { toiEmail } : {}) }),
        }),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setKetQua({ ok: false, text: data.error ?? "Thất bại" });
        return;
      }
      if (che_do === "xem") setXemTruoc({ subject: data.subject, html: data.html });
      else if (che_do === "thu") setKetQua({ ok: true, text: `Đã gửi thử tới ${toiEmail}` });
      else {
        setKetQua({ ok: true, text: `Đã gửi ${data.daGui} email` });
        setSoXacNhan("");
      }
    } catch {
      // KHÔNG nói "chưa gửi": request đã bay đi thì client không biết Brevo đã
      // nhận chưa. Nói "chưa gửi" là dụ admin bấm lại và 500 mẹ nhận hai lần.
      setKetQua({
        ok: false,
        text:
          che_do === "that"
            ? "Mất kết nối. KHÔNG chắc đã gửi hay chưa — kiểm tra nhật ký Brevo trước khi gửi lại."
            : "Không kết nối được. Thử lại.",
      });
    } finally {
      setDangChay("");
    }
  }

  return (
    <main className="flex-1 bg-cream">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-ink">Gửi email hàng loạt</h1>
          <Link
            href="/admin"
            className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink-faded hover:bg-primary-faded-hover"
          >
            ← Danh sách
          </Link>
        </div>

        {/* ---------- Chọn người nhận ---------- */}
        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink">
              Đã chọn <strong className="text-primary">{soChon}</strong> / {rows.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setChon((cu) => new Set([...cu, ...hienThi.map((r) => r.id)]))}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-primary-faded-hover"
              >
                Chọn tất cả đang hiện ({hienThi.length})
              </button>
              <button
                onClick={() => setChon(new Set())}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-faded hover:bg-primary-faded-hover"
              >
                Bỏ chọn tất cả
              </button>
            </div>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên, email, SĐT hoặc mã..."
            className="mt-4 w-full rounded-xl border border-line px-4 py-3 text-base text-ink placeholder:text-ink-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary sm:max-w-md"
          />

          <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 border-b border-line bg-white text-ink-faded">
                <tr>
                  <th className="px-3 py-2 font-semibold">Chọn</th>
                  <th className="px-3 py-2 font-semibold">Họ tên</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Tỉnh/thành</th>
                  <th className="px-3 py-2 font-semibold">Đồng ý nhận tin</th>
                </tr>
              </thead>
              <tbody>
                {hienThi.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={chon.has(r.id)}
                        onChange={() => bat(r.id)}
                        aria-label={`Chọn ${r.ho_ten}`}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-ink">{r.ho_ten}</div>
                      <div className="text-xs text-ink-faded">{r.checkin_code}</div>
                    </td>
                    <td className="px-3 py-2 text-ink">{r.email}</td>
                    <td className="px-3 py-2 text-ink">{r.tinh_thanh}</td>
                    <td className="px-3 py-2 text-ink">
                      {r.dong_y_nhan_tin ? "Có" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- Soạn ---------- */}
        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          <label htmlFor="tieu-de" className="text-sm font-semibold text-ink">
            Tiêu đề
          </label>
          <input
            id="tieu-de"
            value={tieuDe}
            onChange={(e) => setTieuDe(e.target.value)}
            maxLength={200}
            className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <label htmlFor="noi-dung" className="mt-4 block text-sm font-semibold text-ink">
            Nội dung
          </label>
          <textarea
            id="noi-dung"
            value={noiDung}
            onChange={(e) => setNoiDung(e.target.value)}
            rows={10}
            maxLength={5000}
            className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-base leading-6 text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="mt-2 text-sm text-ink-faded">
            Gõ chữ thường. Dòng trống ngăn đoạn. Dùng được{" "}
            <code className="rounded bg-cream px-1">{"{{ten}}"}</code> và{" "}
            <code className="rounded bg-cream px-1">{"{{ma}}"}</code>.
          </p>
          {la.length > 0 && (
            <p role="alert" className="mt-2 text-sm font-semibold text-danger">
              Chỗ điền không hợp lệ: {la.join(", ")} — chỉ dùng {"{{ten}}"} và {"{{ma}}"}.
            </p>
          )}
        </section>

        {/* ---------- Xem trước / gửi thử ---------- */}
        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          {soChon === 0 && (
            <p className="text-sm text-ink-faded">
              Chọn ít nhất một mẹ để xem trước — bản xem trước dựng bằng dữ liệu thật
              của mẹ đầu tiên đã chọn.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <button
              onClick={() => void goi("xem")}
              disabled={!sanSang}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dangChay === "xem" ? "Đang dựng..." : "Xem trước"}
            </button>
            <div>
              <label htmlFor="toi-email" className="text-xs text-ink-faded">
                Gửi thử tới
              </label>
              <input
                id="toi-email"
                value={toiEmail}
                onChange={(e) => setToiEmail(e.target.value)}
                className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => void goi("thu")}
              disabled={!sanSang || !toiEmail.trim()}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dangChay === "thu" ? "Đang gửi..." : "Gửi thử"}
            </button>
          </div>

          {xemTruoc && (
            <div className="mt-4">
              <p className="text-sm text-ink">
                Tiêu đề: <strong>{xemTruoc.subject}</strong>
              </p>
              <iframe
                title="Xem trước email"
                srcDoc={xemTruoc.html}
                className="mt-2 h-96 w-full rounded-xl border border-line bg-white"
              />
            </div>
          )}
        </section>

        {/* ---------- Gửi thật ---------- */}
        <section className="mt-6 rounded-2xl border-2 border-danger bg-white p-5">
          <p className="text-sm font-semibold text-ink">
            Gửi thật cho {soChon} mẹ — không thu hồi được
          </p>
          <p className="mt-1 text-sm text-ink-faded">
            Gõ đúng số <strong className="text-ink">{soChon}</strong> vào ô dưới để mở nút gửi.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              value={soXacNhan}
              onChange={(e) => setSoXacNhan(e.target.value)}
              inputMode="numeric"
              placeholder={String(soChon)}
              aria-label="Gõ số người nhận để xác nhận"
              className="w-32 rounded-xl border border-line px-4 py-3 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => void goi("that")}
              disabled={!sanSang || !khopSo}
              className="rounded-full bg-danger px-6 py-3 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dangChay === "that" ? "Đang gửi..." : `Gửi cho ${soChon} mẹ`}
            </button>
          </div>
        </section>

        {ketQua && (
          <p
            role="alert"
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              ketQua.ok
                ? "border-success bg-white text-ink"
                : "border-danger bg-white text-danger"
            }`}
          >
            {ketQua.text}
          </p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Thêm lối vào ở `/admin`**

Trong `src/components/AdminDashboard.tsx`, thêm ngay sau `<Link href="/admin/gui-mail">…</Link>`:

```tsx
            <Link
              href="/admin/gui-mail-hang-loat"
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover"
            >
              Gửi mail hàng loạt
            </Link>
```

- [ ] **Step 4: Lint + build + test**

Run: `npm run lint && npm run build && npm test`
Expected: sạch. Nếu build báo lỗi về `nodemailer` hoặc `qrcode` trong bundle client, nghĩa là component đã lỡ import `@/lib/mail-hang-loat` hoặc `@/lib/brevo` — chỉ được import `@/lib/cho-dien`.

- [ ] **Step 5: Xem mắt**

Run: `npm run dev`, mở `http://localhost:3000/admin/gui-mail-hang-loat`.
Expected: danh sách hiện đủ mẹ, không ai tick sẵn; gõ `{{name}}` vào nội dung thì hiện cảnh báo đỏ ngay và các nút tắt; lọc còn vài mẹ rồi bấm "Chọn tất cả đang hiện" thì ô đếm vẫn cộng dồn đúng tổng.

- [ ] **Step 6: Gửi thử vào hộp thư thật**

Chọn một mẹ, gõ tiêu đề + nội dung có `{{ten}}`, bấm "Gửi thử" tới email của bạn. Mở email trên **cả máy tính lẫn điện thoại**.
Expected: `{{ten}}` ra tên thật; khung email (logo, bo góc, chân trang "Bạn nhận được email này vì đã đăng ký tham dự…", chữ ký "Mama Ơi Team") **giống hệt** email xác nhận đăng ký.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/gui-mail-hang-loat/ src/components/GuiMailHangLoatTool.tsx src/components/AdminDashboard.tsx
git commit -m "feat: trang gửi mail hàng loạt — chọn mẹ, soạn, xem trước, gửi thử, gửi thật"
```

---

## Ngoài phạm vi kế hoạch này

- Waitlist app (bảng `waitlist`)
- Bảng lịch sử đã gửi trong DB
- Đính kèm file / QR riêng cho từng mẹ
- Lên lịch gửi, thống kê mở/click, link huỷ đăng ký tự động
- Lọc phân khúc theo tỉnh/thành, tình trạng, đã check-in
