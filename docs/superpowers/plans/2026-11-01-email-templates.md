# E-posta şablonları yeniden tasarım — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare `<p>` HTML of the 7 Resend emails with the approved canvas design (plain / Puhu / coach layouts, one button, two footers), new TR+EN copy, and fix the coach emails' unfilled variables.

**Architecture:** One pure renderer file builds every email (`renderEmail` → `{subject, html, text}`) from a per-template definition table plus i18n copy; the Resend adapter only fetches config/i18n and posts. Layout is table-based inline-CSS HTML (Gmail/Outlook safe): images are hosted PNGs under the web app's `public/img/email/`, referenced by absolute `APP_URL` URLs.

**Tech Stack:** NestJS, nestjs-i18n, Vitest, Pillow (asset step only).

**Spec:** Canvas https://claude.ai/artifact/B7XpHiWoh4x3avNk67zV5H (approved 2026-11-01; boards 1–7 + "Bileşenler"). Decisions recap in this plan's Global Constraints.

## Global Constraints

- Card 600 px, white, radius 20, on wash `#F3F8FD`; padding 40/44; text Nunito (Google Fonts link) → fallback `-apple-system, 'Segoe UI', Roboto, Arial, sans-serif`.
- Heading 26/800 `#111111`; body 16/1.6 `#333333`; notes and footer 13/1.45 `#666666`; links `#1A5FA3` (coach emails `#26377F`).
- Student button: bg `#55ACEE`, text `#0F2233` 16/800, padding 14×28, radius 16, `border-bottom: 4px solid #3B8FD0`. Coach button: bg `#26377F`, text `#FFFFFF`, edge `#1F2C66`. Exactly one button per email.
- Coach chip "Koç"/"Coach": 13/800 `#26377F` on `#E6E9F7`, pill.
- Info box (dunning): bg `#E4EEFE`, radius 14, label 14 `#333333`, value 16/800 `#111111`.
- PREMIUM badge (welcome): 11/900, tracking 0.06em, ink `#12141A`, bg `#C4B8E0` (gradient `linear-gradient(135deg,#7EB6E8 0%,#C4B8E0 52%,#F3A6C8 100%)` where supported).
- Subjects have no "PuhuKoç:" prefix. Every email has a hidden preheader.
- Copy: `docs/copy/voice.md` (sen, no em dash, no "lütfen"/"kontrol et"). Verify/reset/dunning/coach = companion register (no emoji); welcome + daily reminder = Puhu register (≤1 emoji, ≤1 `!`).
- All user values HTML-escaped; every href through `assertSafeHttpUrl`.
- Each number appears once per email body (dunning date only in the info box).
- No commit: the user commits.

## Review Focus

- Empty `displayName` → the greeting reads "Merhaba," / "Hi," with no dangling space or comma pair (Task 3 test `greets without a name`).
- A student name with `<script>` in the risk digest → escaped in subject, preheader, list rows and text (Task 3 test `escapes student names`).
- `graceUntil` missing or not a date → dunning renders without the info box, no "Invalid Date" (Task 3 test `dunning without a date`).
- `lang: "en-US"` → English copy and `/en/...` links for every template (Task 3 test `english links`).
- Unknown template id → plain layout, fallback copy, no button, no crash (Task 3 test `unknown template`).

---

### Task 1: Email image assets

**Files:**
- Create: `apps/web/public/img/email/logo.png` (copy of `apps/admin/public/images/puhukoc/puhukoc-wordmark.png`, 244×78 RGBA, shown at 122×39)
- Create: `apps/web/public/img/email/puhu-welcome.png` — 1200×520, the welcome header: white ground with three radial blobs (cyan `#BDEBFF` @ 0.95 at 18%/30% r≈55%, pink `#FF2DAB` @ 0.16 at 85%/18% r≈50%, blue `#9BC1FB` @ 0.75 at 62%/95% r≈60%) and `mascot/puhu/puhu-premium.png` scaled to 472 px tall, centred, bottom 36 px past the edge (cropped). Top 20 px corners left square (the card clips them).
- Create: `apps/web/public/img/email/puhu-encouraging.png` (copy of `mascot/puhu/puhu-encouraging.png`, shown at 112×119)

