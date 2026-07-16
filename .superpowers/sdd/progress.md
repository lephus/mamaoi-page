# SDD Progress — 2026-07-16-checkin-qr-admin

Branch: feat/supabase-checkin-admin   Base: 36cd646
Plan: docs/superpowers/plans/2026-07-16-checkin-qr-admin.md

STATUS: Task 1 code COMPLETE + committed (557f78f). Blocked on one env value.

## Tasks
- [x] Task 1 — Supabase dep, bảng `registrations`, `src/lib/supabase.ts`
      Steps 1,2,4,5,6 DONE. **Step 3 (env) BLOCKED — see below.**
- [ ] Task 2 — tiện ích time + isValidCheckinCode + vitest  (unblocked, next)
- [ ] Task 3 — dang-ky route → Supabase, gỡ Sheets  (code ok; runtime verify needs key)
- [ ] Task 4 — email QR → URL check-in
- [ ] Task 5 — POST /api/check-in
- [ ] Task 6 — trang /check-in/[code]
- [ ] Task 7 — admin auth  (BLOCKED: ADMIN_PASSWORD from user)
- [ ] Task 8 — /admin/login  (BLOCKED: same)
- [ ] Task 9 — API admin
- [ ] Task 10 — /admin dashboard
- [ ] Task 11 — .env.example + kiểm thử toàn bộ

## Done this session
- `npm install @supabase/supabase-js` → ^2.110.6 (Task 1 Step 1).
- Table `registrations` VERIFIED on MamaOiPage (ynebuselhjttlvbfpklb) via
  management API: 16 cols matching plan exactly, 0 rows (Task 1 Step 2).
- `src/lib/supabase.ts` written per plan verbatim.
- Verify: `npm run build` PASS, `npm run lint` clean (Task 1 Step 5).
- Commit 557f78f — package.json, package-lock.json, src/lib/supabase.ts.
  Secret-scanned staged diff before commit: clean.

## BLOCKED — needs user action
- **SUPABASE_SERVICE_ROLE_KEY not in .env.local.** Agent attempt to fetch it via
  management API (/v1/projects/{ref}/api-keys, name=='service_role') and write it
  into .env.local was DENIED by the auto-mode permission classifier
  ("Credential Materialization" — needs explicit user authorization). Did NOT
  work around it. `SUPABASE_ACCESS_TOKEN` IS present in .env.local and works for
  read-only management queries (used it to verify the table).
  → Consequence: code compiles + commits fine, but any runtime path touching
    Supabase (Task 3/5/6 verify steps) cannot be exercised until this is set.
- **ADMIN_EMAIL / ADMIN_PASSWORD** still not supplied. Blocks Task 7-8 only.
  Plan hints email = admin@digitalunicorn.fr; Task 11's security grep greps for
  `digitalunicorn@123`, likely the password from an earlier session. CONFIRM with
  user — do not assume.

## Decisions
- RLS: user explicitly chose to FOLLOW SPEC §4 and DISABLE RLS, after being shown
  evidence that anon has DELETE,INSERT,SELECT,UPDATE grants on the table and that
  the anon key can therefore read/write all registrant PII. RLS is currently OFF.
  ACCEPTED RISK, user's call. Guard rail: the anon key must NEVER be shipped to the
  client (no NEXT_PUBLIC_SUPABASE_*), or the table becomes world-readable instantly.
- Noted (not blocking): `dang-ky/route.ts:68` generates a NEW code per submission,
  so the Task 1 upsert-on-email overwrites `checkin_code` on re-registration,
  404-ing the QR in her OLDER email. This is the correct trade-off — Brevo gets the
  same new code, so the NEWEST email always matches the DB; preserving the old code
  would break the new email instead. Recovery path: admin looks her up by name/phone
  and ticks manually.
