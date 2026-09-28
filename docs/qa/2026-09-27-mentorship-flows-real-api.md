# Mentor QA — 27 September 2026 — Coach ↔ student flows (real API)

## Scope and environment

The whole human-coach relationship, both directions, as two people in two browsers: invite,
consent, assignment, note, follow-up, the feedback loop, limits, leaving and re-linking. Earlier
W8 browser evidence was mostly mocked-API UI (see the
[seat smoke](2026-09-27-coach-seat-ai-smoke.md): "UI evidence, not a real-API browser result");
this run drives the real Nest API and database from the browser.

- **Source:** `feat/qa-dashboard-performance`, tested at `8380c5d0`; HEAD moved to `3157d6dd` during
  the run with no mentorship product change (vision board, celebration, CI smoke only). The
  2026-09-28 rerun is the same branch with the fixes below uncommitted, `mentor_test` migrated to
  `0118`.
- **Isolated stack:** API `localhost:3101` from the current `dist`, `DATABASE_URL=mentor_test`,
  fake AI, vision, storage and payments, `POSTMARK_TOKEN` empty (mail to the console sink);
  production web build `localhost:3100` with `NEXT_PUBLIC_API_URL` pointing at it. The developer
  stack on 3000/3001 and the `mentor` database were not touched.
- **Browser:** Playwright 1.61 Chromium, fresh contexts, `tr-TR`, `Europe/Istanbul`, reduced motion,
  mobile 375×812 and desktop 1280×800. Disposable `example.test` accounts, one run id per run.
- **Flags for the run** (restored afterwards): `mentorship.enabled`, `mentorship.applications.open`,
  `mentorship.followups.enabled`, `mentorship.weekly_reports.enabled` on; `free_seats` 3;
  sponsorship left at its production default (off).

## Results

| Layer | What ran | Result |
| --- | --- | --- |
| API unit + e2e (real Nest, `mentor_test`) | `vitest run mentorship cohort-evidence coach-evidence qa-coach-ai-taste plan-mentorship`: 50 files | **581/581 passed**. In the 50-file batch one vitest worker exited unexpectedly (Windows) and `mentorship.e2e-spec.ts` did not report; alone it passed **70/70**. Environment, not product. |
| Real-API browser | [`qa-mentorship-flows-real-api.spec.ts`](../../apps/web/e2e/qa-mentorship-flows-real-api.spec.ts), 2 viewports | Before the fixes, 16 scenarios: **28 passed + 4 expected failures** (B1, B2). After B1–B4, 17 scenarios: **34/34 passed**, 2.6 min, `--workers=1`. After O1–O3, F5 and F4 (2026-09-28), 19 scenarios: **38/38 passed**, 3.4 min. |
| Mocked-API browser (UI states) | `mentorship`, `coach-home`, `coach-student`, `mentorship-followups`, `mentorship-weekly-report`, `coach-plan`, `coach-onboarding` on the dev server (3000, API calls intercepted) | **204 passed, 4 skipped** (the viewport-only coach navigation cases), 6.6 min. Presentation evidence, not authorization. |
| Static | ESLint + `tsc --noEmit` (web) on the new spec | Clean. |

### Real-API scenarios

