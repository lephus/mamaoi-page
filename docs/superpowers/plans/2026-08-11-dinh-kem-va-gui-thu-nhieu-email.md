# Đính kèm file + gửi thử nhiều địa chỉ cho email hàng loạt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin đính kèm được hình ảnh/file vào email gửi hàng loạt (nhiều file, tổng ≤ 3MB), và gõ được nhiều địa chỉ vào ô "Gửi thử tới" thay vì đúng một.

**Architecture:** Hai file thuần mới (`dinh-kem.ts`, `nhieu-email.ts`) chứa toàn bộ phép kiểm, không import gì để **cả client lẫn server dùng chung một bộ luật**. `guiHangLoat` nhận thêm tham số tuỳ chọn và gắn `attachment` vào **cấp gốc** payload Brevo. Route đổi `toiEmail: string` thành `toiEmails: string[]` và kiểm đính kèm ở cả ba chế độ. Component nối dây.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19.2.4, TypeScript, Tailwind v4, Vitest 4, Supabase, Brevo REST API.

**Spec:** `docs/superpowers/specs/2026-08-11-dinh-kem-va-gui-thu-nhieu-email-design.md`
**Spec nền:** `docs/superpowers/specs/2026-08-05-gui-mail-hang-loat-design.md` — mọi quyết định không bị spec mới ghi đè đều còn hiệu lực.

## Global Constraints

- **`AGENTS.md`:** đây KHÔNG phải Next.js quen thuộc. Đọc guide liên quan trong `node_modules/next/dist/docs/` trước khi viết code Next mới.
- **Vitest chỉ chạy `src/**/*.test.ts`** (`vitest.config.ts`), `environment: "node"`. **Không viết test `.tsx`** — nó sẽ không bao giờ chạy, jsdom chưa cài. Mọi logic cần test phải nằm trong file `.ts` thuần.
- **`brevo.ts` KHÔNG được import vào component `"use client"`.** Nó kéo theo `nodemailer` và `qrcode` (thuần server) — import vào client là gãy build. Đây là lý do `cho-dien.ts` tồn tại tách khỏi `mail-hang-loat.ts`; hai file mới của plan này theo đúng ranh giới đó.
- **`TOI_DA_TONG_BYTE = 3 * 1024 * 1024`** — trần cứng, không đổi. Body request Vercel tối đa 4.5MB, base64 phồng 1.37 lần.
- **`.webp` và `.heic` phải bị chặn.** Brevo không nhận, mà đây là hai đuôi dễ gặp nhất.
- **Đính kèm nằm ở CẤP GỐC payload Brevo, KHÔNG trong `messageVersions`.**
- **Mỗi người nhận đúng MỘT `messageVersion` riêng**, kể cả ở chế độ gửi thử. Nhiều địa chỉ trong một trường `to` là lộ email của họ cho nhau.
- **Chuỗi hiển thị và comment bằng tiếng Việt.** Định danh dùng tiếng Việt không dấu theo phong cách repo.
- **Không bao giờ báo thành công giả.** Gửi hỏng phải trả lỗi thật kèm nguyên văn phản hồi Brevo.
- Chạy `npm test`, `npm run lint`, `npm run build` sạch trước mỗi commit. `npm run lint` có sẵn **5 warning (0 error)** ở `src/lib/validation.test.ts` — không phải của bạn, để nguyên.
- Nhánh: `feat/dinh-kem-va-gui-thu-nhieu-email` (đã tạo, spec đã commit ở `c18491c`).

## Một chỗ plan này cố ý cụ thể hoá spec

Spec §6.2 ghi hợp đồng route là `toiEmails: string[]`, nhưng không nói server kiểm bằng cách nào. Plan chốt: **server gọi lại đúng `tachEmail`** mà client đã dùng (nối mảng bằng `\n` rồi tách lại), thay vì viết phép kiểm thứ hai. Hai phép kiểm khác nhau là hai bộ luật sẽ trôi lệch — và bộ luật ở server mới là bộ quyết định.

---

### Task 1: `dinh-kem.ts` — kiểu, danh mục đuôi, phép kiểm

**Files:**
- Create: `src/lib/dinh-kem.ts`
- Test: `src/lib/dinh-kem.test.ts`

**Interfaces:**
- Consumes: — (không phụ thuộc gì, đây là điểm quan trọng nhất của file này)
- Produces:
  - `type DinhKem = { name: string; content: string }` — `content` là base64 THUẦN, đã bỏ tiền tố `data:...;base64,`
  - `DUOI_CHO_PHEP: readonly string[]`
  - `TOI_DA_TONG_BYTE: number`
  - `duoiFile(name: string): string`
  - `byteCuaBase64(content: string): number`
  - `loiDinhKem(ds: DinhKem[]): string | null` — câu lỗi tiếng Việt, `null` nghĩa là sạch
  - `coChu(byte: number): string` — "500 KB" / "1.5 MB"

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/dinh-kem.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  byteCuaBase64,
  coChu,
  duoiFile,
  loiDinhKem,
  TOI_DA_TONG_BYTE,
  type DinhKem,
} from "./dinh-kem";

/** Chuỗi base64 mã hoá đúng `n` byte, để dựng file có dung lượng biết trước. */
const base64CuaByte = (n: number) => Buffer.alloc(n, 0x61).toString("base64");

const file = (name: string, byte = 10): DinhKem => ({
  name,
  content: base64CuaByte(byte),
});

describe("duoiFile", () => {
  it("lấy đuôi, viết thường", () => {
    expect(duoiFile("poster.PNG")).toBe("png");
    expect(duoiFile("lich trinh.final.pdf")).toBe("pdf");
  });

  it("không có đuôi → chuỗi rỗng", () => {
    expect(duoiFile("README")).toBe("");
    expect(duoiFile(".gitignore")).toBe("");
  });
});

describe("byteCuaBase64", () => {
  it("tính đúng số byte thật, kể cả khi có ký tự đệm", () => {
    expect(byteCuaBase64(Buffer.from("abc").toString("base64"))).toBe(3); // không đệm
    expect(byteCuaBase64(Buffer.from("ab").toString("base64"))).toBe(2); // một dấu =
    expect(byteCuaBase64(Buffer.from("a").toString("base64"))).toBe(1); // hai dấu ==
  });

  it("chuỗi rỗng → 0", () => {
    expect(byteCuaBase64("")).toBe(0);
  });
});

