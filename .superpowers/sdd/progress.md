# SDD Progress — 2026-07-20-form-dang-ky-v2

Branch: feat/form-dang-ky-v2
Base: 19955c8 (merge-base với main)
Plan: docs/superpowers/plans/2026-07-20-form-dang-ky-v2.md
Spec: docs/superpowers/specs/2026-07-20-form-dang-ky-v2-design.md

STATUS: đang chạy.

## Tasks
- [ ] Task 1 — hằng số chủ đề/nguồn + `thangTuoiTuNgaySinh`
- [ ] Task 2 — schema v2 discriminated union
- [ ] Task 3 — Supabase type + migration SQL + waitlist
- [ ] Task 4 — export 21 cột + `ngayVN` vào time.ts + waitlistToSheet
- [ ] Task 5 — Sheets mirror theo cột mới
- [ ] Task 6 — Brevo attribute mới
- [ ] Task 7 — route ghi waitlist vào Supabase
- [ ] Task 8 — form v2 (5 nhóm có tiêu đề)
- [ ] Task 9 — API admin waitlist + export theo loại
- [ ] Task 10 — admin hai tab
- [ ] Task 11 — kiểm thử tay đầu-cuối

## Pre-flight (2026-07-20)
- Ledger CŨ (google-sheets-mirror) đã hoàn tất và merge vào main ở PR #1.
  Nội dung cũ được thay bằng file này; guard rail còn hiệu lực chép xuống dưới.
- Vá plan trước khi chạy: Task 4 thêm `ngayVN` vào time.ts nhưng thiếu test
  trực tiếp → đã bổ sung 5 test vào Task 4 Step 3.

## Guard rail kế thừa — KHÔNG được vi phạm
- `VALUE_INPUT_OPTION` phải giữ `"RAW"`. Có test khoá. USER_ENTERED sẽ chạy
  công thức từ ô nhập tự do VÀ rụng số 0 đầu SĐT. Đừng đụng.
- RLS Supabase đang TẮT theo lựa chọn của user. Không bao giờ để key Supabase
  lọt ra client (không `NEXT_PUBLIC_SUPABASE_*`).
- ADMIN_PASSWORD nằm clear-text trong vài file .md đã push. User đã biết và
  chấp nhận ("lộ k sao, kệ"). KHÔNG nhắc lại, KHÔNG tự sửa.
- Bất biến của route đăng ký: Brevo lỗi → 502 thật. Mọi thứ SAU Brevo lỗi →
  chỉ log + warnings, không bao giờ làm hỏng request của mẹ.
- Lớp chống ghi-đè của poll trong AdminDashboard (writeGenRef / fetchSeqRef /
  appliedSeqRef) đã qua hai vòng sửa lỗi. Task 10 CHUYỂN NGUYÊN KHỐI, không
  tinh chỉnh, giữ cả chú thích dài.

## ✅ VIỆC TAY — ĐÃ XONG HẾT 3/3 (2026-07-20, Claude chạy, user cho phép từng bước)
1. ✅ Migration Supabase — chạy qua Management API. Trước khi chạy: `registrations` 0 dòng,
   schema cũ 16 cột, KHÔNG có bảng `waitlist`. Sau: 7 cột mới + bảng waitlist + 3 constraint.
   Verify bằng ghi thử cả hai nhánh; `thai_tuan=99` bị constraint CHẶN (23514) → constraint sống thật.
2. ✅ 6 attribute Brevo (THAI_TUAN float, TEN_BE text, BE_NGAY_SINH date, BE_GIOI_TINH text,
   CHU_DE_QUAN_TAM text, NGUON_BIET_DEN text) — HTTP 201 cả 6. Smoke test upsert cả hai nhánh → 201.
3. ✅ Google Sheet — header cũ thật ra là **12 cột** (còn cũ hơn cả 21 cột plan tưởng), 0 dòng
   dữ liệu. Đã clear. Code đã tự ghi lại banner + header 22 cột đúng, verify tận mắt.

## ✅ TASK 11 (kiểm thử tay đầu-cuối) — ĐÃ CHẠY, ĐẠT
Qua `POST /api/dang-ky` trên dev server thật, cả 3 luồng trả `warnings: []`
(nghĩa là Brevo + Supabase + Sheets đều thành công, không nhánh nào rơi vào lỗi):
- da_sinh (có chuDeKhac) → MO-LV2FNJ · mang_thai → MO-QMNTP8 · waitlist → ok
Dữ liệu đáp đúng cả 3 đích, không rò field giữa hai nhánh (da_sinh: thai_tuan null;
mang_thai: ten_be/be_ngay_sinh/be_gioi_tinh/be_thang_tuoi/chu_de_khac đều null).
Sheet ghi đúng 22 cột, "Chủ đề khác" đúng vị trí 13 ngay sau "Chủ đề quan tâm".
R1 chứng minh sống: body rỗng → 8 lỗi tiếng Việt TRONG MỘT LẦN, không còn chuỗi Zod tiếng Anh.
Toàn bộ dữ liệu test đã xoá khỏi cả 3 đích (Supabase 0/0, Brevo 204×3, Sheet cleared).