- [ ] **Step 1:** Generate with a Pillow script in the scratchpad (not committed); welcome header saved as optimized PNG ≤ 400 KB.
- [ ] **Step 2: Verify:** `python -I -c` prints sizes `(244, 78)`, `(1200, 520)`, `(240, 256)` and file sizes; view `puhu-welcome.png` once.

### Task 2: Copy (TR + EN)

**Files:**
- Modify: `apps/api/src/i18n/locales/tr/notifications.json`, `apps/api/src/i18n/locales/en/notifications.json` (`email` object only)

**Interfaces:**
- Produces: keys `email.<key>.{subject,preheader,heading,body,cta,note?}` for keys `identityVerifyEmail, identityResetPassword, paymentsDunning, paymentsWelcome, dailyReminder, mentorshipRiskDigest, mentorshipFollowupDue`; `email.fallback.{subject,heading,body}`; shared `email.common.{hello,helloName,fallbackLink,coachChip,footerTransaction,footerNotification,footerCoach,footerSubscription,help,preferences,subscriptionLink}`; extras `email.identityResetPassword.validity`, `email.paymentsDunning.dateLabel`, `email.paymentsWelcome.{badge,benefitsTitle,benefit1,benefit2,benefit3}`, `email.dailyReminder.bubble`. Args: `{hello}` (already-resolved greeting), `{count}`, `{names}`, `{date}`.

- [ ] **Step 1:** Write TR exactly as the canvas boards (e.g. verify: subject "E-postanı doğrula", preheader "Tek dokunuş kaldı, hesabın hazır olsun.", heading "E-postanı doğrulayalım", body "{hello} hesabını tamamlamak için tek bir dokunuş kaldı.", cta "E-postamı doğrula", note "Bu hesabı sen açmadıysan bu e-postayı görmezden gelebilirsin. Senin adına hiçbir şey değişmez."; `common.helloName` "Merhaba {name},", `common.hello` "Merhaba,"). Risk digest subject "Bugün bakmaya değer {count} öğrenci", preheader "{names} son günlerde zorlanıyor olabilir."; follow-up subject/heading "Bugün {count} takibin var". Welcome benefits = the three `paywall.benefit_*_title` strings used on the canvas.
- [ ] **Step 2:** Write EN in the same voice (not a calque); same keys.
- [ ] **Step 3: Verify:** `node -e` compares the key sets of tr/en `email` objects → equal; `grep -c "—"` on both files' email section → 0.

### Task 3: Renderer

**Files:**
- Create: `apps/api/src/shared/adapters/email/email-render.ts`
- Test: `apps/api/src/shared/adapters/email/email-render.spec.ts`

**Interfaces:**
- Consumes: `escapeHtml`, `assertSafeHttpUrl` (`email-html.util.ts`); `EMAIL_COPY_KEY` (`shared/notifications/constants.ts`); Task 2 keys.
- Produces: `renderEmail(input: { template: string; vars: Record<string, unknown>; lang: "tr" | "en"; appUrl: string; t: (key: string, args?: Record<string, unknown>) => string }): { subject: string; html: string; text: string }`. `t` returns `""` for a missing key.

Per-template table (`kind` / button target / footer):
| template | kind | button href | footer |
|---|---|---|---|
| identity.verify-email, identity.reset-password | plain | `vars.link` + fallback-link line | transaction |
| payments.dunning | plain | `/abonelik` · `/en/subscription` | transaction |
| payments.subscription-welcome | puhu-hero | `/panel` · `/en/dashboard` | subscription |
| coaching.daily-reminder | puhu-bubble | `/panel` · `/en/dashboard` | notification |
| mentorship.risk-digest, mentorship.followup-due | coach | `/kocluk` · `/en/coaching/students` | coach |
Preferences link: `/profil#notification-settings` · `/en/profile#notification-settings`. All paths resolved with `new URL(path, appUrl)`. Images: `${appUrl}/img/email/{logo,puhu-welcome,puhu-encouraging}.png`.