describe("loiDinhKem", () => {
  it("danh sách rỗng là hợp lệ — không đính kèm gì cũng là một lựa chọn", () => {
    expect(loiDinhKem([])).toBeNull();
  });

  it("đuôi cho phép thì qua", () => {
    expect(loiDinhKem([file("poster.png"), file("lich-trinh.pdf")])).toBeNull();
  });

  it("đuôi viết HOA vẫn qua — admin không phải đổi tên file", () => {
    expect(loiDinhKem([file("POSTER.PNG")])).toBeNull();
  });

  /**
   * Hai đuôi này là cái bẫy thật: .heic là định dạng ảnh mặc định của iPhone,
   * .webp là thứ trình duyệt lưu ra khi bấm "lưu ảnh". Brevo từ chối cả hai —
   * nhưng chỉ từ chối lúc GỬI, tức là đúng lúc admin vừa bấm "Gửi cho 500 mẹ".
   */
  it("chặn .webp và .heic, nêu ĐÚNG tên file trong câu lỗi", () => {
    expect(loiDinhKem([file("poster.webp")])).toContain("poster.webp");
    expect(loiDinhKem([file("anh.heic")])).toContain("anh.heic");
  });

  it("file không có đuôi → chặn, nêu tên file", () => {
    expect(loiDinhKem([file("README")])).toContain("README");
  });

  it("file rỗng → chặn, nêu tên file", () => {
    expect(loiDinhKem([{ name: "trong.png", content: "" }])).toContain("trong.png");
  });

  it("đúng bằng trần thì qua, hơn một byte thì chặn", () => {
    expect(loiDinhKem([file("vua-du.png", TOI_DA_TONG_BYTE)])).toBeNull();
    expect(loiDinhKem([file("qua-han.png", TOI_DA_TONG_BYTE + 1)])).not.toBeNull();
  });

  it("chặn theo TỔNG, không theo từng file", () => {
    const phanLon = Math.floor(TOI_DA_TONG_BYTE * 0.6);
    expect(loiDinhKem([file("a.png", phanLon)])).toBeNull();
    expect(loiDinhKem([file("a.png", phanLon), file("b.png", phanLon)])).not.toBeNull();
  });
});