## Việc tay (bản gốc, giữ lại để tham chiếu) — ĐÃ THỰC HIỆN, xem mục trên
1. Chạy `supabase/2026-07-20-form-v2.sql` trong Supabase SQL editor.
   **Dùng bản MỚI NHẤT** (đã có `chu_de_khac` từ R3). Chạy bản cũ = thiếu cột =
   mọi lượt ghi rơi vào `warnings: ["supabase"]` mà mẹ vẫn thấy đăng ký thành công.
2. Tạo 6 attribute Brevo: THAI_TUAN, TEN_BE, BE_NGAY_SINH, BE_GIOI_TINH,
   CHU_DE_QUAN_TAM, NGUON_BIET_DEN. Thiếu → upsertContact ném lỗi → đăng ký 502.
   **KHÔNG cần CHU_DE_KHAC** — cố ý không gửi lên Brevo (quyết định 3 của plan remediation).
3. **Google Sheet: XOÁ TRẮNG sheet (hoặc chèn 1 cột trống trước "Nguồn biết đến").**
   Bản mới ghi **22 cột**. `sheets.ts` CHỈ ghi header khi ô A1 trống — Sheet đã có
   dữ liệu sẽ giữ nguyên header 21 cột cũ, và từ lượt đăng ký đầu tiên sau deploy,
   mọi giá trị từ "Nguồn biết đến" trở đi lệch TRÁI một cột, gồm cả 3 cột check-in.
   Không có test nào bắt được cái này — nó nằm ngoài code. Reviewer R3 phát hiện.

## Bối cảnh không suy ra được từ code
- Mở đăng ký 25/07/2026, hôm nay 20/07 — còn 5 ngày.
- User xác nhận Supabase CHƯA có đăng ký thật, chỉ dữ liệu test → migration
  được phép drop/add cột. Nếu phát hiện có dữ liệu thật thì DỪNG, báo user.
- Task 6/8/10 không có test tự động (repo chưa có hạ tầng test component, và
  brevo cần mock HTTP). Reviewer có thể nêu — cứ để nêu rồi phân xử, đừng
  dặn reviewer bỏ qua.

## Tiến độ
- Task 1: complete (commit c634bc5..45b89e4, review clean — spec ✅, quality Approved)
      LỆCH KHỎI PLAN, đã duyệt: plan viết `new Map(CHU_DE_QUAN_TAM.map(...))` không
      có type param → hỏng `tsc --noEmit` dưới strict (TS suy key thành union literal
      nên `.get(value: string)` không hợp lệ). Sửa thành `new Map<string, string>(...)`.
      Reviewer đã tự revert để tái hiện lỗi, xác nhận sửa là tối thiểu và đúng.
      BÀI HỌC CHO TASK SAU: code trong plan CHƯA qua tsc. Task 2 có
      `z.enum(CHU_DE_VALUES as [string, ...string[]])` — nghi ngờ tương tự, phải chạy
      `npx tsc --noEmit` chứ đừng chỉ tin `npm test` (vitest dùng esbuild, KHÔNG check type).

- Task 2: complete (commits 45b89e4..d5c53ad, review clean sau 1 vòng fix)
      CRITICAL đã sửa: `validation.ts:66` giữ nguyên message cũ "Vui lòng chọn tỉnh/thành"
      thay vì "Vui lòng chọn thành phố" theo brief. Lọt qua cả 23 test vì mọi test chỉ
      assert `.success` boolean, không assert nội dung message. Tự-review của implementer
      còn khẳng định SAI rằng "khớp 100% nguyên văn".
      Fix: sửa chuỗi + thêm test assert nguyên văn (d5c53ad). Reviewer vòng 2 đã soát
      lại TOÀN BỘ 16 chuỗi lỗi bằng script + runtime check → không còn chuỗi nào lệch.
      BÀI HỌC: tự-review của implementer không đáng tin bằng diff nguyên văn với brief.
      Reviewer nên diff programmatic, không đọc mắt thường.

- Task 3: complete (commit d5c53ad..b6f3136, review clean — spec ✅, quality Approved)
      Reviewer diff programmatic cả 3 khối implementer tự khai "chỉ nhìn mắt" → không lệch byte nào.
      Mutation test xác nhận: thêm `checked_in` vào registrationToRow bị tsc CHẶN ở compile-time
      (nhờ annotation `Omit<...>` implementer tự thêm) — bất biến "không rò cột check-in" được ép
      bởi compiler chứ không chỉ bởi test. Đây là cải thiện so với code plan, đã duyệt.

