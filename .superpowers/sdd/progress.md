# SDD Progress — 2026-07-16-checkin-qr-admin

Branch: feat/supabase-checkin-admin
Plan: docs/superpowers/plans/2026-07-16-checkin-qr-admin.md

STATUS: Tasks 1-10 DONE + committed. Only Task 11 remains.
Lint clean, build passes, tests 10/10 green as of 2026-07-16 22:38.

## Tasks
- [x] Task 1 — Supabase dep + bảng + `src/lib/supabase.ts`      → 557f78f
      Steps 1,2,4,5,6 done. **Step 3 (env) NOW UNBLOCKED — key present, see below.**
- [x] Task 2 — time utils + isValidCheckinCode + vitest          → 361dd0b
- [x] Task 3 — dang-ky → Supabase, gỡ Sheets                     → 50d2b34
- [x] Task 4 — QR email → URL check-in + nút                     → f73d60b
- [x] Task 5 — POST /api/check-in                                → a5da763
- [x] Task 6 — trang /check-in/[code]                            → 49842a0
- [x] Task 7 — admin auth (env-cred + cookie HMAC)               → 662e50c
- [x] Task 8 — /admin/login                                      → cf6eea1
- [x] Task 9 — API admin (registrations + checkin)               → 0113a57
- [x] Task 10 — /admin dashboard                                 → 439ff46
- [ ] Task 11 — .env.example + kiểm thử toàn bộ

## FIRST THING TO DO IN THE NEXT SESSION
1. **ADMIN_PASSWORD is still EMPTY in `.env.local`** — until the user fills it,
   `adminAuthConfigured()` is false and `POST /api/admin/login` returns 500
   ("Chưa cấu hình đăng nhập admin"). Everything else is wired and verified.
   Do NOT try to dig the old password out of git history: the permission
   classifier denies it ("Credential Exploration") and that denial is correct —
   the user's "kệ lộ" accepts the existing leak, it does not authorise scanning
   for credentials. Ask the user for the value, or let them fill the file.
2. Task 11 is all that's left (`.env.example` + full E2E).
3. Check `git status` — `.superpowers/sdd/progress.md` will be dirty (this file).
   Also `yarn.lock` is UNTRACKED and unexplained in this npm project — it appeared
   during the 2026-07-16 session. Investigate before committing anything; do not
   commit it blindly.

## What Task 7-10 verified against a live server (2026-07-16)
Started `npm run dev` ONCE inside a single shell command with a `trap` that kills
it on exit — left zero stray node processes afterwards (`pgrep -x node` empty,
port 3000 free). This is the pattern to reuse.
- `GET /admin` chưa đăng nhập  → 307 → `/admin/login`   ✓
- `GET /admin/login`           → 200                     ✓
- `GET /api/admin/registrations` không cookie → 401 `"Chưa đăng nhập"` ✓
- `POST /api/admin/checkin` không cookie      → 401       ✓
- `POST /api/admin/login` khi chưa cấu hình   → 500 `"Chưa cấu hình đăng nhập admin"` ✓
NOT verified (needs ADMIN_PASSWORD): successful login, cookie set, dashboard
rendering real rows, manual tick + time edit, logout.

## On the Bash tool dying (supersedes the earlier theory)
The earlier note blamed backgrounding `npm run dev`. That is NOT confirmed. In the
2026-07-16 session Bash died twice and recovered on its own, including once when
NO dev server was running and load was 1.75 — so process exhaustion from Turbopack
does not explain it. A Spotlight bulk re-index (`mds_stores` at 102% CPU, load
22-26 on 8 cores) was also present but is likewise unproven as the cause; the
machine had been rebooted 18 min earlier. Treat the Bash tool as simply flaky:
batch commands, commit early, and don't build a theory on one correlation.
Mitigation applied: `node_modules/.metadata_never_index` + `.next/.metadata_never_index`
now stop Spotlight from following Turbopack's writes (692MB / 1857 files in .next,
22490 files in node_modules).

## Task 6 — what was done (verified, uncommitted)
- Created `src/components/CheckinConfirm.tsx` — verbatim from plan.
- Created `src/app/check-in/[code]/page.tsx` — **DEVIATES from the plan on purpose.**
  The plan's version builds JSX inside try/catch; that fails this repo's lint
  (`react-hooks/error-boundaries`, 3 errors) and the rule is correct — React
  renders the element later, so a render error can never reach that catch. The
  plan's own Global Constraints require lint to be clean after every task, so the
  plan's literal code is unshippable here.
  Restructure: `try` wraps ONLY the `await findByCode(code)` call; every JSX branch
  is an early `return` outside it; extracted a `Shell` component so Header/main/
  Footer isn't repeated 5×. Same behaviour, same copy, same tokens.
- VERIFIED before the shell died: `npm run lint` clean, `npm run build` compiled
  (`ƒ /check-in/[code]` in the route table), `npm test` 6/6 pass.
- NOT verified: browser render of each branch (needs a dev server; and the
  found/already-checked-in branches need the service key too).

## BLOCKED — needs user action
- **RESOLVED 2026-07-16: `SUPABASE_SERVICE_ROLE_KEY` IS NOW SET in `.env.local`**
  (219 chars, verified present without printing the value). The user set it
  between sessions. Everything below about this key is kept for history only —
  the DB paths (Task 3/5/6/9/10) are no longer blocked locally. **Still must be
  set on Vercel before deploy.** Historical note follows:
- ~~**SUPABASE_SERVICE_ROLE_KEY still not in .env.local.**~~ (`SUPABASE_ACCESS_TOKEN`
  IS present and works for management-API reads — used it to verify the table.)
  Agent's attempt to fetch the service key itself was denied by the permission
  classifier ("Credential Materialization"); did NOT work around it. User was
  given both a one-liner (management API → .env.local) and the dashboard path
  (Project Settings → API → service_role → Reveal) but has not run either yet.
  → Consequence: Task 3/5/6 runtime paths that touch the DB cannot be exercised.
    Task 5 WAS verified for its non-DB branches against a live server:
      ABC → 400 "Mã không hợp lệ"; MO-ABCDEI → 400 (regex works e2e);
      bad JSON → 400 "Dữ liệu không hợp lệ"; MO-ZZZZZZ → 502 (db() throws on
      missing config, caught) — confirming the missing key is the only blocker.
  → ALSO: Task 3 removed the Google Sheets mirror. Until the key is set (locally
    AND on Vercel), registrations have NO mirror at all — `supabaseConfigured()`
    returns false so Supabase is skipped. Brevo still holds every lead so nothing
    is lost, but ops has no reconciliation table. SET THE KEY ON VERCEL BEFORE DEPLOY.
- **ADMIN_PASSWORD decision.** User confirmed the password on 2026-07-16 and, when
  shown that it is leaked in git, replied "lộ k sao, kệ" — explicitly accepting it.
  Agent's standing recommendation, to raise ONCE at Task 7 and then drop:
  ADMIN_PASSWORD is not yet set anywhere (not in .env.local, not on Vercel), so
  choosing a random value at Task 7 costs nothing and makes the leaked string
  worthless — no history rewrite needed. Only cost: user stores the new one, and
  coordinates if the client already has the old one. USER'S CALL — do not nag.

## Security notes (user informed, decisions recorded)
- Admin password is committed in clear text and PUSHED to origin/main
  (phule9225.github.com:lephus/mamaoi-page.git) in two tracked markdown files:
    - `docs/superpowers/plans/2026-07-16-checkin-qr-admin.md` — since 17ecd6a
    - `.superpowers/sdd/progress.md` — since 5b1e543 (scrubbed from the working
      copy on 2026-07-16; still in history)
  Both predate this work. Repo visibility UNKNOWN (`gh` not installed).
  User accepted the risk. Current real-world exposure is nil: the table has 0 rows
  and registration does not open until 25/07/2026. It stops being nil on that date.
- **Task 11 Step 3's security grep is broken — FIX IT BEFORE TRUSTING IT.** It
  passes `':!*.md'`, excluding markdown, which is the only place the password
  lives. Ran it against the tree: prints "OK - khong co bi mat trong source" while
  the password sits in two committed .md files. Drop the `':!*.md'` pathspec.
- User pasted the live `sbp_...` management token into `.env.example` (TRACKED)
  on 2026-07-16. Caught before any commit; removed; `.env.example` now matches
  HEAD exactly and `git grep sbp_` finds only the grep pattern in the plan doc.
  The token did appear in the session transcript → advised rotating it
  (Supabase → Account → Access Tokens). User has not said whether they did.
- Agent error worth not repeating: commit 50d2b34 carried the password forward in
  progress.md. The pre-commit scan DID flag it, but `git commit` was a separate
  shell line so it ran anyway. Later commits gate the commit on the scan with
  `if grep -q ...; then git reset; exit 1; fi` — keep doing that.

## Decisions
- RLS: user explicitly chose to FOLLOW SPEC §4 and DISABLE RLS, after being shown
  evidence that anon has DELETE,INSERT,SELECT,UPDATE grants on the table and that
  the anon key can therefore read/write all registrant PII. RLS is currently OFF.
  ACCEPTED RISK, user's call. Guard rail: NO Supabase key may ever reach the client
  (no NEXT_PUBLIC_SUPABASE_*), or the table becomes world-readable instantly.
- Noted (not blocking): `dang-ky/route.ts:68` generates a NEW code per submission,
  so Task 1's upsert-on-email overwrites `checkin_code` on re-registration,
  404-ing the QR in her OLDER email. Correct trade-off — Brevo gets the same new
  code, so the NEWEST email always matches the DB; preserving the old code would
  break the new email instead. Recovery: admin looks her up by name/phone, ticks
  manually.

## Environment facts (save the next session some digging)
- Supabase project ref: ynebuselhjttlvbfpklb (MamaOiPage).
- Table `registrations` VERIFIED via management API: 16 columns exactly matching
  the plan's DDL, 0 rows.
- `.env.local` IS gitignored (`.gitignore:3:.env.*`) — verified with git check-ignore.
- `.env.example` IS tracked — never put real values there.
- Installed this session: `@supabase/supabase-js@^2.110.6`, `vitest@^4.1.10`
  (devDep, `"test": "vitest run"`). Removed: `google-auth-library`, `src/lib/sheets.ts`.
- `gh` CLI is NOT installed on this machine.