| ID | Direction | Scenario | Result |
| --- | --- | --- | --- |
| M01 | Coach | First code from the hero card; masked, revealed on demand; `seatAllowance` 3 | PASS |
| M02 | Student | `?code=` only fills the field (no lookup, no link); preview shows coach, profile, can/can't-see; explicit accept → `/kocum`; coach gets "Yeni öğrencin var" | PASS |
| M03 | Coach | Roster row → student workspace; a student who joined a minute ago is not flagged | PASS (**F3** fixed) |
| M04 | Both | "Haftayı planla" composes a task with a coach note; student sees "Koçundan" + note; edit refused (API 403, no edit in the row menu) | PASS |
| M05 | Student → coach | Completing the task → coach "ödevini tamamladı"; report status DONE | PASS |
| M06 | Coach → student | Future-dated assignment notification opens the task's day | **GAP B2 → FIXED**, passes |
| M06b | Coach → student | A meeting the coach sets up with the student appears on the student's plan, and the notification opens it | **GAP B4 → FIXED**, passes |
| M07 | Coach → student | Standing note → `/kocum` "Koçundan not" + notification | PASS |
| M08 | Both | Follow-up: private title/note never reach the student (API JSON and DOM); student accepts; coach notified, and the coach's open page shows "Kabul etti" without a reload | PASS (**O3** fixed) |
| M09 | Student → coach | Student deletes a coach task → coach notified with the title; report keeps it under dropped | PASS |
| M10 | Student → coach | Session (25 min) + mood 2 → roster minutes, `LOW_MOOD`, no `INACTIVE`, no `struggleNote`; "İlgilendim" toggles; `/kocum` mirror shows real figures | PASS |
| M10b | Coach → student | The coach finalizes a week (API); the student is notified, the notification's link opens "Haftalık değerlendirmen" with the coach's evaluation and "Hazırlayan", `/kocum` lists the week; the student's JSON has no brief, evidence or coach context | PASS (**F5**, new) |
| M10c | Student → coach | The student writes "Koçuna notun" on `/kocum`; the coach is notified ("Ada Yılmaz sana not bıraktı"), its link opens the report with "Ada'nın notu" | PASS (**F4**, new) |
| M11 | Limits | Unlinked student 404; an already-linked student opening a second coach's code is told "Zaten bir koçun var: Selin Aydın" before the consent, with no accept button (API 409); `free_seats` 1 → "Koçunun koltukları şu an dolu" stays on screen, no link written | PASS (**O2** fixed) |
| M12 | Student | Logged out → invite link → login → back on the invite with the code | PASS |
| M13 | Student | New user → invite link → signup → onboarding → back on the invite | **GAP B1 → FIXED**, passes |
| M14 | Student → coach | Student ends the link → coach notified, report 404, ENDED row with `metrics: null`; the coach's pending task is now the student's (no badge, editable) | PASS (**F1** fixed) |
| M15 | Both | Re-link starts a clean period (both notes and the decision gone); coach ends from ⋯ → student notified | PASS |
| M16 | Coach | Rotating the code; the old one previews 404 and says "Bu davet kodu geçerli değil." | PASS |

## Findings

### Confirmed defects

All four were fixed on 2026-09-27 (see "Fixes").

- **B1 — A new student loses the coach's invite.** Trail (both viewports):
  `/kocluk-daveti?code=X → /giris?next=/coach-invitation?code=X → /kayit → /baslangic → /panel`.
  "Hesap oluştur" on the login page drops `next`; signup sends a new user to onboarding; onboarding
  restores only study-room invites (`consumePendingInvite`, written by `join-room` alone); the
  `(app)` guard never remembers the invite. This is the coach's most common case (a link to someone
  without an account): the student lands on the panel with no mention of the coach, and nobody is
  told the link did not happen. Evidence: `…-fresh-student-after-onboarding-{d,m}.png`.
- **B2 — Student plan ignores `?date=` and `&event=`.** `plan-shell.tsx` starts at `todayIso()` and
  never reads the query (the coach plan does). Every student plan notification links there:
  assigned, changed (`mentorship-events.listener.ts`), plan events created/updated/cancelled and
  reminders (`plan-event-notifications.listener.ts`, `plan-event-reminder.handler.ts`), and the same
  URLs ride web push. A program the coach sets for next week opens on an empty today. No e2e
  covered it. Evidence: `…-student-notification-link-future-task-{d,m}.png`.
- **B3 — Signup's terms and age checkbox has no accessible name.** KVKK's `CheckBox` has
  `aria-labelledby`; the terms one (`signup/page.tsx`) does not, so a screen reader announces an
  unlabelled checkbox for the legal and 13+ declaration.