## ĐÃ QUYẾT (2026-07-20) — CHECK constraint `chu_de_quan_tam`
- **KHÔNG thêm constraint.** User cho biết danh sách 9 chủ đề CHƯA được khách chốt. Ràng buộc
  DB phải sửa lockstep với `constants.ts` sẽ biến một danh sách còn động thành chi phí mỗi
  lần đổi, và quên một bên là đăng ký chết. Zod chặn ở đường ghi duy nhất hiện có.
  → Ghi lý do thành comment trong file SQL (task R3) để lần sau không ai "sửa giúp".
- Comment dòng 3 file SQL nói sai ("An toàn để drop cột" nhưng không có `drop column` nào) —
  sửa trong R3 Step 6.
- HỆ QUẢ của "danh sách chưa chốt": user chọn thêm ô free text `chuDeKhac` để 500 mẹ đầu
  tiên chính là cách phát hiện danh sách thật. Cột RIÊNG, không trộn vào mảng. Xem plan R3/R4.

- Task 4: complete (commit b6f3136..8671e19, review clean — spec ✅, quality Approved)
      21 nhãn cột diff programmatic → khớp byte-for-byte. `ngayVN` kiểm dưới TZ=America/New_York,
      mutation sang bản dùng `new Date()` → test bẫy múi giờ đỏ đúng như thiết kế.
      TRẠNG THÁI ĐỎ TẠM THỜI: 7 test `sheets.test.ts` đỏ sau task này (sheets.ts còn dựng row
      schema cũ, thiếu `chu_de_quan_tam` mà rowsToSheet mới `.map()` lên). Task 5 dọn.
      Reviewer đã checkout commit cha trong worktree để xác nhận baseline 8/8 xanh → nguyên
      nhân đúng như khai, không phải Task 4 làm hỏng.

## Minor findings tồn đọng
- [Task 4, từ PLAN của tôi] **Lưới test không bắt được lệch cột.** Reviewer mutation-test:
  đổi chỗ nhãn "Thành phố"/"Tình trạng" trong HEADERS mà giữ nguyên thứ tự giá trị →
  toàn bộ 14 test VẪN XANH. Khoảng nửa số cột chỉ được assert bằng `.toContain()` (không
  quan tâm vị trí) thay vì `rows[0][headers.indexOf(label)]`. Với file export 21 cột mà ops
  đọc trực tiếp, một lần đổi thứ tự cột sẽ gán nhãn sai dữ liệu mà không test nào kêu.
  → Final review phân loại: có nên siết test trước merge không.
- [Task 4, từ PLAN của tôi] `waitlistToSheet` xuất xưởng với ZERO test. Task 9 phụ thuộc nó.
- [Task 2] `chuDeQuanTam`/`nguonBietDen` suy ra kiểu TS là `string[]`/`string` chứ không
  phải union literal, vì `CHU_DE_VALUES`/`NGUON_VALUES` khai `readonly string[]` chứ không
  phải tuple `as const`. Runtime validation VẪN ĐÚNG (có test phủ). Chưa consumer nào dựa
  vào kiểu tĩnh này. Nợ kỹ thuật chấp nhận được — final review quyết có sửa trước merge không.
- [Task 2] Không có test đối xứng "da_sinh leak thaiTuan" (chỉ có chiều mang_thai leak tenBe).
  Khoảng trống coverage nhỏ, brief không yêu cầu.
- [Task 2] 3 eslint warning `no-unused-vars` từ pattern `const { x, ...thieu } = obj` trong
  test — code brief tự viết vậy, không fail build.
- [Task 1, plan-mandated] `validation.test.ts:88` import nằm GIỮA file thay vì đầu file
  (plan tự viết vậy; lint không bắt vì `import/first` tắt). Task 2 cũng append test vào
  file này → đã dặn implementer Task 2 gộp import lên đầu file để không tích tụ.
- [Task 1, plan-mandated] Comment `constants.ts:211` "Nguồn biết đến chương trình — chọn một."
  là kiểu mô tả CÁI GÌ chứ không phải TẠI SAO. Chép nguyên từ plan. Vô hại, ghi nhận.

## Tiến độ (tiếp)
- Task 5: complete (commit 8671e19..06644ac, review clean — spec ✅, quality Approved, 0 finding)
      Suite xanh lại 69/69 sau trạng thái đỏ tạm của Task 4.
      Mutation test xác nhận 3 bất biến: VALUE_INPUT_OPTION=RAW, và cả ba cột check-in
      luôn rỗng (đổi bất kỳ cột nào → test đỏ ngay).
      grep xác nhận sheets.ts KHÔNG nhân bản logic nhánh mang_thai/da_sinh — dùng lại
      registrationToRow của supabase.ts đúng như thiết kế.