describe("coChu", () => {
  it("dưới 1MB hiện KB, từ 1MB hiện MB", () => {
    expect(coChu(500 * 1024)).toBe("500 KB");
    expect(coChu(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận THẤT BẠI**

Chạy: `npx vitest run src/lib/dinh-kem.test.ts`
Kỳ vọng: FAIL — không tìm thấy module `./dinh-kem`.

- [ ] **Step 3: Viết bản cài đặt tối thiểu**

Tạo `src/lib/dinh-kem.ts`:

```ts
/**
 * File đính kèm cho email gửi hàng loạt: kiểu dữ liệu, danh mục đuôi được phép,
 * và phép kiểm.
 *
 * File này CỐ Ý không import gì — cùng lý do đã ghi ở đầu `cho-dien.ts`:
 * `brevo.ts` kéo theo nodemailer và qrcode (thuần server), import nó vào một
 * component "use client" là gãy build. Màn hình soạn mail phải báo file sai NGAY
 * lúc admin chọn file, nên phép kiểm phải sống được ở client.
 *
 * Route gọi lại ĐÚNG hàm này. Client kiểm để phản hồi nhanh, server kiểm để
 * quyết định — nhưng cả hai đọc chung một bộ luật nên không bao giờ lệch nhau.
 */

/** Một file đính kèm. `content` là base64 THUẦN, đã bỏ tiền tố `data:...;base64,`. */
export type DinhKem = { name: string; content: string };

/**
 * Đuôi file Brevo chấp nhận, thu hẹp về tập BTC dùng thật.
 *
 * `.webp` và `.heic` CỐ Ý vắng mặt: Brevo không nhận, mà đó lại là hai đuôi dễ
 * gặp nhất — `.heic` là định dạng ảnh mặc định của iPhone, `.webp` là thứ trình
 * duyệt lưu ra khi bấm "lưu ảnh". Chặn ở đây kèm gợi ý đổi sang .png/.jpg thì
 * admin biết ngay; để lọt thì Brevo từ chối vào đúng lúc admin vừa bấm gửi thật.
 */
export const DUOI_CHO_PHEP = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "txt",
  "zip",
] as const;

/**
 * Trần cứng do nền tảng, không phải con số chọn cho đẹp: body request tới một
 * serverless function trên Vercel tối đa 4.5MB, mà base64 làm dữ liệu phồng 1.37
 * lần — 3MB file thật ≈ 4.1MB body, còn chừa chỗ cho tiêu đề, nội dung, danh
 * sách id. Vượt ngưỡng này là request bị NỀN TẢNG chặn trước khi code chạy, và
 * admin nhận về một lỗi mạng vô nghĩa thay vì câu giải thích.
 */
export const TOI_DA_TONG_BYTE = 3 * 1024 * 1024;

const GOI_Y = DUOI_CHO_PHEP.map((d) => `.${d}`).join(", ");

/** Đuôi file, viết thường, không kèm dấu chấm. Chuỗi rỗng nếu tên không có đuôi. */
export function duoiFile(name: string): string {
  const i = name.lastIndexOf(".");
  // `i < 1` gộp hai ca: không có dấu chấm nào, và tên kiểu ".gitignore" (dấu
  // chấm ở đầu là phần của tên, không phải đuôi).
  return i < 1 ? "" : name.slice(i + 1).toLowerCase();
}

/**
 * Số byte THẬT của một chuỗi base64.
 *
 * Mỗi 4 ký tự base64 mã hoá 3 byte, và mỗi dấu `=` ở cuối là một byte đệm không
 * có thật. Lấy `content.length * 0.75` mà quên trừ `=` sẽ đếm dư — không chết
 * ai, nhưng phép so với trần 3MB phải đúng thì câu lỗi mới đáng tin.
 */
export function byteCuaBase64(content: string): number {
  if (content.length === 0) return 0;
  const dem_bang = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0;
  return Math.floor(content.length / 4) * 3 - dem_bang;
}

/** Byte → chuỗi hiển thị. Dùng chung cho câu lỗi và danh sách file trên màn hình. */
export function coChu(byte: number): string {
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Kiểm cả danh sách. Trả câu lỗi tiếng Việt nêu ĐÚNG tên file sai, hoặc `null`
 * nếu sạch. Danh sách rỗng là hợp lệ — không đính kèm gì cũng là một lựa chọn.
 *
 * Trả câu lỗi ĐẦU TIÊN gặp chứ không gom hết: admin sửa từng file một, và một
 * đoạn văn liệt kê năm lỗi cùng lúc khó đọc hơn năm lần sửa từng lỗi rõ ràng.
 */
export function loiDinhKem(ds: DinhKem[]): string | null {
  let tong = 0;

  for (const f of ds) {
    const ten = f.name.trim();
    if (!ten) return "Có file thiếu tên. Chọn lại.";

    const duoi = duoiFile(ten);
    if (!duoi) {
      return `Không gửi được "${ten}": file không có đuôi. Dùng một trong: ${GOI_Y}.`;
    }
    if (!(DUOI_CHO_PHEP as readonly string[]).includes(duoi)) {
      return `Không gửi được "${ten}": đuôi .${duoi} không được hỗ trợ. Dùng một trong: ${GOI_Y}.`;
    }

    const byte = byteCuaBase64(f.content);
    if (byte <= 0) return `Không gửi được "${ten}": file rỗng.`;
    tong += byte;
  }

  if (tong > TOI_DA_TONG_BYTE) {
    return `Tổng dung lượng đính kèm ${coChu(tong)}, vượt giới hạn ${coChu(
      TOI_DA_TONG_BYTE,
    )}. Bỏ bớt file hoặc nén ảnh nhỏ lại.`;
  }

  return null;
}
```

- [ ] **Step 4: Chạy test, xác nhận ĐẠT**

Chạy: `npx vitest run src/lib/dinh-kem.test.ts`
Kỳ vọng: PASS toàn bộ.

- [ ] **Step 5: Đối chiếu `DUOI_CHO_PHEP` với tài liệu Brevo**

Spec §4.3 ghi rõ: danh sách ở Step 3 là **tập con thận trọng**, không phải bản sao đầy đủ danh sách Brevo cho phép. Mở tài liệu Brevo (mục `attachment` của `POST /v3/smtp/email`) và đối chiếu.

- Đuôi nào trong `DUOI_CHO_PHEP` mà Brevo **không** nhận → **bỏ khỏi hằng** và ghi lý do vào comment. Để lại là hẹn giờ một lỗi 502 vào đúng lúc gửi thật.
- Đuôi nào Brevo nhận mà ta chưa liệt kê → **cứ để nguyên, đừng thêm.** Tập hẹp là có chủ ý; mở rộng khi BTC thật sự cần một đuôi cụ thể.
- Xác nhận `.webp` và `.heic` vẫn nằm ngoài. Nếu hoá ra Brevo đã nhận chúng, sửa cả hằng, comment, test, và dòng hướng dẫn ở Task 5 Step 3c.

- [ ] **Step 6: Commit**

```bash
npm test && npm run lint
git add src/lib/dinh-kem.ts src/lib/dinh-kem.test.ts
git commit -m "feat: dinh-kem.ts — kiểm file đính kèm, dùng chung client và server"
```

---

### Task 2: `nhieu-email.ts` — tách chuỗi admin dán thành danh sách địa chỉ

**Files:**
- Create: `src/lib/nhieu-email.ts`
- Test: `src/lib/nhieu-email.test.ts`

**Interfaces:**
- Consumes: — (không phụ thuộc gì)
- Produces: `tachEmail(s: string): { hopLe: string[]; sai: string[] }`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/nhieu-email.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tachEmail } from "./nhieu-email";

describe("tachEmail", () => {
  it("tách được cả bốn kiểu dấu ngăn", () => {
    expect(tachEmail("a@x.vn, b@x.vn").hopLe).toEqual(["a@x.vn", "b@x.vn"]);
    expect(tachEmail("a@x.vn; b@x.vn").hopLe).toEqual(["a@x.vn", "b@x.vn"]);
    expect(tachEmail("a@x.vn\nb@x.vn").hopLe).toEqual(["a@x.vn", "b@x.vn"]);
    expect(tachEmail("a@x.vn b@x.vn").hopLe).toEqual(["a@x.vn", "b@x.vn"]);
  });

  it("chuỗi trộn nhiều kiểu dấu — admin dán từ Excel rồi gõ thêm tay", () => {
    expect(tachEmail("a@x.vn,\n  b@x.vn ;c@x.vn").hopLe).toEqual([
      "a@x.vn",
      "b@x.vn",
      "c@x.vn",
    ]);
  });

  it("giữ nguyên thứ tự admin gõ", () => {
    expect(tachEmail("z@x.vn, a@x.vn, m@x.vn").hopLe).toEqual([
      "z@x.vn",
      "a@x.vn",
      "m@x.vn",
    ]);
  });

  it("bỏ trùng, không phân biệt hoa thường — một hộp thư không nhận hai bản", () => {
    expect(tachEmail("A@x.vn, a@x.vn, a@X.VN").hopLe).toEqual(["A@x.vn"]);
  });

  it("tách riêng địa chỉ sai, giữ nguyên văn để admin dò được", () => {
    const { hopLe, sai } = tachEmail("tot@x.vn, thieu-a-cong, cung-tot@y.vn");
    expect(hopLe).toEqual(["tot@x.vn", "cung-tot@y.vn"]);
    expect(sai).toEqual(["thieu-a-cong"]);
  });

  it("bỏ trùng cả ở danh sách sai — liệt kê một chuỗi hỏng hai lần chỉ là nhiễu", () => {
    expect(tachEmail("hong, hong").sai).toEqual(["hong"]);
  });

  it("chuỗi rỗng và chuỗi toàn dấu ngăn → hai mảng rỗng", () => {
    expect(tachEmail("")).toEqual({ hopLe: [], sai: [] });
    expect(tachEmail("  ,,\n; ")).toEqual({ hopLe: [], sai: [] });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận THẤT BẠI**

Chạy: `npx vitest run src/lib/nhieu-email.test.ts`
Kỳ vọng: FAIL — không tìm thấy module `./nhieu-email`.

- [ ] **Step 3: Viết bản cài đặt tối thiểu**

Tạo `src/lib/nhieu-email.ts`:

```ts
/**
 * Tách chuỗi admin dán thành danh sách địa chỉ email.
 *
 * Không import gì, cùng ranh giới `cho-dien.ts` và `dinh-kem.ts` đang giữ: client
 * cần hàm này để bật/tắt nút "Gửi thử" ngay lúc admin gõ, server cần đúng nó để
 * quyết định. Một bộ luật, hai nơi đọc.
 */

/**
 * Cùng biểu thức route vẫn dùng cho địa chỉ đơn. Cố tình LỎNG: việc ở đây là bắt
 * lỗi gõ nhầm nhìn thấy được ("thieu-a-cong"), không phải phán một địa chỉ có
 * tồn tại hay không — chỉ máy chủ nhận mới trả lời được câu đó.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Phẩy, chấm phẩy, xuống dòng, khoảng trắng — admin dán từ Excel, Zalo, ô To của Gmail. */
const NGAN_CACH = /[\s,;]+/;

export function tachEmail(s: string): { hopLe: string[]; sai: string[] } {
  const hopLe: string[] = [];
  const sai: string[] = [];
  const daThayHopLe = new Set<string>();
  const daThaySai = new Set<string>();

  for (const tho of s.split(NGAN_CACH)) {
    const mot = tho.trim();
    if (!mot) continue;

    if (!EMAIL_RE.test(mot)) {
      // Giữ NGUYÊN VĂN thứ admin gõ để họ dò lại được trong ô nhập, đúng cách
      // `choDienLa` trả token nguyên văn.
      if (!daThaySai.has(mot)) {
        daThaySai.add(mot);
        sai.push(mot);
      }
      continue;
    }

    // Bỏ trùng không phân biệt hoa thường: "A@x.vn" và "a@x.vn" là MỘT hộp thư,
    // gửi hai bản là người ta nhận hai email giống hệt nhau.
    const khoa = mot.toLowerCase();
    if (daThayHopLe.has(khoa)) continue;
    daThayHopLe.add(khoa);
    hopLe.push(mot);
  }

  return { hopLe, sai };
}
```

- [ ] **Step 4: Chạy test, xác nhận ĐẠT**

Chạy: `npx vitest run src/lib/nhieu-email.test.ts`
Kỳ vọng: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
npm test && npm run lint
git add src/lib/nhieu-email.ts src/lib/nhieu-email.test.ts
git commit -m "feat: nhieu-email.ts — tách nhiều địa chỉ từ chuỗi admin dán"
```

---

### Task 3: `guiHangLoat` nhận đính kèm

**Files:**
- Modify: `src/lib/brevo.ts:415-470` (khối `BanGuiMot` + `guiHangLoat`)
- Test: `src/lib/brevo.test.ts` — thêm vào khối `describe("guiHangLoat")` sẵn có ở dòng 100

**Interfaces:**
- Consumes: `type DinhKem` từ Task 1
- Produces: `guiHangLoat(ban: BanGuiMot[], dinhKem?: DinhKem[]): Promise<number>` — tham số thứ hai TUỲ CHỌN, nên nơi gọi cũ không phải đổi

- [ ] **Step 1: Viết test thất bại**

Thêm bốn `it` sau vào **cuối** khối `describe("guiHangLoat", ...)` trong `src/lib/brevo.test.ts` (ngay trước dấu `});` đóng khối, dòng 193). Chúng dùng lại `ban()` và `body()` đã khai trong khối đó.

```ts
  /**
   * Câu hỏi thật của tính năng đính kèm. Brevo chỉ cho mỗi messageVersion ghi đè
   * to/cc/bcc/replyTo/subject/htmlContent/textContent/params — đính kèm PHẢI nằm
   * ở cấp gốc mới áp được cho mọi bản. Đặt nhầm chỗ thì không ai nhận được file,
   * và không có lỗi nào nổi lên để báo.
   */
  it("có đính kèm → attachment ở CẤP GỐC, không nằm trong messageVersions", async () => {
    await guiHangLoat(ban(2), [{ name: "poster.png", content: "QQ==" }]);
    const b = body(0);
    expect(b.attachment).toEqual([{ name: "poster.png", content: "QQ==" }]);
    for (const v of b.messageVersions) expect(v.attachment).toBeUndefined();
  });

  it("không có đính kèm → payload KHÔNG có khoá attachment", async () => {
    await guiHangLoat(ban(2));
    expect("attachment" in body(0)).toBe(false);
  });

  it("mảng đính kèm rỗng cũng KHÔNG sinh khoá attachment", async () => {
    await guiHangLoat(ban(2), []);
    expect("attachment" in body(0)).toBe(false);
  });

  /**
   * Chia lô là chỗ dễ quên nhất: gắn đính kèm ngoài vòng lặp thì lô thứ hai đi
   * tay không, và 500 mẹ cuối danh sách nhận email thiếu file mà không ai biết.
   */
  it("chia lô: CẢ HAI lô đều mang đính kèm, không chỉ lô đầu", async () => {
    await guiHangLoat(ban(1500), [{ name: "poster.png", content: "QQ==" }]);
    expect(body(0).attachment).toHaveLength(1);
    expect(body(1).attachment).toHaveLength(1);
  });
```

- [ ] **Step 2: Chạy test, xác nhận THẤT BẠI**

Chạy: `npx vitest run src/lib/brevo.test.ts`
Kỳ vọng: FAIL — bốn ca mới hỏng (`guiHangLoat` chưa nhận tham số thứ hai; `attachment` không có trong payload). Các ca cũ vẫn PASS.

- [ ] **Step 3: Sửa `brevo.ts`**

3a. Thêm import kiểu vào **đầu file**, cạnh các import sẵn có:

```ts
import type { DinhKem } from "./dinh-kem";
```

3b. Đổi chữ ký và thân `guiHangLoat`. Thay dòng `export async function guiHangLoat(ban: BanGuiMot[]): Promise<number> {` thành:

```ts
export async function guiHangLoat(
  ban: BanGuiMot[],
  dinhKem?: DinhKem[],
): Promise<number> {
```

3c. Trong thân vòng lặp chia lô, thêm `attachment` vào body gọi Brevo. Thay khối:

```ts
    const res = await brevo("/smtp/email", {
      sender: { name: senderName, email: senderEmail },
      // Bản gốc chỉ là chỗ dựa cho payload; mỗi messageVersion tự mang
      // subject/htmlContent riêng và đó mới là thứ tới hộp thư của mẹ.
      subject: lo[0].subject,
      htmlContent: lo[0].html,
      messageVersions: lo.map((b) => ({
```

thành:

```ts
    const res = await brevo("/smtp/email", {
      sender: { name: senderName, email: senderEmail },
      // Bản gốc chỉ là chỗ dựa cho payload; mỗi messageVersion tự mang
      // subject/htmlContent riêng và đó mới là thứ tới hộp thư của mẹ.
      subject: lo[0].subject,
      htmlContent: lo[0].html,
      // Đính kèm nằm ở CẤP GỐC, KHÔNG trong messageVersions: Brevo chỉ cho mỗi
      // bản ghi đè to/cc/bcc/replyTo/subject/htmlContent/textContent/params.
      // Đính kèm là thứ dùng CHUNG cho cả lô — cũng chính là lý do "đính kèm
      // riêng từng mẹ" nằm ngoài phạm vi cả hai spec.
      //
      // Nằm TRONG vòng lặp chia lô, không ngoài: gắn ngoài thì lô thứ hai đi tay
      // không và không có lỗi nào nổi lên.
      //
      // Spread có điều kiện chứ không gán thẳng `attachment: dinhKem`: gửi
      // `attachment: []` là gửi một mảng rỗng cho Brevo, và không tài liệu nào
      // hứa nó vô hại. Không có file thì đừng nhắc tới khoá này.
      ...(dinhKem && dinhKem.length > 0 ? { attachment: dinhKem } : {}),
      messageVersions: lo.map((b) => ({
```

- [ ] **Step 4: Chạy test, xác nhận ĐẠT**

Chạy: `npx vitest run src/lib/brevo.test.ts`
Kỳ vọng: PASS toàn bộ — cả 4 ca mới lẫn 13 ca cũ.

- [ ] **Step 5: Commit**

```bash
npm test && npm run lint && npm run build
git add src/lib/brevo.ts src/lib/brevo.test.ts
git commit -m "feat: guiHangLoat nhận đính kèm, gắn ở cấp gốc payload Brevo"
```

---

### Task 4: Route — đính kèm ở cả ba chế độ, `toiEmails` thay `toiEmail`

**Files:**
- Modify: `src/app/api/admin/gui-mail-hang-loat/route.ts`
- Test: `src/app/api/admin/gui-mail-hang-loat/route.test.ts`

**Interfaces:**
- Consumes: `loiDinhKem`, `type DinhKem` (Task 1); `tachEmail` (Task 2); `guiHangLoat(ban, dinhKem?)` (Task 3)
- Produces: hợp đồng HTTP mới —
  - mọi chế độ nhận thêm `dinhKem?: { name: string; content: string }[]`
  - chế độ `"thu"` nhận `toiEmails: string[]` **thay cho** `toiEmail: string`

- [ ] **Step 1: Viết test thất bại**

1a. Ở đầu `route.test.ts`, thêm hai hằng ngay sau khai báo `CO_BAN` (dòng 37):

```ts
/** base64 của 4 byte — file bé xíu nhưng khác rỗng, đủ qua phép kiểm dung lượng. */
const KEM = [{ name: "poster.png", content: Buffer.from("abcd").toString("base64") }];
```

1b. **Thay** hai ca gửi thử cũ (dòng 112–136, `"gửi thử: đúng 1 email..."` và `"gửi thử với email sai định dạng → 400"`) bằng khối sau:

```ts
  it("gửi thử: một địa chỉ — vẫn chạy y như trước", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "thu",
      idMau: "id-1",
      toiEmails: ["toi@digitalunicorn.tech"],
    });
    expect(res.status).toBe(200);
    expect(brevo.guiHangLoat).toHaveBeenCalledTimes(1);
    const ban = vi.mocked(brevo.guiHangLoat).mock.calls[0][0];
    expect(ban).toHaveLength(1);
    expect(ban[0].email).toBe("toi@digitalunicorn.tech");
    expect(ban[0].html).toContain("Chào chị Nguyễn Thị Lan.");
  });

  /**
   * Nhiều địa chỉ KHÔNG được gộp vào một trường `to` — làm thế là lộ email của
   * những người soát bài cho nhau. Mỗi địa chỉ một bản riêng, đúng nguyên tắc
   * guiHangLoat đã giữ cho đường gửi thật.
   */
  it("gửi thử: ba địa chỉ → ba bản, MỖI BẢN đúng MỘT địa chỉ", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "thu",
      idMau: "id-1",
      toiEmails: ["a@x.vn", "b@x.vn", "c@x.vn"],
    });
    expect(res.status).toBe(200);
    const ban = vi.mocked(brevo.guiHangLoat).mock.calls[0][0];
    expect(ban.map((b) => b.email)).toEqual(["a@x.vn", "b@x.vn", "c@x.vn"]);
    // Cả ba đều dựng từ CÙNG mẹ mẫu — email thử phải y hệt thứ mẹ đó sẽ nhận.
    for (const b of ban) expect(b.html).toContain("Chào chị Nguyễn Thị Lan.");
  });

  it("gửi thử: bỏ trùng trước khi gửi, kể cả khác hoa thường", async () => {
    await post({
      ...CO_BAN,
      che_do: "thu",
      idMau: "id-1",
      toiEmails: ["a@x.vn", "A@X.VN", "b@x.vn"],
    });
    expect(vi.mocked(brevo.guiHangLoat).mock.calls[0][0]).toHaveLength(2);
  });

  it("gửi thử: có địa chỉ sai định dạng → 400 kèm đúng địa chỉ sai, KHÔNG gửi", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "thu",
      idMau: "id-1",
      toiEmails: ["tot@x.vn", "khong-phai-email"],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("khong-phai-email");
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("gửi thử: danh sách rỗng → 400", async () => {
    const res = await post({ ...CO_BAN, che_do: "thu", idMau: "id-1", toiEmails: [] });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });
```

1c. Thêm khối đính kèm vào **cuối** `describe`, ngay trước dấu `});` đóng ở dòng cuối file:

```ts
  it("đính kèm sai đuôi → 400, KHÔNG gửi", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1"],
      xacNhanSoLuong: 1,
      dinhKem: [{ name: "poster.webp", content: Buffer.from("abcd").toString("base64") }],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("poster.webp");
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("đính kèm vượt tổng dung lượng → 400, KHÔNG gửi", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1"],
      xacNhanSoLuong: 1,
      dinhKem: [
        { name: "to.png", content: Buffer.alloc(3 * 1024 * 1024 + 1, 0x61).toString("base64") },
      ],
    });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("đính kèm hình dạng lạ (thiếu trường) → 400, KHÔNG gửi", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1"],
      xacNhanSoLuong: 1,
      dinhKem: [{ name: "poster.png" }],
    });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("gửi thử: đính kèm được truyền xuống guiHangLoat", async () => {
    await post({
      ...CO_BAN,
      che_do: "thu",
      idMau: "id-1",
      toiEmails: ["a@x.vn"],
      dinhKem: KEM,
    });
    expect(vi.mocked(brevo.guiHangLoat).mock.calls[0][1]).toEqual(KEM);
  });

  it("gửi thật: đính kèm được truyền xuống guiHangLoat", async () => {
    await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1", "id-2"],
      xacNhanSoLuong: 2,
      dinhKem: KEM,
    });
    expect(vi.mocked(brevo.guiHangLoat).mock.calls[0][1]).toEqual(KEM);
  });

  it("không đính kèm → guiHangLoat nhận mảng rỗng, không phải undefined lung tung", async () => {
    await post({ ...CO_BAN, che_do: "that", ids: ["id-1"], xacNhanSoLuong: 1 });
    expect(vi.mocked(brevo.guiHangLoat).mock.calls[0][1]).toEqual([]);
  });

  /**
   * Xem trước KHÔNG gửi gì, nhưng vẫn phải kiểm đính kèm: mục đích là để admin
   * biết file sai TRƯỚC khi bấm gửi thật, chứ không phải sau.
   */
  it("xem trước: đính kèm sai vẫn bị chặn 400 — biết trước khi bấm gửi", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "xem",
      idMau: "id-1",
      dinhKem: [{ name: "anh.heic", content: Buffer.from("abcd").toString("base64") }],
    });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("xem trước: đính kèm hợp lệ vẫn không gửi gì", async () => {
    const res = await post({ ...CO_BAN, che_do: "xem", idMau: "id-1", dinhKem: KEM });
    expect(res.status).toBe(200);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Chạy test, xác nhận THẤT BẠI**

Chạy: `npx vitest run src/app/api/admin/gui-mail-hang-loat/route.test.ts`
Kỳ vọng: FAIL — các ca gửi thử mới trả 400 (route vẫn đọc `toiEmail`), các ca đính kèm trả 200 thay vì 400.

- [ ] **Step 3: Sửa `route.ts`**

3a. Đổi khối import ở đầu file thành:

```ts
import { isAdmin } from "@/lib/admin-auth";
import { guiHangLoat, type BanGuiMot } from "@/lib/brevo";
import { choDienLa } from "@/lib/cho-dien";
import { loiDinhKem, type DinhKem } from "@/lib/dinh-kem";
import { dungEmail } from "@/lib/mail-hang-loat";
import { tachEmail } from "@/lib/nhieu-email";
import { listRegistrations, type RegistrationRow } from "@/lib/supabase";
```

3b. **Xoá** hằng `EMAIL_RE` (dòng 22). Phép kiểm địa chỉ giờ nằm trong `tachEmail` — giữ hai biểu thức ở hai nơi là mầm mống hai bộ luật trôi lệch.

3c. Thêm hàm đọc đính kèm, đặt ngay sau hàm `banGui`:

```ts
/**
 * `b.dinhKem` do client khai → mảng `DinhKem` đã kiểm KIỂU. `null` nghĩa là hình
 * dạng sai (không phải mảng, phần tử thiếu trường, trường không phải chuỗi).
 * Vắng mặt hoàn toàn là hợp lệ → mảng rỗng.
 *
 * Tách khỏi `loiDinhKem` vì hai việc khác nhau: hàm này chống payload dị dạng
 * (lỗi của lập trình viên), `loiDinhKem` chống file admin chọn nhầm (lỗi của
 * người dùng). Gộp lại thì hai loại câu lỗi sẽ lẫn vào nhau.
 */
function docDinhKem(raw: unknown): DinhKem[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;

  const ds: DinhKem[] = [];
  for (const p of raw) {
    if (typeof p !== "object" || p === null) return null;
    const { name, content } = p as Record<string, unknown>;
    if (typeof name !== "string" || typeof content !== "string") return null;
    ds.push({ name, content });
  }
  return ds;
}
```

3d. Thêm phép kiểm đính kèm **ngay sau** khối `choDienLa` (sau dòng 60) và **trước** `listRegistrations()`. Cùng lý lẽ đã ghi cho `choDienLa`: kiểm thứ rẻ và chắc chắn sai trước khi đụng tới DB.

```ts
  // Kiểm đính kèm TRƯỚC khi đọc DB, và ở CẢ BA chế độ — kể cả "xem", vốn không
  // gửi gì. Mục đích là để admin biết file sai ngay lúc xem trước, chứ không
  // phải lúc vừa bấm "Gửi cho 500 mẹ".
  const dinhKem = docDinhKem(b.dinhKem);
  if (dinhKem === null) return loi("Danh sách đính kèm không hợp lệ", 400);
  const loiKem = loiDinhKem(dinhKem);
  if (loiKem) return loi(loiKem, 400);
```

3e. Thay toàn bộ nhánh gửi thử (dòng 82–94 của bản hiện tại) bằng:

```ts
    const raw = b.toiEmails;
    if (!Array.isArray(raw) || raw.some((e) => typeof e !== "string")) {
      return loi("Danh sách địa chỉ nhận thử không hợp lệ", 400);
    }
    // Chạy LẠI đúng hàm client đã dùng thay vì viết phép kiểm thứ hai ở đây:
    // hai phép kiểm khác nhau là hai bộ luật sẽ trôi lệch, và bộ ở server mới là
    // bộ quyết định. Nối bằng xuống dòng vì đó là một trong các dấu ngăn
    // `tachEmail` nhận.
    const { hopLe, sai } = tachEmail((raw as string[]).join("\n"));
    if (sai.length > 0) {
      return loi(`Địa chỉ nhận thử không hợp lệ: ${sai.join(", ")}`, 400);
    }
    if (hopLe.length === 0) return loi("Thiếu địa chỉ nhận thử", 400);

    // Có dấu vết cho lượt gửi thử: đây là đường DUY NHẤT của route này chấp
    // nhận địa chỉ do client khai. Spec 2026-08-11 §6.3 bỏ trần số lượng theo
    // yêu cầu khách, nên số lượng phải nằm trong log — nó là thứ duy nhất còn
    // lại để truy nếu một phiên admin bị chiếm.
    console.log(
      `[admin/gui-mail-hang-loat] gửi thử tới ${hopLe.length} địa chỉ:`,
      hopLe.join(", "),
    );
    try {
      await guiHangLoat(
        hopLe.map((e) => banGui(mau, e, tieuDe, noiDung)),
        dinhKem,
      );
    } catch (err) {
      console.error("[admin/gui-mail-hang-loat] gửi thử hỏng:", err);
      return loi(err instanceof Error ? err.message : "Gửi thử thất bại", 502);
    }
    return Response.json({ ok: true, daGui: hopLe.length });
```

3f. Ở nhánh gửi thật, truyền `dinhKem` xuống. Thay:

```ts
    const daGui = await guiHangLoat(
      nhan.map((r) => banGui(r, r.email, tieuDe, noiDung)),
    );
```

thành:

```ts
    const daGui = await guiHangLoat(
      nhan.map((r) => banGui(r, r.email, tieuDe, noiDung)),
      dinhKem,
    );
```

- [ ] **Step 4: Chạy test, xác nhận ĐẠT**

Chạy: `npx vitest run src/app/api/admin/gui-mail-hang-loat/route.test.ts`
Kỳ vọng: PASS toàn bộ. Nếu ca `"gửi thật: đọc email TỪ DB, bỏ qua email client khai"` hỏng — nó gửi `emails: [...]` chứ không phải `toiEmails`, nên không bị ảnh hưởng; hỏng ở đó nghĩa là bạn đã sửa nhầm nhánh gửi thật.

- [ ] **Step 5: Commit**

```bash
npm test && npm run lint && npm run build
git add src/app/api/admin/gui-mail-hang-loat/route.ts src/app/api/admin/gui-mail-hang-loat/route.test.ts
git commit -m "feat: route nhận đính kèm ở cả ba chế độ, gửi thử nhận nhiều địa chỉ"
```

---

### Task 5: Giao diện — ô chọn file và ô nhiều địa chỉ

**Files:**
- Modify: `src/components/GuiMailHangLoatTool.tsx`

**Interfaces:**
- Consumes: `type DinhKem`, `loiDinhKem`, `byteCuaBase64`, `coChu`, `DUOI_CHO_PHEP`, `TOI_DA_TONG_BYTE` (Task 1); `tachEmail` (Task 2); hợp đồng HTTP mới (Task 4)
- Produces: — (đây là lá cuối, không task nào phụ thuộc)

**Không có test tự động cho task này.** `vitest.config.ts` chạy `environment: "node"` và chỉ nhận `src/**/*.test.ts`; jsdom chưa cài. Kiểm bằng `npm run build` + chạy tay ở Step 4.

**Hai thứ trong file này KHÔNG được đụng vào — cả hai đều là quyết định đã chốt của spec, và cả hai đều trông như thiếu sót nếu không biết lý do:**

1. **Đừng thêm `dinhKem` vào phép so `xemCu`** (spec §7). Phép so đó giữ nguyên đúng ba thứ: `tieuDe`, `noiDung`, `idMau`. Khung `<iframe>` không hiện được đính kèm, nên kéo chúng vào chỉ thêm một đường nữa để dải băng đỏ *"Bản xem trước đã CŨ"* bật lên mà không cho admin thấy thêm gì. Danh sách file đã hiện trực tiếp và luôn cập nhật rồi.
2. **Đừng thêm `dinhKem` vào bản nháp cất trong `sessionStorage`** (spec §5, khối `catch` của lượt 401). Base64 của 3MB là 4.1MB, vượt hạn mức `sessionStorage` (~5MB cho cả origin) — cố cứu file là ném cả lượt `setItem`, tức là mất luôn tiêu đề và nội dung, đánh đổi phần quan trọng hơn lấy phần dễ làm lại hơn. Dòng chữ ở Step 3c là cách xử lý cho việc này.

- [ ] **Step 1: Thêm import, state và giá trị dẫn xuất**

1a. Thêm vào khối import ở đầu file:

```ts
import {
  byteCuaBase64,
  coChu,
  DUOI_CHO_PHEP,
  loiDinhKem,
  TOI_DA_TONG_BYTE,
  type DinhKem,
} from "@/lib/dinh-kem";
import { tachEmail } from "@/lib/nhieu-email";
```

1b. Thêm hàm đọc file, đặt **ngoài** component, ngay sau hằng `KHOA_NHAP_TAM`:

```ts
/**
 * File → base64 THUẦN. `FileReader.readAsDataURL` trả về một data-URL
 * (`data:image/png;base64,iVBOR...`), phải cắt phần tiền tố đi — Brevo chỉ nhận
 * phần base64, gửi cả tiền tố là file hỏng khi mở ra.
 */
function docBase64(f: File): Promise<string> {
  return new Promise((giai, tuChoi) => {
    const doc = new FileReader();
    doc.onerror = () => tuChoi(doc.error ?? new Error("Không đọc được file"));
    doc.onload = () => {
      const s = String(doc.result);
      const i = s.indexOf(",");
      if (i < 0) tuChoi(new Error("Không đọc được file"));
      else giai(s.slice(i + 1));
    };
    doc.readAsDataURL(f);
  });
}

/** Chuỗi cho thuộc tính `accept` của ô chọn file: ".png,.jpg,..." */
const ACCEPT = DUOI_CHO_PHEP.map((d) => `.${d}`).join(",");
```

1c. Thêm state, cạnh các `useState` sẵn có:

```ts
  const [dinhKem, setDinhKem] = useState<DinhKem[]>([]);
  const [loiFile, setLoiFile] = useState("");
  // Bản nháp cứu khi 401 KHÔNG cứu được file đính kèm (xem effect bên dưới), nên
  // phải nói thẳng ra thay vì để admin tưởng file vẫn còn đó.
  const [daPhucHoiNhap, setDaPhucHoiNhap] = useState(false);
```

1d. **Đổi tên** state địa chỉ gửi thử: `toiEmail` → `nhapEmail` (giờ nó chứa cả chuỗi nhiều dòng, không còn là một địa chỉ):

```ts
  const [nhapEmail, setNhapEmail] = useState(emailMacDinh);
```

1e. Thêm giá trị dẫn xuất, cạnh `la` / `soChon` / `duNoiDung`:

```ts
  const { hopLe: emailThu, sai: emailSai } = useMemo(
    () => tachEmail(nhapEmail),
    [nhapEmail],
  );
  const tongByteKem = dinhKem.reduce((t, f) => t + byteCuaBase64(f.content), 0);
```

1f. Thêm `loiFile === ""` vào `sanSang`. Đổi dòng `const sanSang = ...` thành:

```ts
  // `loiFile` gác CẢ BA nút, không riêng nút gửi thật: một file sai đuôi làm hỏng
  // lượt gửi thật, nên không có lý do gì để nút đó còn bấm được. Cùng cách cờ
  // `la` (chỗ điền sai) đang gác.
  const sanSang =
    soChon > 0 && duNoiDung && la.length === 0 && loiFile === "" && dangChay === "";
```

1g. Trong effect phục hồi nháp, thêm `setDaPhucHoiNhap(true)` ngay sau khi đọc được `raw`:

```ts
        if (!raw) return;
        sessionStorage.removeItem(KHOA_NHAP_TAM);
        setDaPhucHoiNhap(true);
```

- [ ] **Step 2: Thêm hàm thêm/bỏ file**

Đặt cạnh hàm `bat(id)` trong component:

```ts
  async function themFile(danh: FileList | null) {
    if (!danh || danh.length === 0) return;
    setLoiFile("");

    const moi: DinhKem[] = [];
    for (const f of Array.from(danh)) {
      try {
        moi.push({ name: f.name, content: await docBase64(f) });
      } catch {
        setLoiFile(`Không đọc được file "${f.name}". Thử chọn lại.`);
        return;
      }
    }

    // Kiểm CẢ danh sách sau khi gộp, vì trần 3MB là trần TỔNG chứ không phải
    // trần từng file.
    const gop = [...dinhKem, ...moi];
    const loi = loiDinhKem(gop);
    if (loi) {
      // Có lỗi thì KHÔNG thêm gì cả. Thêm một nửa rồi báo lỗi là bắt admin ngồi
      // đoán file nào đã vào, file nào chưa.
      setLoiFile(loi);
      return;
    }
    setDinhKem(gop);
  }

  function boFile(vt: number) {
    setLoiFile("");
    setDinhKem((cu) => cu.filter((_, i) => i !== vt));
  }
```

- [ ] **Step 3: Sửa phần render và phần gọi API**

3a. Trong `goi()`, thêm `dinhKem` vào body và đổi `toiEmail` thành `toiEmails`. Thay khối `body: JSON.stringify({...})` bằng:

```ts
        body: JSON.stringify({
          che_do,
          tieuDe,
          noiDung,
          dinhKem,
          ...(che_do === "that"
            ? { ids: [...chon], xacNhanSoLuong: chon.size }
            : { idMau, ...(che_do === "thu" ? { toiEmails: emailThu } : {}) }),
        }),
```

3b. Đổi câu báo thành công của lượt gửi thử:

```ts
      } else if (che_do === "thu") {
        setKetQua({
          ok: true,
          text: `Đã gửi thử tới ${emailThu.length} địa chỉ: ${emailThu.join(", ")}`,
        });
```

3c. Thêm khối chọn file vào **cuối** `<section>` "Soạn", ngay sau khối cảnh báo `la.length > 0`:

```tsx
          <label htmlFor="dinh-kem" className="mt-4 block text-sm font-semibold text-ink">
            Đính kèm (tuỳ chọn)
          </label>
          <input
            id="dinh-kem"
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => {
              void themFile(e.target.files);
              // Xoá giá trị ô để chọn LẠI ĐÚNG file vừa bỏ ra vẫn kích hoạt
              // onChange — nếu không, trình duyệt coi là "không đổi" và im lặng.
              e.target.value = "";
            }}
            className="mt-2 block w-full text-sm text-ink file:mr-3 file:rounded-full file:border file:border-line file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-primary-faded-hover"
          />
          <p className="mt-2 text-sm text-ink-faded">
            Tối đa tổng {coChu(TOI_DA_TONG_BYTE)}. Nhận {ACCEPT.replaceAll(",", ", ")}.
            Ảnh .webp và .heic (ảnh chụp từ iPhone) không gửi được — đổi sang .png hoặc .jpg.
          </p>

          {dinhKem.length > 0 && (
            <>
              <ul className="mt-3 space-y-2">
                {dinhKem.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                    <span className="shrink-0 text-xs text-ink-faded">
                      {coChu(byteCuaBase64(f.content))}
                    </span>
                    <button
                      type="button"
                      onClick={() => boFile(i)}
                      aria-label={`Bỏ ${f.name}`}
                      className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-faded hover:bg-primary-faded-hover"
                    >
                      Bỏ
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-ink-faded">
                {dinhKem.length} file · {coChu(tongByteKem)} / {coChu(TOI_DA_TONG_BYTE)}
              </p>
            </>
          )}

          {loiFile !== "" && (
            <p role="alert" className="mt-2 text-sm font-semibold text-danger">
              {loiFile}
            </p>
          )}

          {daPhucHoiNhap && (
            <p className="mt-2 text-sm font-semibold text-ink-faded">
              Bản nháp đã được khôi phục sau khi đăng nhập lại. File đính kèm phải chọn lại.
            </p>
          )}
```

3d. **Thay** ô "Gửi thử tới" (khối `<div>` chứa `<label htmlFor="toi-email">` và `<input id="toi-email">`) bằng:

```tsx
            <div className="min-w-0 flex-1">
              <label htmlFor="toi-email" className="text-xs text-ink-faded">
                Gửi thử tới — nhiều địa chỉ cách nhau bằng dấu phẩy hoặc xuống dòng
              </label>
              <textarea
                id="toi-email"
                value={nhapEmail}
                onChange={(e) => setNhapEmail(e.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {emailSai.length > 0 ? (
                <p role="alert" className="mt-1 text-xs font-semibold text-danger">
                  Địa chỉ không hợp lệ: {emailSai.join(", ")}
                </p>
              ) : (
                emailThu.length > 0 && (
                  <p className="mt-1 text-xs text-ink-faded">
                    {emailThu.length} địa chỉ
                  </p>
                )
              )}
            </div>
```

3e. Đổi điều kiện tắt nút "Gửi thử":

```tsx
              disabled={!sanSang || emailThu.length === 0 || emailSai.length > 0}
```

- [ ] **Step 4: Kiểm bằng build và chạy tay**

Chạy: `npm run lint && npm run build`
Kỳ vọng: build exit 0, lint 0 error (5 warning có sẵn ở `validation.test.ts` — để nguyên).

Rồi `npm run dev`, mở `/admin/gui-mail-hang-loat`, xác nhận **không** gửi gì thật:

1. Chọn một file `.webp` → hiện câu lỗi nêu đúng tên file, **cả ba nút tắt**.
2. Bấm "Bỏ" file đó → lỗi biến mất, các nút bật lại (khi đã tick mẹ và gõ đủ nội dung).
3. Chọn hai file `.png` → cả hai hiện trong danh sách kèm dung lượng, dòng tổng đúng.
4. Chọn lại **đúng file vừa bỏ ra** → vẫn thêm được (đây là ca `e.target.value = ""` sinh ra để chống).
5. Gõ vào ô gửi thử `a@x.vn, hong, b@x.vn` → hiện "Địa chỉ không hợp lệ: hong", nút "Gửi thử" tắt.
6. Xoá `hong` → hiện "2 địa chỉ", nút bật lại.

- [ ] **Step 5: Commit**

```bash
npm test && npm run lint && npm run build
git add src/components/GuiMailHangLoatTool.tsx
git commit -m "feat: màn hình soạn mail hàng loạt — chọn file đính kèm, gửi thử nhiều địa chỉ"
```

---

### Task 6: Kiểm bằng tay với Brevo thật — điểm chưa từng chạy

**Files:**
- Modify: `docs/superpowers/specs/2026-08-11-dinh-kem-va-gui-thu-nhieu-email-design.md` (ghi kết quả vào §10.1)

**Interfaces:**
- Consumes: toàn bộ Task 1–5
- Produces: — (đây là cổng nghiệm thu, không phải code)

**Vì sao task này tồn tại:** payload Brevo mang `attachment` **cùng lúc với** `messageVersions` là thứ dự án chưa từng gửi thật một lần nào. Test ở Task 3 chỉ khẳng định *ta gửi payload đúng hình dạng ta định gửi* — nó không hỏi được Brevo có chấp nhận hay không. Chỉ một lượt gửi thật trả lời được.

Task này cần `.env.local` có khoá Brevo thật và một hộp thư thật. **Không tự chạy nếu bạn là agent không có hai thứ đó — báo lại cho người phụ trách.**

- [ ] **Step 1: Gửi thử một địa chỉ, có đính kèm**

Ở `/admin/gui-mail-hang-loat`: tick một mẹ, gõ tiêu đề + nội dung có `{{ten}}`, đính kèm **một ảnh .png**, gõ một địa chỉ thật, bấm "Xem trước" rồi "Gửi thử".

Kỳ vọng: báo "Đã gửi thử tới 1 địa chỉ". Nếu trả 502 kèm lỗi Brevo → **dừng lại**, chuyển sang Step 5.

- [ ] **Step 2: Mở email trên máy tính và điện thoại**

Kỳ vọng: file đính kèm tải về được, **mở ra đúng ảnh**, và **tên file không bị đổi**. Khung email vẫn giống email đăng ký (logo, bo góc, chân trang, chữ ký BTC).

- [ ] **Step 3: Câu hỏi thật — gửi thử tới HAI địa chỉ cùng lúc**

Gõ hai địa chỉ thật khác nhau, cách nhau bằng dấu phẩy. Gửi thử.

Kỳ vọng: **cả hai hộp thư đều nhận được, và cả hai đều CÓ file đính kèm.** Đây mới là câu trả lời cho "đính kèm ở cấp gốc có áp cho mọi `messageVersion` không". Kiểm thêm: mỗi email chỉ hiện **một** địa chỉ ở dòng người nhận — không ai thấy địa chỉ của người kia.

- [ ] **Step 4: Ghi kết quả vào spec**

Sửa §10.1 của spec: thay đoạn "phải kiểm bằng tay" bằng kết quả thật (ngày kiểm, Brevo chấp nhận hay không, có gì bất ngờ). Rồi:

```bash
git add docs/superpowers/specs/2026-08-11-dinh-kem-va-gui-thu-nhieu-email-design.md
git commit -m "docs: ghi kết quả kiểm đính kèm + messageVersions với Brevo thật"
```

- [ ] **Step 5: CHỈ KHI Step 1 hoặc Step 3 thất bại — phương án dự phòng**

Nếu Brevo từ chối `attachment` đi cùng `messageVersions`, **đừng chữa vá**. Ghi nguyên văn lỗi Brevo vào spec §10.1, rồi dừng lại và báo người phụ trách: phương án dự phòng (Supabase Storage + `attachment: [{ url, name }]`) cần tạo bucket bằng tay và cần một luồng dọn file cũ — đó là phạm vi mới, cần duyệt lại chứ không phải sửa tiếp trong plan này.

---

## Sau khi xong

Nhánh `feat/dinh-kem-va-gui-thu-nhieu-email` tách từ `main` tại `a15162f`, **trước** commit `dabbe2c` (ẩn hai nút `+ Thêm đăng ký` và `Gửi lại email QR`). Merge về `main` sẽ mang theo cả hai — không xung đột, vì hai thay đổi ở hai file khác nhau.