- **B4 — A coach's meeting never appears on the student's plan.** The coach creates an event with
  the student as attendee; the student gets "Planına bir etkinlik eklendi", and `GET /plan-items`
  returns the event to them (`kind: "EVENT"`, title, 18:00–18:30, `attendeeCount: 1`). The student
  `/plan` reads `/plan-tasks` only, so the day stays empty ("Bu günde henüz bir iz yok"). APP-091
  kept the student plan unchanged on purpose; the notification promised what the screen omitted.
  Evidence after the fix: `…-student-plan-coach-event-{d,m}.png` (the row and its details).

### Decisions needed

- **F1 — A coach's tasks outlive the link, still locked. Decided and fixed 2026-09-27:** at link
  end the PENDING ones become the student's own (no badge, editable); the coach note leaves with
  the badge because the database allows a note only on a coach-origin task, as erasure already
  does; DONE tasks keep both. M14 now asserts it. Before, after the student left:
  `taskStillInPlan: true`, `origin: MENTORSHIP`, student title edit **403**, "Koçundan" badge and
  coach note shown, no edit in the menu. The lock exists so the coach's report stays true; the coach
  can no longer see a report. Evidence: `…-student-plan-after-link-end-{d,m}.png`.
- **F2 — Minors. Decided 2026-09-27: no age declaration in the mentorship flow**; the signup's 13+
  self-declaration stays the only age gate (the stale backlog line in `mentorship.md` now says so).
  The finding as reported: APP-101 (2026-09-17) moved signup to a 13+ self-declaration; the mentorship
  decision "no parental-consent flow" (APP-084) rested on the old 18+ checkbox, and
  `mentorship.md`'s backlog still says "18 yaşından büyüğüm". Coaches self-register without
  approval and talk to students off-platform. LGS candidates are 13–14.
- **F3 — "Sessiz" on day one. Decided and fixed 2026-09-27:** silence now counts from the later of
  the last activity and the day the student joined (`evaluateRiskFlags(…, joinedOn)`, 3 new unit
  tests, the roster e2e now expects no flag for a student who joined a minute ago). Before:
  minutes after accepting, with nothing recorded:
  `riskFlags: ["INACTIVE"]` and the header chip "Sessiz", beside the assistant's "Ada yeni başladı".
  `risk-flags.ts` treats a null last-active date as infinitely idle and ignores `acceptedAt`, so the
  new student sits in "Seni bekleyenler", and with `mentorship.risk_digest.enabled` the next
  morning's digest names them too (`MentorshipQueryAdapter` runs the same rule on every live link).
- **F4 — No student → coach channel**, beyond accept/request-change on a shared decision
  (Phase 3 by design, roadmap §9). **Decided and fixed 2026-09-28:** a standing note, the mirror of
  the coach's (one per link, overwritten, never a thread, never sent to an AI provider, gone with
  the link). **F5 — The finalized weekly evaluation never reaches the student in the app**; the
  coach downloads a PDF and sends it elsewhere. **Fixed 2026-09-28:** the student is notified and
  reads the week in the app, as the printout's safe projection.

### Observations (low)

O1–O3 were fixed on 2026-09-28 (see "Fixes"); O4 and O5 stand; O6 is new.

- **O1** The note field's accessible name includes its hint and counter ("Ada'ya notun Ada bunu
  Koçum ekranında görür · 0/500"), so it changes on every keystroke.
- **O2** Refusals on the invitation (seats full, already linked, invalid code) are a transient
  "Bir sorun oluştu" toast; on a phone the reason is cut off ("yer açılınca…"). An already-linked
  student is told only after reading the whole consent and pressing accept.
- **O3** The coach's open follow-up panel keeps "Yanıt bekliyor" after the student answers, until
  reload (the inbox notification arrives).
- **O4** The invited new student's panel offers "Koçunu yanına al" (the AI coach trial), which reads
  as the coach they came for. Shrinks once B1 is fixed.