- Task 6: complete (commit 06644ac..8ea3474, review clean — spec ✅, quality Approved)
      tsc SẠCH TOÀN DỰ ÁN từ đây (2 lỗi beThangTuoi cuối cùng ở brevo.ts đã dọn).
      Task này KHÔNG có test tự động. Reviewer bù bằng cách viết test tạm monkey-patch
      globalThis.fetch, gọi thật upsertContact, in payload cho cả hai nhánh:
        mang_thai → có THAI_TUAN:20, KHÔNG có TEN_BE/BE_NGAY_SINH/BE_GIOI_TINH/BE_THANG_TUOI
        da_sinh   → có TEN_BE/BE_NGAY_SINH:"2026-01-25"/BE_GIOI_TINH/BE_THANG_TUOI:5, KHÔNG có THAI_TUAN
      Bất biến updateEnabled:true được giữ. Đáng chú ý: leak giữa hai nhánh là BẤT KHẢ THI
      ở mức type — field nhánh này không tồn tại trên union-type nhánh kia, TS chặn cứng.
      Minor: báo cáo implementer biện minh gộp import bằng "import/no-duplicates sẽ bắt" —
      reviewer verify rule đó KHÔNG bật trong config repo. Thay đổi vẫn đúng, lý do sai.
- Task 7: complete (commit 8ea3474..b704a70, review clean — spec ✅, quality Approved)
      Reviewer TỰ viết test tạm độc lập (không tin lời khai): mock cả insertWaitlist lẫn
      insertRegistration ném lỗi, gọi thẳng POST() → cả hai nhánh trả 200 ok:true
      warnings:["supabase"]. Bất biến "không gì sau Brevo được làm hỏng request" đứng vững.
      Khối Sheets + khối Brevo diff với commit cha → identical, không bị đụng.
      MINOR: nhánh `else` dùng phủ định `!isRegistration(data)` chứ không phải kiểm dương
      `isWaitlist(data)`. Đúng 100% với 2 loại hiện có. Nhưng nếu thêm loại `nguon` thứ ba
      mà tình cờ có field email/dongYNhanTin, code VẪN compile sạch và âm thầm ghi nhầm vào
      bảng waitlist — không lỗi compile lẫn runtime. Lần thêm nguồn thứ ba nên dùng
      exhaustive switch + assertNever.

- Task 8: implement xong (commit b704a70..e6074df), review 2 vòng: **spec ✅ / quality
      Approved with comments (3 MAJOR)**. KHÔNG coi là đóng — 3 MAJOR chuyển thành task
      R1/R2/R5 trong plan remediation, xem `docs/superpowers/plans/2026-07-20-form-v2-remediation.md`.

      Spec reviewer diff programmatic 8 khối code: 7 khớp byte-for-byte, khối thứ 8 là
      placeholder của brief nên diff riêng vùng đó với commit cha → ĐÚNG 2 thay đổi, cả hai
      chủ ý (nhãn "Thành phố"). Lỗi kiểu Task 2 KHÔNG tái diễn. Reviewer còn tự dựng FormData
      thật → safeParse, và cố tình nhét field nhánh kia vào → payload vẫn lọc sạch.

      MAJOR 1 — `discriminatedUnion` short-circuit: `trangThai` null → Zod trả chuỗi TIẾNG ANH
      "Invalid discriminator value..." thẳng ra cho mẹ, VÀ nuốt toàn bộ lỗi field chung nên
      mẹ phải submit 2 lần mới thấy hết. Lỗi thuộc schema Task 2 nhưng Task 8 làm nặng hơn
      (6 → 9 field bắt buộc sau discriminator). → R1.

      MAJOR 2 — `Nhom` (`<fieldset>/<legend>`) áp cho 2 nhóm THỊ GIÁC, trong khi 4 nhóm
      control thật vẫn dùng `Field` với `htmlFor` trỏ vào MỘT option → screen reader chỉ đọc
      tên nhóm ở option đầu. 3/4 chỗ là mới trong commit này. → R5.

      MAJOR 3 — **mutation test: đảo `...(daSinh` thành `...(!daSinh` → tsc exit 0, 76/76 test
      XANH.** Đảo ngược toàn bộ phân khúc mà không gì bắt được. Nguyên nhân cấu trúc, không
      chỉ là "thiếu test component": payload là object literal rời trong component, vitest
      chỉ include `src/**/*.test.ts` và mọi test đều ở `src/lib`. → R2 rút hàm ra `src/lib/`.

      BÀI HỌC: Task 6 và 7 đều được ghi là "compiler chặn cứng rò nhánh". Điều đó ĐÚNG ở tầng
      server và khiến tôi tưởng bất biến đã được phủ kín — nhưng tầng client, nơi dữ liệu KHỞI
      SINH, không có gì cả. Lần sau kiểm bất biến phải truy ngược tới điểm khởi sinh dữ liệu,
      đừng dừng ở nơi nó đi qua.

      MINOR đáng chú ý (vào R5/R6): 6 chỗ hardcode `accent-[#f08f8c]` (vi phạm trực tiếp
      CLAUDE.md "không chế màu"); `max={new Date().toISOString()...}` là UTC nên từ 00:00-07:00
      giờ VN chặn mất bé sinh hôm nay; field bé mất trắng + lỗi đỏ đọng lại khi toggle nhánh.

      Reviewer verify vùng chạm một tay ~46-50px (đạt >44px) và cả 3 comment mới đều giải
      thích TẠI SAO. Không regression v1.

