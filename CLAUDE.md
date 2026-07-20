@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, deployed to Vercel.

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

Secrets live in `.env.local` (gitignored) — never commit them. See `.env.example` for the required keys.

## What we're building

Two things on one site:

1. **`/`** — a landing page for the **MamaOi mobile app**, a Vietnamese baby-tracking app. Tagline: *"Theo dõi hành trình lớn lên của bé mỗi ngày"*.
2. **`/su-kien`** — a registration page for **Mama Ơi Day**, a community event.

Plus `/privacy-policy` and `/terms-conditions`, which exist because the app store submission requires a public privacy policy URL.

### The app (source: `Mama Ơi_WBS.xlsx`, kept outside the repo)

A baby-tracking app for parents — persona: a parent logging quickly, many times a day, **often one-handed while holding the baby**. Eleven epics: onboarding/auth, baby profile (max 2 babies per account), home dashboard, feed tracking, sleep tracking, diaper tracking, health tracking (temperature, medicine, vaccines), milestones, reminders, statistics, and system settings.

The app's signature feature is **Wonder Week (Leap)** — developmental leap tracking, computed from the baby's due date.

### The event (source: `MamaOi Landing Page Brief Agency v2.docx`)

Locked facts — these appear verbatim on the page:

| | |
|---|---|
| Event | Mama Ơi Day – Hành trình 1 năm đầu đời cùng con |
| Date | Sunday, 30/08/2026 |
| Venue | ThiSkyHall Sala, 10 Mai Chí Thọ, Thủ Thiêm, TP. Thủ Đức, TP.HCM |
| Capacity | 500 mothers |
| Registration opens | 25/07/2026, driven from Ngô Thanh Vân's Facebook page |

**25/07/2026 is the hard deadline** — the page must be live and accepting submissions by then.

## The core directive: Membership First

The brief's central architectural instruction: **this is not an event microsite with a form bolted on.** Every registrant is a new member of the Mama Ơi community, and this page is the first entry point into the MamaOi app ecosystem.

- **Store registrations as structured records, not form dumps.** They must map cleanly onto the app's profile model. A registrant should never retype this information when the app launches.
- **The pregnancy/baby-age and city fields exist for segmentation**, not decoration. Model them as real typed fields (pregnant vs. born + baby age in months), never free text.
- Consent to receive information is captured explicitly and governs all downstream use.

## Design system

Tokens come from the **real Figma file** (`BsY0hebT7YbydhUsEwNbtx`) so the web matches the app exactly. Do not invent colors — they are defined in `src/app/globals.css` as CSS variables.

| Token | Value |
|---|---|
| Primary | `#f08f8c` (coral) |
| Secondary | `#8ca37c` (sage) |
| Info | `#7aafd8` |
| Warning | `#f6c266` |
| Danger | `#f47e72` |
| Text | `#292929` / faded `#737373` |
| Font | **Nunito** |

**Font constraint:** any font used must carry the Vietnamese subset. Verify before adopting one — Fredoka, for example, does not, and would break the diacritics in "Mama Ơi". Nunito does.

Tone: warm, cute, trustworthy, generous whitespace. The 3D illustrations in `assets/` are the visual anchor.

Copy is Vietnamese. Event names, section headings, and form labels are client-approved wording — keep them exactly as the brief writes them.

## Registration data flow

Both forms post to `POST /api/dang-ky`:

1. Validate + honeypot check (a hidden `website` field — the anti-bot mechanism actually in service; reCAPTCHA was removed as dead code)
2. **Brevo** — upsert contact with typed attributes, add to list, send the thank-you email. This is the source of truth.
3. **Google Sheets** — append a mirror row for the ops team.

Sheets failing must **not** fail the registration (Brevo already holds the lead). Brevo failing **must** surface a real error — never fake success.

`NGUON` attribute distinguishes `app-waitlist` from `su-kien`.