- [ ] **Step 1: Write the failing tests** with a fake `t` that echoes `key|JSON(args)`:
  - `verify email has one button to the link and the fallback line` — html contains `href="https://puhukoc.com/eposta-dogrula?token=x"` twice (button + fallback), one `#55ACEE` button.
  - `coach digest fills count, names and the list` — vars `{displayName:"Ayşe", count:2, names:"Selin, Mert", studentNames:["Selin","Mert"]}`: subject args contain `"count":2`; html has two list rows; button colour `#26377F`; href `/kocluk`.
  - `followup due fills count` — subject args `"count":4`.
  - `dunning shows the date once` — `graceUntil:"2026-11-12T10:00:00Z"`, lang tr → html contains `12 Kasım 2026` exactly once; href `/abonelik`.
  - `dunning without a date` — `graceUntil:"nope"` → no `dateLabel` key in html.
  - `greets without a name` — `displayName:""` → `t` called with `common.hello`, never `helloName`.
  - `escapes student names` — `studentNames:["<script>x</script>"]` → html has no `<script>x`.
  - `english links` — lang en for each template → hrefs start with `https://puhukoc.com/en/` (verify uses its own link).
  - `notification footer links to preferences` — daily reminder html contains `/profil#notification-settings`; verify html does not.
  - `unknown template` — template `"x.y"` → fallback keys, no `<a` with button style.
  - `text version` — text contains heading, body, the button URL, no `<`.
- [ ] **Step 2: Run** `pnpm --filter @mentor/api exec vitest run email-render` → FAIL (module missing).
- [ ] **Step 3: Implement** `renderEmail` in `email-render.ts`: small private helpers `layout`, `button`, `footer`; table markup (`role="presentation"`, `width="600"`, `max-width:600px; width:100%`) so phones shrink the card; hidden preheader `<div style="display:none;max-height:0;overflow:hidden">`; `<meta name="color-scheme" content="light">`. Date via `Intl.DateTimeFormat(lang === "en" ? "en-GB" : "tr-TR", { day:"numeric", month:"long", year:"numeric", timeZone:"Europe/Istanbul" })`. Text version: heading, body, note, `cta: url` lines joined by blank lines. Keep the file under ~250 lines; split layout pieces into `email-layout.ts` if it grows past that.
- [ ] **Step 4: Run** the same command → PASS.

### Task 4: Wire the adapter and the digest variables

**Files:**
- Modify: `apps/api/src/shared/adapters/email/resend-email.adapter.ts` (drop `emailCopy/renderHtml/renderText`; call `renderEmail` with `APP_URL` from config and a `t` that returns `""` for unresolved keys, as `optional` does today)
- Modify: `apps/api/src/shared/adapters/email/resend-email.adapter.spec.ts` (config gets `APP_URL: "https://puhukoc.com"`; existing escape/link/error assertions stay)
- Modify: `apps/api/src/modules/notifications/application/mentorship-risk-digest.service.ts:102` — variables become `{ displayName, ...args, studentNames: candidate.students.map((s) => s.displayName).filter(Boolean) }`
- Check: `logger-email.adapter.ts` still logs (it does not render HTML; leave as is)

- [ ] **Step 1:** Update the adapter spec: assert `body.subject` no longer starts with `PuhuKoç:` is not needed (fake i18n); add `expect(body.html).toContain("https://puhukoc.com/img/email/logo.png")`.
- [ ] **Step 2: Run** `pnpm --filter @mentor/api exec vitest run resend-email.adapter email-render mentorship-risk-digest send-email` → PASS.
- [ ] **Step 3: Render check:** a scratchpad script renders all 7 templates (TR) to HTML files with the real JSON copy; open each once in the browser pane at 680 and 375 widths and compare with the canvas boards.

### Task 5: Docs

**Files:**
- Modify: `docs/features/notifications.md` (timeline entry: layouts, copy keys, hosted images, variable fix, sender avatar note)
- Modify: `docs/copy/voice.md` only if a new rule appears (none expected)

- [ ] **Step 1:** Timeline entry, including: the inbox avatar (puhu-default on the canvas) is not HTML; it is the sender's Google profile picture / BIMI and must be set outside the code.
- [ ] **Step 2:** Final checks: `pnpm --filter @mentor/api typecheck` and `pnpm --filter @mentor/api lint` → no new errors.