## Remediation R1–R6 (plan: docs/superpowers/plans/2026-07-20-form-v2-remediation.md)
- Task R1: complete (commits e6074df..1aff5c5, review clean sau 1 vòng fix)
      Implementer báo DONE_WITH_CONCERNS: test Step 6 của brief KHÔNG THỂ xanh nếu không sửa
      thêm 4 field ngoài phạm vi brief. Reviewer tự probe Zod độc lập → xác nhận đúng: trong
      Zod 4.4.3, message gắn trên `.min()`/`.regex()` KHÔNG BAO GIỜ chạy khi key vắng mặt hẳn
      (base type check đỏ trước), nên `hoTen` thiếu → "Invalid input: expected string, received
      undefined" ra thẳng mặt mẹ. Phải gắn `{ error }` vào CONSTRUCTOR. Mở rộng phạm vi chính
      đáng, không phải overbuilding.
      Reviewer bắt thêm (Important): cùng lỗi đó vẫn sống ở `thaiTuan`/`tenBe`, KHÔNG bị union
      short-circuit che (trangThai hợp lệ, chỉ tenBe trống — ca điền form bình thường). Đã fix
      ở 1aff5c5, dùng lại chuỗi có sẵn của chính field đó, không bịa chuỗi mới.
      Re-review probe cả đường vi phạm giá trị: `{ error }` ở constructor CHỈ bắn ở bước type
      check, `.int()`/`.max()` vẫn giữ message riêng. Không nuốt message cụ thể.
      BÀI HỌC (áp cho mọi field Zod trong repo): message trên refinement chỉ phủ ca "sai giá
      trị", KHÔNG phủ ca "thiếu field". Hai ca đó cần hai chỗ khai báo khác nhau.
      Minor tồn đọng: report của implementer tự cộng sai số test (viết "8 test mới: 2+2"), số
      tổng thì đúng. Nhắc final review soát cách implementer tự kiểm.

- Task R2: complete (commit 1aff5c5..46b4de4, review clean — spec ✅, quality Approved, 0 Critical/Important)
      Mutation test ĐÃ ĐÓNG: đảo `...(daSinh` → `...(!daSinh` giờ làm 4/6 test ĐỎ. Trước R2
      cùng đột biến đó đi lọt với 76/76 xanh.
      LỖI TRONG PLAN CỦA TÔI (implementer tự phát hiện): Step 6 bảo hoàn nguyên bằng
      `git checkout src/lib/registration-payload.ts`, nhưng lúc đó file còn UNTRACKED nên
      git không có bản nào để khôi phục. Implementer tự hoàn nguyên tay rồi diff byte-for-byte
      với brief để chứng minh sạch. Reviewer xác nhận commit chứa nhánh ĐÚNG, không sót đột biến.
      Reviewer diff programmatic từng key/`String()`/`?? ""` giữa literal cũ và hàm mới → khớp
      hoàn toàn. Chỉ một comment đổi chữ (không phải copy hiển thị).
      Minor tồn đọng: `buildRegistrationPayload` trả `Record<string, unknown>` nên mất kiểu
      suy ra của từng key — R4 sẽ thêm field vào chính hàm này, cần lưu ý.
      Minor tồn đọng: lint warning trong `validation.test.ts` tăng 3 → 5 (2 cái mới từ commit
      fix của R1, cùng pattern `const { x, ...thieu }` đã ghi nhận từ Task 2). Không fail build.
      Final review quyết có dọn trước merge không.

- Task R3: complete (commit 46b4de4..3e7483e, review clean — spec ✅, quality Approved)
      Reviewer (opus) tự kiểm CẢ 22 cặp header/giá trị THEO VỊ TRÍ, không tin suite xanh —
      vì ledger đã ghi lưới test cũ không bắt được lệch cột. `"Chủ đề khác"` ở index 12 ở cả
      HEADERS lẫn mảng giá trị. Test mới `rows[0][headers.indexOf(...)]` thật sự ghim vị trí.
      Hai xác nhận cho thiết kế: `tsc` ĐÃ chặn fixture thiếu `chu_de_khac` (type siết đúng),
      và `sheets.test.ts` tự xanh không cần đụng `sheets.ts` (nó thật sự dùng chung cột từ
      export-rows chứ không nhân bản logic).
      `toHaveLength(21)`→`22`: reviewer verify đó chỉ là đếm header, và assert
      `rows[0]).toHaveLength(headers.length)` vẫn nguyên nên không che được lệch cột.
      SQL: không có CHECK constraint trên chu_de_quan_tam; grep `drop column|drop table|
      delete|truncate` → 0 hit; comment dòng 3 giờ nói đúng sự thật.
      → PHÁT HIỆN VẬN HÀNH quan trọng, đã đưa vào mục "Việc tay" ở trên (Sheet lệch cột).
      Minor tồn đọng: `src/lib/sheets.ts:41` còn comment "lấy đúng 21 ô" — giờ là 22. Không
      task nào hiện được phép sửa file đó; để final review dọn.
      Minor tồn đọng: comment lý-do-không-constraint trong file SQL đặt sát khối
      `nguon_biet_den` nên đọc thoáng dễ tưởng nó nói về field đó. Plan của tôi chỉ định vị
      trí này. Thêm dòng trống là xong.

