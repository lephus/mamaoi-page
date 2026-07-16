# SDD Progress — 2026-07-16-checkin-qr-admin

Branch: feat/supabase-checkin-admin   Base: 17ecd6a   (no commits yet)
Plan: docs/superpowers/plans/2026-07-16-checkin-qr-admin.md

STATUS: PAUSED by user 2026-07-16, before any code was written.

## Done (controller pre-work, not committed)
- `npm install` — node_modules was broken (`next` itself missing); restored.
- Branch `feat/supabase-checkin-admin` created off 17ecd6a.
- Supabase table `registrations` CREATED on project MamaOiPage (ynebuselhjttlvbfpklb)
  via management API (Task 1 Step 2 done — no Supabase MCP available; used
  api.supabase.com/v1/projects/{ref}/database/query). Verified: 0 rows, 16 cols.
- Pre-flight plan scan: CLEAN. Verified isRegistration() exists, all design tokens
  (--color-line/-success/-ink-placeholder...) exist, Button takes the props the plan
  passes, and `checkinCode!` already used at dang-ky/route.ts:88 (so lint is fine).

## Decisions
- RLS: user explicitly chose to FOLLOW SPEC §4 and DISABLE RLS, after being shown
  evidence that anon has DELETE,INSERT,SELECT,UPDATE grants on the table and that
  the anon key can therefore read/write all registrant PII. RLS is currently OFF.
  ACCEPTED RISK, user's call. Guard rail: the anon key must NEVER be shipped to the
  client (no NEXT_PUBLIC_SUPABASE_*), or the table becomes world-readable instantly.

## Blocked / pending from user
- ADMIN_EMAIL / ADMIN_PASSWORD: user said they will supply. Blocks Task 7-8 only.
  (NB: plan Task 7 Step 1 hints email = admin@digitalunicorn.fr, and the Task 11
  security grep greps for `digitalunicorn@123` — likely the password from the
  earlier session. CONFIRM with user rather than assume.)

## Not yet done
- .env.local still needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (fetch from
  management API /api-keys, name == 'service_role').
- Tasks 1-11: ALL unstarted. No code written. Task 1 remaining = Steps 1,3,4,5,6.

## Tasks
(none complete)
