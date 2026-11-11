# Mentorship — Human Coach Workspace (`modules/mentorship` · W8)

> 1-on-1 human coach ↔ student link (`/kocum`, `/koclar`, `(coach)` workspace): invite codes,
> double opt-in consent, risk-sorted student roster, batch homework assignment, AI cohort/student
> briefs, weekly reports, follow-up decisions, and sponsored student seats.

---

## 1. Overview & Architecture

`MentorshipModule` connects a student with a real human coach (`COACH` role) without violating
PuhuKoç's core trust boundaries:

1. **Strict AI ↔ Human Coach Privacy Line (`AGENTS.md` §4 #5):** A student's conversations with
   **Puhu** (`/koc/sohbet`), raw mood struggle notes, and private notebook text **never** cross into
   `MentorshipModule`. The human coach sees only structured study metrics (focus minutes, streak,
   task completion, mock exam net trends, and dropped-assignment logs).
2. **Naming Clarity (`docs/copy/voice.md`):** In user-facing Turkish copy, **"koç" / "koçun"**
   means the human coach here; the AI companion is always named **Puhu**.
3. **Zero Cross-Table Reads:** `MentorshipModule` owns `coach_students` and `mentorship_*` tables
   under `FORCE ROW LEVEL SECURITY`. It reads student study aggregates via `CoachingModule`'s
   exported services, user display identities via `IdentityModule`, and subscription/seat state via
   `PaymentsModule`.
4. **Relationship-Period Isolation:** Every link has a relationship period (`linkId` / period
   rotation on re-link). Ending or re-linking a student never exposes private notes, briefs,
   follow-ups, or weekly reports from an earlier period.

---

## 2. Core Subsystems & Current Rules

### 2.1 Self-Service Coach Registration & Public Directory (`/koclar`)
- **Self-service registration (`APP-089`):** Any signed-in user can register as a coach via `POST /v1/mentorship/applications` when `mentorship.applications.open = true`. Registration immediately grants the `COACH` role and creates an `ACTIVE` coach profile (no manual pre-approval queue required to start).
- **Admin Oversight:** Admins (`SUPPORT`/`SUPER_ADMIN`) can inspect coaches at `/v1/admin/coaches`, mark `verifiedClaims`, or move a coach to `PENDING`/`SUSPENDED` (which revokes `COACH` and blocks new links).
- **Tier-1 Contact Detector:** Coach-editable bio/headline lines (`PUT /v1/mentorship/applications/mine`) pass through a deterministic contact filter that rejects phone numbers, @handles, URLs, and off-platform messaging invites (`WhatsApp`, `Telegram`, `Instagram`).

### 2.2 Student ↔ Coach Link & Double Opt-In (`/kocum`)
- **Invite Code:** Each active coach has a rotating invite code (`GET /v1/mentorship/overview`, `POST /v1/mentorship/invite-code`), gated by `inviteBlockedReason` (`EMAIL_UNVERIFIED`, `PHONE_UNVERIFIED` when `mentorship.phone_verification_required` is on, or `NOT_ACTIVE`).
- **Transparent Student Consent:** The student previews the invite (`POST /v1/mentorship/invitations/preview`), sees the exact data-sharing contract (what the coach can and cannot see) plus `GET /v1/mentorship/my-coach/data`, and accepts (`POST /v1/mentorship/invitations/accept`). Either side can end the link at any time.

### 2.3 Coach Roster, Risk Triage & Attention Mark
- **Roster (`GET /v1/mentorship/students`):** Sorted worst-first by deterministic rule-based risk flags (`INACTIVE_3D`, `STREAK_BROKEN`, `LOW_TASK_COMPLETION`, `NO_MOCK_RECENTLY`, `NET_DROP`).
- **Attention Mark (`PUT /v1/mentorship/students/:studentId/attention`):** When a coach handles a student's current risk flags, marking `attended: true` silences those exact flags on the roster and in the daily risk digest cron until a new risk signal appears.

### 2.4 Batch Homework, Saved Templates & AI Drafts
- **Assignments (`POST /v1/mentorship/students/:studentId/assignments`):** Assigns 1–21 tasks in one call (`title`, taxonomy `subject`/`topic`, `coachNote`), written via `PlanService.createFromMentorship` with `origin: 'MENTORSHIP'`.
- **Dropped-Assignment Log:** If a student deletes a coach-assigned task, `mentorship_dropped_assignments` records it so the coach's student report shows `"assigned but deleted"` rather than vanishing silently.
- **Saved Templates (`/v1/mentorship/templates`):** Coaches can save reusable weekly task templates and load them into the assignment composer.
- **AI Homework Suggestions (`POST .../assignment-suggestions`):** Uses the coach's AI quota to draft a week of homework into the composer without writing to the database until the coach reviews and submits.

### 2.5 Coach AI Briefs, Weekly Reports & Follow-Ups
- **Cohort & Student Briefs (`POST /v1/mentorship/brief`, `POST .../students/:id/brief`):** Summarizes roster-wide or single-student progress with rule-computed `delta` since the previous brief. Free coaches get a daily taste (`ai.features.mentorship.*.free_enabled`) for students covered by their free seats, bounded per coach per day under `ai.budget.monthly_cap_usd_cents`.
- **Immutable Weekly Reports (`/v1/mentorship/students/:id/weekly-reports/*`):** Preview live metrics + optional `coachContext` (`<=500` chars) → queue AI preparation brief (`202`) → `finalize` an immutable versioned snapshot → export a print/PDF-safe `share` projection (which strips private coach notes, raw evidence IDs, and preparation prompts).
- **Follow-Up Decisions (`/v1/mentorship/followups/*`):** Version-checked coach actions/decisions with optional student-shared visibility (`ACCEPTED` / `CHANGE_REQUESTED` response by the student on `/kocum`).

### 2.6 Coach Seats & Sponsored Premium (`APP-076`, `APP-079`, `APP-089`)
- **Seat Allowance:** A coach gets `mentorship.coach.free_seats` plus any paid seats from a coach subscription plan (`coach-plus-5/10/20`, where `plans.seat_count > 0`). Self-paying Premium students do not consume a coach's seat (`listSelfPayingUserIds`).
- **Sponsored Seat Security Gate (Binding):** Because coach registration is self-service, `mentorship.seats.sponsorship_enabled` **must remain `false` until SMS OTP is live**. Even when enabled, `SponsoredSeatService.grant` centrally verifies that **both** coach and student have `ACTIVE` verified phones. Sponsored subscriptions use `provider = 'SPONSOR'` and `plan_id = 'coach-seat'` (price 0, never burns the student's own carded trial).

---

## 3. Flag Runbook

| Config Key | Default | Purpose |
|---|---|---|
| `mentorship.enabled` | `false` | Master switch for coach workspace and `/kocum` student routes |
| `mentorship.applications.open` | `false` | Allows self-service coach registration & `/koclar` signup |
| `mentorship.phone_verification_required` | `false` | Requires verified phone on coach accounts before inviting/accessing students |
| `mentorship.coach.max_active_students` | `25` | Hard roster cap per coach |
| `mentorship.coach.free_seats` | `3` | Free student seats per coach |
| `mentorship.seats.sponsorship_enabled` | `false` | **Keep `false` until SMS OTP is live.** Grants sponsored Premium to seated students |
| `mentorship.seats.billing_enabled` | `false` | Enables web checkout for `coach-plus-*` plans |
| `mentorship.weekly_reports.enabled` | `false` | Enables weekly report preview/finalize/share endpoints |
| `mentorship.followups.enabled` | `false` | Enables coach/student follow-up decision tracking |

---

## 4. API Surface

| Method & Path | Role / Guard | Purpose |
|---|---|---|
| `POST\|GET\|PUT /v1/mentorship/applications/*` | Auth / `COACH` | Self-service coach registration & public bio editing |
| `GET /v1/mentorship/overview`, `POST .../invite-code` | `COACH` | Roster summary, seat usage, invite block reason, code rotation |
| `GET /v1/mentorship/students`, `GET\|DELETE .../students/:id` | `COACH` + Active Link | Risk-sorted roster and single-student report |
| `POST /v1/mentorship/students/:id/assignments{,-suggestions}` | `COACH` + Active Link | Batch homework assignment (1–21 tasks) & AI draft suggestions |
| `PUT /v1/mentorship/students/:id/{note,attention}` | `COACH` + Active Link | Standing note for student and risk-flag attention mark |
| `GET\|POST /v1/mentorship/{brief,students/:id/brief*}` | `COACH` + Active Link | Cohort and per-student AI briefs + brief history |
| `GET\|POST\|DELETE /v1/mentorship/templates/*` | `COACH` | Saved weekly homework templates |
| `GET\|POST /v1/mentorship/students/:id/weekly-reports/*` | `COACH` + Active Link | Weekly report preview, AI brief, immutable finalize, and share view |
| `GET\|POST\|PATCH /v1/mentorship/followups/*` | `COACH` / Student | Coach follow-up inbox and student shared decision responses |
| `POST /v1/mentorship/invitations/{preview,accept}` | Student | Preview data contract and accept coach invite code |
| `GET\|DELETE /v1/mentorship/my-coach`, `GET .../my-coach/data` | Student | Student's `/kocum` view and live shared-data mirror |

---

## 5. Geliştirmeler (Condensed Milestone Timeline)

- **2026-11-09 — Phase 2.4 Mobile Human Coach Workspace & Student `MyCoach` Flow (`apps/mobile`):** Implemented `apps/mobile/src/lib/mentorship-api.ts`, the Human Coach mobile screens (`apps/mobile/src/app/(app)/(tabs)/{students,coach-profile}.tsx` + `src/components/mentorship/{coach-overview-header,student-report-panel}.tsx` for seat usage, rotating invite code, cohort/student AI briefs, risk-sorted roster, attention marks, standing notes, homework task assignment, and profile editing), and the Student's `MyCoachCard` (`apps/mobile/src/components/settings/my-coach-card.tsx` for transparent KVKK `dataScope` preview, double opt-in invite acceptance, note exchange, and link termination).
- **2026-10-15 — Phone-Optional Coach Rollout Controls:** Decoupled `mentorship.phone_verification_required` from `SMS_PROVIDER` and exposed authoritative `inviteBlockedReason` on coach registration views.
- **2026-09-26..27 — Coach Seat Plans (`coach-plus-5/10/20`) & Free Coach AI Taste:** Added `SeatEventsListener` to reseat students on subscription lifecycle events, excluded self-paying students from consuming coach seats, and enabled per-coach daily free AI tastes for seated students.
- **2026-09-14..21 — Weekly Reports, Meeting Preparation & Planning Read:** Shipped immutable versioned weekly reports (`preview`/`brief`/`finalize`/`share`), `coachContext` meeting preparation prompts, coach-student notifications, and `GET .../planning-tasks` 7-day read.
- **2026-09-10..12 — Dedicated Coach App Shell & Follow-Ups:** Built the `(coach)` navigation shell (`--coach-accent` teal, `GraduationCap`) and versioned `followups` decision workflow.
- **2026-09-05..08 — Sponsored Seats, Intelligence Layer & Self-Service Registration (`APP-076–APP-089`):** Shipped sponsored student seats (`SPONSOR` provider), `/v1/admin/metrics/sponsorship` cost tracking, cohort/student AI briefs, AI homework drafts, student data-sharing mirror (`/my-coach/data`), Tier-1 contact filter, and self-service coach registration.
- **2026-08-18..31 — W8 Foundation (`APP-070–APP-075`):** Shipped `coach_students` double opt-in link, risk-sorted roster, 1–21 task batch assignment with `coach_note`, dropped-assignment log, saved program templates, and daily risk digest cron.