- Task R4: complete (commit 3e7483e..fe07ebd, review clean — spec ✅, quality Approved, 0 finding)
      Reviewer byte-compare 3 chuỗi tiếng Việt MỚI bằng md5/diff với brief → khớp. Quan trọng
      vì đây là chuỗi chưa qua khách: phải biết chắc chuỗi nào đang chạy khi khách duyệt sau.
      Truy tên key `chuDeKhac` xuyên 4 tầng (payload → form name → Zod → supabase) → khớp hết.
      Đáng lưu: `buildRegistrationPayload` trả `Record<string, unknown>` nên tsc KHÔNG bắt được
      key gõ sai ở đây; chỉ test bắt. Test mới assert nội dung nên có bắt.
      `maxLength={200}` client khớp `.max(200)` của Zod.

- Task R5: complete (commits fe07ebd..349999c, review clean sau 1 vòng fix — spec ✅, quality Approved)
      4 nhóm control giờ dùng `<fieldset>/<legend>` (NhomChon) + hàng lựa chọn dùng chung
      (HangChon). Hết 6 chỗ hardcode `accent-[#f08f8c]`; một cơ chế trạng thái chọn duy nhất.
      Reviewer (opus) kiểm BẢO TOÀN HÀNH VI từng điểm vì repo KHÔNG có test component nào —
      đọc code LÀ lưới an toàn duy nhất: `name` còn đủ ở 3 radio group, chủ đề vẫn KHÔNG có
      `name`, controlled/uncontrolled giữ đúng bản chất từng nhóm, `setTrangThai` vẫn lái
      khối điều kiện, selector cuộn-tới-lỗi vẫn khớp. 4 chuỗi legend byte-identical.
      ĐÁNG HỌC: chỗ refactor này có thể âm thầm hỏng là `hover:` vs `has-checked:` — cùng
      specificity (0,2,0), source order quyết định. Reviewer so BYTE OFFSET trong CSS đã build
      (hover 60759 < has-checked 65095) → hàng đang chọn không mất màu khi hover. Không đoán.
      Important (plan-mandated, USER CHỌN SỬA): props `HangChon` do plan tôi viết cho phép 3
      bug âm thầm lọt tsc — radio thiếu `name`, `checked` không kèm `onChange`, checkbox có
      `name`. Đã siết bằng discriminated union (349999c). Fixer CHỨNG MINH bằng cách tự tạo
      cả 3 bug → cả 3 ra TS2322 thật, rồi hoàn nguyên. Re-review xác nhận type-only, không
      sót thí nghiệm, và union không siết quá tay (cả 4 call site vẫn hợp lệ).
      CÒN NỢ: **kiểm thị giác trên trình duyệt chưa làm** — user nhận tự mở xem.
      Minor tồn đọng: `aria-invalid` trên `<fieldset>` (role=group) không được ARIA hỗ trợ nên
      screen reader không đọc; nó chỉ còn tác dụng làm mốc cuộn. Muốn thật thì 3 radio group
      cần `role="radiogroup"`. Không phải regression — code cũ không có ngữ nghĩa nhóm nào cả.
      Minor tồn đọng: `.accent-\[\#f08f8c\]` vẫn còn trong CSS build vì Tailwind quét trúng
      chuỗi đó trong file .md của docs/. ~40 byte CSS chết. Sửa bằng `@source not "docs/";`
      trong globals.css — cũng chặn luôn mọi chuỗi hình-dạng-class khác trong plan docs.

- Task R6: complete (commit 349999c..7f2e2d0, review clean — spec ✅, quality Approved)
      `homNayVN()` dùng lại `VN_OFFSET_MS`. Reviewer tự tính 3 mốc biên: 23:30Z → 21/07,
      17:00Z (đúng nửa đêm VN) → 21/07, 16:59Z → 20/07. Đúng cả ba.
      Mutation verify độc lập: body UTT trần cho "2026-07-20" trong khi test đòi "2026-07-21"
      → test THẬT SỰ ghim đúng con bug, không phải chỉ ghim định dạng chuỗi.
      `afterEach(vi.useRealTimers)` nằm trong describe riêng, không rò fake timer sang suite khác.
      → CÒN MỞ (plan-mandated, CHỜ USER QUYẾT): `setErrors({})` xoá lỗi của MỌI field chứ không
      chỉ field của nhánh. Mẹ đang có lỗi email/SĐT thật mà đổi nhánh sẽ thấy dấu đỏ biến mất
      dù nội dung vẫn sai. Không mất vĩnh viễn (submit sau dựng lại), nhưng là bước lùi tạm thời.
      Sửa hẹp hơn = chỉ xoá key của nhánh: trangThai, thaiTuan, tenBe, beNgaySinh, beGioiTinh.