- **O5** The configured Turbopack production build succeeded on this machine; the Bitter font error
  in the seat smoke's P02 did not reproduce in the main checkout.
- **O6** The API previews and finalizes the last completed week even when it ended before the
  student joined (M10b finalized 21–27 September for a student linked on the 28th), while the
  coach's card says "İlk haftası bitince…" and offers nothing. Only a direct API call reaches it,
  and the week is inside the data scope the student consented to; not fixed, for the backlog.

## Fixes (2026-09-27 and 28)

Each one test-first: the new test failed for the reported reason, then passed on both viewports.

| ID | Change | Regression test (runs in CI) |
| --- | --- | --- |
| B1 | `(app)/app-shell.tsx` remembers `/coach-invitation?…` with `rememberPendingInvite` before sending an anonymous or not-yet-onboarded user away, as the study-room link already did; onboarding's last step returns there. | `onboarding-redesign.spec.ts` "a coach's invite link survives signup and onboarding" (login → Hesap oluştur → signup → onboarding → invite with the code) |
| B2 | `plan-shell.tsx` starts on a valid `?date=` and follows it during render when only the query changes (the drawer on `/plan`), using the coach plan's `coachPlanQueryTransition`. | `plan.spec.ts` "bildirim linki": direct `?date=` and the same-page drawer tap |
| B3 | `signup/page.tsx`: the terms checkbox gets `aria-labelledby`, like KVKK's. | `onboarding-redesign.spec.ts` "signup's consent checkboxes are named by their sentences" |
| F1 | `MentorshipLinkService.endLink` calls `PlanService.releaseMentorshipTasksInTransaction` in the link-end transaction; `releasePendingMentorshipTasks` clears origin and coach note on the link's PENDING tasks. | `mentorship-link-end.e2e-spec.ts` (student ends / coach ends, real DB); `mentorship-link.service.spec.ts` (same transaction, before the end); QA M14 |
| F3 | `domain/risk-flags.ts`: `evaluateRiskFlags(…, joinedOn)` counts silence from the later of the last activity and the join day; roster, attention mark, report and digest pass it (the digest's link row now carries `acceptedAt`). | `risk-flags.spec.ts` (3 new); `mentorship.e2e-spec.ts` roster row and the cohort brief premise (ages `accepted_at`); QA M03 |
| B4 | The student plan reads `/plan-events` for the selected day's month board (`use-plan-events.ts`, `lib/plan-events.ts`). A meeting is a read-only row above the day's tasks ("18:00 – 18:30 · Koçunla") and a chip on every Takvim surface (`glyph: "event"`); either opens a details sheet with no edit or delete. `&event=` opens that sheet once its month has loaded. Best-effort like holidays: a failed read shows none. | `plan-events.spec.ts` (5 unit); `plan.spec.ts` "koçun görüşmesi": list row + sheet, `&event=`, Takvim chip |
| O1 | `@mentor/ui` `TextAreaField` labels only its label text; the hint and counter describe the field. | `coach-student.spec.ts` "not bırak…" (exact name + `toHaveAccessibleDescription`) |
| O2 | `coach-invitation-shell.tsx` reads `GET /my-coach` on mount: an already-linked student sees "Zaten bir koçun var: {name}…" with a link to Koçum and no accept button; an accept refusal stays on screen as `role="alert"`. | `mentorship.spec.ts` "zaten koçu olan öğrenci…", "kabulün reddi ekranda kalır…"; QA M11 |
| O3 | The notification drawer dispatches `mentor:notification-arrived` for each streamed notification; `use-followup-page.ts` re-reads silently on it and when the tab becomes visible. | `coach-student.spec.ts` (event and `visibilitychange`); QA M08 |
| F5 | `mentorship.weekly_report.finalized` → student inbox notification; `GET /my-coach/weekly-reports{,/:reportId}` (latest version per week, share projection, own live link); `/kocum` card and `/kocum/haftalik-raporlar/:reportId`. | `mentorship-weekly-report.service.spec.ts` (+4); `mentorship-weekly-share.e2e-spec.ts` (4, real DB); `mentorship.spec.ts` (card + page, empty); QA M10b |
| F4 | `coach_students.student_note{,_at}` (migration `0118`); `PUT /my-coach/note`; `MyCoachDto` / report `studentNote`; coach notified once a day; cleared at link end; kept out of AI prompts. | `mentorship-link.service.spec.ts` (+6), listener spec, `assignment-suggestion.service.spec.ts` (AI guard), `mentorship-student-note.e2e-spec.ts` (4, real DB); `mentorship.spec.ts`, `coach-student.spec.ts`; QA M10c, M15 |

Verification: the real-API suite (above, final run 34/34 after F3); web unit tests **809/809**;
`plan` + `coach-plan` e2e **44/44**; API `mentorship cohort-evidence risk` **480/480** (one run of
`mentorship.e2e-spec.ts` lost its vitest worker, as in the baseline; two reruns passed 70/70); web
and API `tsc`, ESLint and the production bundle budgets pass.
Affected mocked suites (`plan`, `onboarding-redesign`, `mentorship`, `routing`, `coach-plan`,
`study-rooms`) on the dev server: 109 passed, 4 failed. One (the `plan` coach wizard) timed out
while a production build ran beside it and passed alone. The other three fail on port 3000
regardless of these changes: `study-rooms.spec.ts` on both viewports hardcodes the CORS origin
`http://localhost:3100` (so on 3000 it lands on login), and `routing.spec.ts:4` cannot click "TR"
under the Next dev "Issue" badge; with the three fixes stashed it failed the same way. CI serves
3100 from a production build, where neither applies.

Verification of O1–O3, F5 and F4 (2026-09-28): the real-API suite **38/38** (19 scenarios, both
viewports, 3.4 min); API unit tests of the touched modules (`mentorship`, `notifications`, `ai`,
`coaching`) **1332/1332**; API `mentorship cohort-evidence coach-evidence plan-mentorship
assignment-suggestion` with the real-DB e2e **582/582** (54 files, no lost worker this time); web
unit **809/809**; API and web `tsc` and ESLint on the touched files clean; OpenAPI and
`@mentor/api-client` regenerated (three new operations and their schemas; the rest only moved).
Mocked suites (`mentorship`, `coach-student`, `mentorship-followups`, `mentorship-weekly-report`,
`coach-home`, `coach-plan`, `coach-onboarding`, `plan`, `onboarding-redesign`) on the dev server:
**268 passed, 4 skipped, 2 failed** on mobile under six workers (the invite page's first compile
and a plan row past the 5 s default); both passed alone, twice on each viewport.

## Rerun

```bash
# isolated API (from apps/api, after its dist is current)
PORT=3101 APP_URL=http://localhost:3100 CORS_ORIGINS=http://localhost:3100 \
DATABASE_URL=postgres://mentor:mentor@localhost:5433/mentor_test AI_PROVIDER=fake \
VISION_PROVIDER=fake STORAGE_PROVIDER=fake PAYMENTS_PROVIDER=fake POSTMARK_TOKEN= \
node dist/main.js
# web (from apps/web): build against it, then serve on 3100
NEXT_PUBLIC_API_URL=http://localhost:3101/v1 NEXT_PUBLIC_GA_MEASUREMENT_ID= next build
next start --hostname localhost --port 3100
# suite
QA_MENTORSHIP_API_URL=http://localhost:3101/v1 QA_MENTORSHIP_RUN_ID=<6-10 a-z0-9> \
PLAYWRIGHT_BASE_URL=http://localhost:3100 playwright test e2e/qa-mentorship-flows-real-api.spec.ts \
--project=desktop-chromium --project=mobile-chromium --workers=1
```

Not covered here: the coach's side of the weekly report and coach AI in a real-API browser (API
e2e covers them; M10b finalizes through the API and checks the student's side), frozen seats (API
e2e), Firefox/Safari, deployed Cloudflare/Render.