## Final review toàn nhánh (19955c8..7f2e2d0, opus) + đợt fix 4fad0b2..12ddb87
STATUS: R1–R6 xong, 7 finding của final review đã sửa hết. 99/99 test, tsc sạch, build OK.

Reviewer mutation-test bất biến trung tâm ở CẢ 4 tầng, 2 tầng do compiler ép:
  client payload (5 test đỏ) · Zod union (cắt cả hai chiều) · supabase.ts (TS2339 + 16 đỏ)
  · brevo.ts (TS2339 — compiler là lưới DUY NHẤT ở đây) · sheets.ts không nhân bản logic.
Lưới export đo được: hoán đổi 22 cột → 18/21 bị bắt. 3 lỗ còn lại đã vá ở b4aecd5.

BA LỖI TRONG PLAN CỦA TÔI mà 6 vòng review task KHÔNG bắt được (bài học cho lần sau):
1. R6 vá đồng hồ CLIENT (`max` của input) nhưng bỏ quên đồng hồ SERVER (`.refine` trong Zod
   vẫn `new Date()` UTC). 00:00–07:00 giờ VN: picker cho chọn hôm nay, server từ chối → mẹ
   thấy lỗi đỏ KHÔNG THỂ sửa. Tệ hơn trước khi có R6. → Sửa cả hai đầu, đừng sửa một đầu.
2. R1 rút ra bài học đúng ("message trên refinement không phủ ca thiếu field") nhưng chỉ quét
   các field mà test đang đỏ. `facebook` lọt → link kèm fbclid vượt 200 ký tự trả tiếng Anh.
   → Rút ra bài học rồi thì phải QUÉT TOÀN BỘ, không chỉ chỗ test đang chỉ.
3. Mỗi task review chỉ nhìn diff của chính nó. Lỗi kiểu "task A sửa nửa vấn đề, nửa kia nằm
   ở file task B không đụng tới" chỉ lộ ra ở review toàn nhánh. Đừng bỏ bước đó.

- reCAPTCHA: **ĐÃ GỠ HẲN** (4fad0b2) theo khuyến nghị final review. Lý do: form chưa bao giờ
  gửi token, `.env.example` lại ship sẵn 2 key rỗng — ai điền vào lúc dựng Vercel là mọi đăng
  ký 400. Honeypot (`website`) vẫn là cơ chế chống bot đang thật sự hoạt động. CLAUDE.md đã
  cập nhật. Nếu sau này muốn reCAPTCHA thật thì phải nối cả phía client, không chỉ bật env.

## Task 9 & 10 — XONG (2026-07-20)
- Task 9: complete (commits 12ddb87..92c9802, review clean — spec ✅, Approved)
      `GET /api/admin/waitlist` + export tách theo `loai`. Reviewer grep CẢ 5 route admin:
      `isAdmin()` là câu lệnh ĐẦU TIÊN ở mọi route, trước khi đọc dữ liệu, không error branch
      nào trả row. Implementer test cả hai chiều thật: 401 khi chưa auth, và đăng nhập thật
      kéo đúng dòng waitlist. Tương thích ngược: thiếu `loai` → vẫn ra export đăng ký cũ,
      cùng tên file. `waitlistToSheet` từ zero test → 5 test (assert vị trí cột, không chỉ boolean).
- Task 10: complete (commit 92c9802..7b66d22, review clean — spec ✅, Approved)
      Admin hai tab. `chu_de_khac` vào modal đúng vị trí, ẩn khi null.
      BẤT BIẾN POLL GIỮ ĐƯỢC: reviewer (opus) KHÔNG tin lời khai, tự `git show` trích hai blob
      rồi diff cả vùng logic → `busyRef`/`writeGenRef`/`fetchSeqRef`/`appliedSeqRef`, toàn bộ
      `refresh()` và `update()` byte-identical. Chỉ 2 dòng được phép đổi (guard `tab` + dep array).
      CÂU HỎI KHÓ ĐÃ ĐƯỢC TRẢ LỜI: guard `tab` có tự phá bất biến không? KHÔNG — vì
      AdminDashboard KHÔNG BAO GIỜ unmount khi đổi tab (chỉ đổi nhánh JSX), nên 4 ref sống
      nguyên, `appliedSeqRef` vẫn đơn điệu tăng. Fetch bay giữa chừng chỉ ghi vào state
      registration, mà WaitlistTab giữ state riêng → không thể nhiễm chéo. `update()` không bị
      guard `tab` nên check-in đang bay vẫn được bảo vệ y như cũ.
      Minor tồn đọng (plan-mandated, thẩm mỹ): badge đếm trên tab waitlist dùng prop tĩnh
      `initialWaitlist.length` trong khi panel bên trong tự giữ state → bấm "Làm mới" xong sẽ
      thấy HAI con số khác nhau trên cùng màn hình. Tab sự kiện không bị (đọc `rows.length`).
      Minor: `WaitlistTab.refresh()` không xử lý riêng 401 nên hết phiên sẽ kẹt ở thông báo
      chung, không tự chuyển về /admin/login như AdminDashboard.

- Fix 2 minor admin (commit 4d565c0): badge waitlist đọc số live qua `onCountChange` (gọi
      trong useEffect, KHÔNG gọi setter của cha lúc render); `WaitlistTab.refresh()` VÀ
      `exportXlsx()` xử lý 401 → `/admin/login` như AdminDashboard. Export cũng có cùng lỗ 401.
      Khối chống ghi-đè của poll: 4 lần diff programmatic → byte-identical, exit 0 cả 4.

- Fix test bám đồng hồ thật (commit d5939d6) — PHÁT HIỆN ĐÁNG GIÁ NHẤT VỀ QUY TRÌNH:
      Suite 104/104 xanh lúc 23:52 ngày 20/07, rồi ĐỎ 1 test sau nửa đêm. Subagent báo là
      "flake tiền tồn tại, cũng đỏ trên commit cũ" — ĐÚNG nhưng CHƯA ĐỦ, và nếu tin nguyên
      lời đó thì đã bỏ qua.
      Thực tế: `validation.test.ts` lấy `Date.now() + 86_400_000` theo UTC làm "ngày mai".
      Từ 00:00–07:00 sáng giờ VN, "ngày mai theo UTC" CHÍNH LÀ hôm nay theo giờ VN → server
      nhận đúng (đúng mục tiêu bản vá R6) còn test đòi từ chối. Test đỏ mỗi ngày 7 tiếng.
      Đã probe 4 mốc giờ để xác minh CODE ĐÚNG ở cả bốn trước khi sửa test:
        hôm nay (VN) → luôn nhận · mai (VN) → luôn từ chối · mai (UTC) → chỉ nhận trong cửa sổ
      Ghim bằng fake timer. Mutation: gỡ `VN_OFFSET_MS` khỏi refine → test biên đỏ ngay.
      BÀI HỌC: "flake" là từ cần điều tra, không phải từ để kết luận. Và test phụ thuộc đồng
      hồ thật sẽ đỏ đúng lúc bất tiện nhất — cái này đỏ ngay trong đêm trước tuần mở đăng ký.

## CẦN CLICK TAY (không lưới tự động nào phủ được — repo không có test component)
- Đổi sang tab Waitlist rồi quay lại: bảng check-in còn render, bộ đếm chạy tiếp?
- Tick check-in RỒI ĐỔI TAB ngay giữa lúc ghi, quay lại: dòng đã tick có bị revert không?
  (đây là bài test bộ đếm generation xuyên qua guard `tab` mới)
- Modal dòng `da_sinh`: hiện Tên bé/Ngày sinh/Giới tính/Tháng tuổi. Dòng `mang_thai`: KHÔNG hiện.
- Modal dòng có `chu_de_khac` vs dòng trống: hàng "Chủ đề khác" phải hiện ở cái đầu, VẮNG HẲN
  (không phải "—") ở cái sau, và nằm ngay dưới "Chủ đề quan tâm".
- Xuất Excel ở CẢ HAI tab → hai file khác nhau, bộ cột khác nhau.
- Gõ vào ô tìm kiếm waitlist rồi xuất → file chỉ chứa email đã lọc.

## CÒN LẠI TRƯỚC 25/07
- **Task 9/10/11 của plan gốc CHƯA LÀM.** `AdminDetailModal.tsx` hiện KHÔNG hiển thị một field
  v2 nào (thai_tuan, ten_be, be_ngay_sinh, be_gioi_tinh, chu_de_quan_tam, chu_de_khac,
  nguon_biet_den). Deploy nguyên trạng thì ops chỉ đọc được dữ liệu mới qua file Excel.
  `/api/admin/export` thì tự theo 22 cột vì gọi `rowsToSheet` — chỗ đó không hỏng.
- **Kiểm thị giác `/su-kien` ở bề ngang điện thoại** — user nhận tự làm. R5 đổi cả 4 nhóm
  lựa chọn trong repo không có test component.
- **Chạy Task 11 end-to-end TRÊN PRODUCTION THẬT**, sau migration + sau khi tạo 6 attribute
  Brevo. Đây là thứ DUY NHẤT bắt được cả ba ngòi nổ nằm ngoài code (tên attribute Brevo,
  trạng thái header Google Sheet, migration Supabase). Nếu chỉ làm được một việc, làm việc này.
- Nếu BỎ QUA migration hoàn toàn: `export-rows.ts` chỗ `r.chu_de_quan_tam.map(...)` là truy cập
  duy nhất không có `??` → TypeError → `/admin` xuất Excel trả 500. Chạy bản SQL CŨ thì an toàn.
