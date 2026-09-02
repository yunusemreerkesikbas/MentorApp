# Mentorship (human coach)

> The coach↔student relation: invite code, double opt-in, roster, transparency view.
> Module: `modules/mentorship`. Workstream: W8. Roadmap: Phase 2 (§9 BYOS).
> **Not the AI coach.** `coach_conversations` / `coach_messages` / `coach_profiles` / `/v1/coach/*`
> / web `/koc` all belong to Puhu (W3, [ai.md](./ai.md)). The human coach lives under `mentorship`.

## Overview

A coach issues one rotating invite code; a student redeems it and the link becomes ACTIVE. That
exchange **is** the double opt-in (§9): issuing the code is the coach's consent, redeeming it is the
student's. There is no separate coach-approval step, and no student is ever linked without acting.

From that link the coach gets, in this slice, a roster. The metrics and the report arrive with the
next slice; the assignment surface with the one after. What the coach can *ever* see is already
fixed and shipped as a contract: `MENTORSHIP_DATA_SCOPE` in `@mentor/types`, rendered verbatim on
the consent screen and on the student's `/my-coach` view.

Communication is deliberately absent. In Phase 2 the coach and student talk off-platform; in-app
chat is Phase 3 (roadmap §9). The app is the tracking tool, not the channel.

## Architecture (key decisions)

- **Bounded context** `apps/api/src/modules/mentorship/**` (domain/application/infrastructure/
  presentation). Imports `IdentityModule` only. It never reads another module's tables; coaching
  data will reach the coach through coaching's own exported aggregate services.
- **`coach_students` is reused, not renamed.** The table has existed since `drizzle/0001` (guardrail
  §4 #7, "org/coach-ready from day one") and has always meant the human relation. Renaming an empty
  table to match a namespace would cost a risky migration and a drizzle snapshot divergence for no
  behavioural gain. Everything *new* is `mentorship_*`.
- **One authorization gate.** `MentorshipLinkService.requireActiveLink(coachId, studentId)` is the
  single door for every coach→student read and write. It is a **service, not a guard**, on purpose:
  `RolesGuard` lets ADMIN/SUPER_ADMIN satisfy any `@Roles()` (`roles.guard.ts:24`), so a
  guard-shaped check would hand every admin every student's data. The gate grants no such exemption.
- **Missing link is 404, never 403** — a 403 confirms that the student id exists.
- **No RLS policy on `coach_students` / `mentorship_invite_codes`** — cross-user relations follow the
  `buddy_pairs` / `study_room_members` pattern: SERVICE context plus application-layer scoping.
  Student behavioural tables (`plan_tasks`, `daily_activity`, `mood_checkins`, …) keep their existing
  self-or-service policies untouched; widening 20+ policies with an `EXISTS (coach_students …)`
  subquery would spread the authorization decision instead of concentrating it.
- **One active coach per student**, enforced by the partial unique index
  `coach_students_one_active_coach_idx` — an invariant in the database, not a hope in a service.
- **Re-linking revives the ENDED row** (`onConflictDoUpdate` with `setWhere: status = 'ENDED'`)
  rather than inserting a duplicate, because `coach_students_pair_idx` is unique on the pair.
- **The invite code has no use counter.** The abuse bound is the coach's active-student quota
  (`mentorship.coach.max_active_students`), checked on redemption. A second counter would only be a
  second thing to keep correct.
- **Codes travel in the request body, not the path.** An invite code is a bearer secret; URLs land
  in access logs, referrers and browser history. Preview and accept are throttled (10/min, 5/min).
- **Quota overflow is an error, not a paywall** (`MENTORSHIP_STUDENT_QUOTA_EXCEEDED`, 409). Seat
  billing is a later decision, and a paywall now would promise a purchase flow that does not exist.
- **COACH is granted through the existing role endpoint.** `ASSIGNABLE_ROLES` (new in
  `@mentor/types`) = the admin sub-roles + COACH, so `POST /v1/admin/users/:id/roles/COACH` and the
  admin UI's role toggles work with no new endpoint and no new screen. COACH is absent from
  `ADMIN_PANEL_ROLES`, so granting it never opens the admin panel (§9 "delegated authority is not
  admin access"). Coach onboarding is curation, not open registration (§5) — this is the curation.

## Tutorials / Guides

```bash
docker compose up -d
pnpm --filter @mentor/api db:migrate
pnpm --filter @mentor/api exec vitest run mentorship          # unit + e2e

# The flag is OFF by default — turn it on from the admin config screen or:
#   POST /v1/admin/config  { "key": "mentorship.enabled", "value": true }   (SUPER_ADMIN)
# Make someone a coach:
#   POST /v1/admin/users/:userId/roles/COACH                                (SUPER_ADMIN, audited)
#   The coach must re-login: roles are read from the DB on refresh, not patched into a live JWT.
```

```http
### Coach
GET    /v1/mentorship/invite-code                  -> { code, expiresAt } | (empty = none yet)
POST   /v1/mentorship/invite-code                  -> rotates; the previous code stops working
GET    /v1/mentorship/students?status=ACTIVE|ENDED -> Paginated<MentorshipStudentDto>
DELETE /v1/mentorship/students/:studentId          -> 204

### Student (no role required)
POST   /v1/mentorship/invitations/preview  { code } -> { coachDisplayName, coachUsername, dataScope }
POST   /v1/mentorship/invitations/accept   { code } -> MyCoachDto
GET    /v1/mentorship/my-coach                      -> MyCoachDto | (empty = no coach)
DELETE /v1/mentorship/my-coach                      -> 204
```

## API

| Endpoint | Purpose |
|---|---|
| `GET/POST /v1/mentorship/invite-code` | Read or rotate the coach's single invite code (`@Roles(COACH)`) |
| `GET /v1/mentorship/students` | Roster + rule-based risk flags, worst first; `?status=ENDED` for history |
| `GET /v1/mentorship/students/:studentId` | One student's report (gate applies) |
| `DELETE /v1/mentorship/students/:studentId` | Coach ends the link (gate applies) |
| `POST /v1/mentorship/invitations/preview` | Consent screen input: who the coach is + the exact data scope |
| `POST /v1/mentorship/invitations/accept` | Student's half of the double opt-in → ACTIVE |
| `GET /v1/mentorship/my-coach` | Student transparency: who my coach is, what they see |
| `DELETE /v1/mentorship/my-coach` | Student revokes consent, unilaterally (KVKK) |

Error codes: `MENTORSHIP_DISABLED` · `MENTORSHIP_LINK_NOT_FOUND` · `MENTORSHIP_INVITE_INVALID` ·
`MENTORSHIP_INVITE_EXPIRED` · `MENTORSHIP_ALREADY_LINKED` · `MENTORSHIP_STUDENT_QUOTA_EXCEEDED` ·
`MENTORSHIP_SELF_LINK`.

Config: `mentorship.enabled` (flag, default **false**) · `mentorship.coach.max_active_students`
(20) · `mentorship.invite_code.ttl_days` (14) · `mentorship.risk.inactive_days` (3) ·
`mentorship.risk.plan_completion_floor` (0.5) · `mentorship.risk.low_mood_ceiling` (2).

## Risk triage

Rule-based, not AI. Roadmap §9 calls the AI brief a later layer, and a coach acting on a
hallucinated "this student is struggling" is worse than no signal. Rules live in
`domain/risk-flags.ts` (pure, 18 unit tests); thresholds are config, so they calibrate from live
data without a deploy.

| Flag | Fires when | Threshold key |
|---|---|---|
| `INACTIVE` | No completed session or done task for longer than the idle window (a student who never started counts) | `mentorship.risk.inactive_days` |
| `LOW_MOOD` | Weekly mean check-in at or below the ceiling | `mentorship.risk.low_mood_ceiling` |
| `NET_DROP` | Latest mock net strictly below the mean of the three before it | — |
| `PLAN_SLIPPING` | Weekly plan completion below the floor | `mentorship.risk.plan_completion_floor` |

Two silences are deliberately NOT flagged: a student who planned nothing (`planCompletionRate7d`
is null, not zero) and one who never checked in. Absence of data is not evidence of trouble, and a
flag that cries wolf costs the coach more than it gives.

## Geliştirmeler (timeline)

- **Koç↔öğrenci bağı — W8 dilim 1 (APP-063, 2026-09-02)** — `UserRole.COACH` ve `coach_students`
  0001'den beri şemada duruyordu ama hiç kullanılmıyordu; bu dilim onları çalıştırdı. Davet kodu
  (`mentorship_invite_codes`, koç başına tek dönen kod), çift opt-in kabul, roster, öğrenci şeffaflık
  görünümü ve iki taraflı sonlandırma. Migration `0093_w8_mentorship`: `coach_students`'a
  `accepted_at`/`ended_at`/`ended_by` + ters yön index'i + status/source check'leri + öğrenci başına
  tek aktif koç kısmi unique index'i.
  **Kullanım:** flag `mentorship.enabled` varsayılan kapalı; admin config ekranından açılır. COACH
  rolü `POST /v1/admin/users/:id/roles/COACH` (SUPER_ADMIN, audit'li) veya admin kullanıcı detay
  ekranındaki rol butonlarından verilir.
  **Gotchas:** (1) Rol verdikten sonra koç **yeniden giriş yapmalı** — roller JWT'ye refresh anında
  DB'den okunuyor, canlı token'a yamalanmıyor. (2) `@Roles(COACH)` tek başına yetki değil;
  `requireActiveLink` her öğrenci-kapsamlı çağrının kapısı ve ADMIN muafiyeti tanımıyor —
  e2e'de SUPER_ADMIN'in roster'ı boş dönüp öğrenciye erişemediği test ediliyor. (3) Davet kodu
  path'te değil **body**'de; URL'ler access log'a ve referrer'a düşüyor. (4) Koçun gördüğü veri
  kümesi `MENTORSHIP_DATA_SCOPE` sabitiyle sözleşme haline getirildi ve onay ekranında birebir
  gösteriliyor; e2e'de roster yanıtında `email`/`struggleNote`/`bio` gibi alanların geçmediği
  sentinel testiyle doğrulanıyor.
  **İlgili:** `apps/api/src/modules/mentorship/**`, `apps/api/drizzle/0093_w8_mentorship.sql`,
  `packages/types/src/mentorship.ts`, `packages/validation/src/mentorship.ts`,
  `apps/api/test/mentorship.e2e-spec.ts`, `apps/admin/src/lib/roles.ts`.

- **Koç roster'ı, risk triyajı ve öğrenci raporu (APP-064, 2026-09-02)** — Dilim 1'in kimlik-only
  listesi gerçek panele dönüştü: `GET /v1/mentorship/students` artık aktivite/deneme/plan/mod
  agregalarını ve kural-temelli risk flag'lerini en kötü üstte sıralı döndürüyor;
  `GET /v1/mentorship/students/:studentId` tek öğrenci raporunu veriyor. Web tarafında `(coach)`
  route group'u (TR `/kocluk`), öğrenci tarafında `/kocum` şeffaflık ekranı ve `/kocluk-daveti`
  onay akışı.
  **Kullanım:** koç sidebar'da "Öğrencilerim" item'ını görür (rol-koşullu; `apps/web`'de rol ilk kez
  burada okunuyor). Öğrenci `/kocum`'da koçunun tam olarak neyi görüp neyi göremediğini okur;
  liste API'nin `dataScope` alanından gelir, arayüzde sabit değildir.
  **Gotchas:** (1) `(coach)` grubu `(app)`'ten hiçbir şey import etmez — roadmap §9'daki
  `apps/panel` taşıması bu tek yönlü ok sayesinde kopyala-yapıştır kalır. (2) Route group URL'e
  girmez: klasör `(coach)/students` olduğu için dahili yol `/students`, TR URL'i `pathnames`
  üzerinden `/kocluk`. `/koc` (AI koç sohbeti) ile çakışmaz. (3) `?code=` yalnızca alanı doldurur;
  ne sorgu atar ne kabul eder. Birinin gönderdiği linke tıklamak rıza değildir. (4) Risk chip'leri
  `normal-case` ile render edilir; `Chip` varsayılan olarak her kelimeyi büyütür ve "Plan Aksıyor"
  Türkçede hata gibi okunur. (5) Roster sıralaması sayfa içindedir, kohort genelinde değil.
  **İlgili:** `apps/web/src/app/[locale]/(coach)/**`, `apps/web/src/app/[locale]/(app)/{my-coach,coach-invitation}/**`,
  `apps/web/src/lib/mentorship.ts`, `modules/mentorship/{domain/risk-flags.ts,application/mentorship-roster.service.ts}`,
  [`coaching.md`](./coaching.md) (`CohortEvidenceService`).

## Gotchas / Known issues

- **Role changes need a re-login.** `TokenService.loadPrincipal` re-reads roles on refresh, so a
  freshly granted COACH sees the surface only after their next refresh or login.
- **Empty 200, not `null` JSON.** `GET /invite-code` and `GET /my-coach` return an empty body when
  there is nothing. The shared `http()` client already tolerates this (`res.json().catch(…)`).
- **The gate is easy to forget.** Any future service reading student data on a coach's behalf must
  call `requireActiveLink` first. It is exported from `MentorshipModule` for exactly that reason.
- **Erasure deletes links, it does not anonymize them.** A relation is a fact about two people;
  keeping a dangling half after one exercises erasure serves nobody. The counterpart simply loses
  the link, as if it had been ended.

## Backlog

- Coach-assigned homework via `plan_tasks` origin `MENTORSHIP` (slice 3).
- AI "smart brief" on top of the rule-based triage (roadmap §9). The rules stay as the floor.
- Whole-cohort risk ranking. Today a page is sorted, not the cohort; fine to 100 students a page.
- Notifications on link accepted/ended (`NotificationCategory.MENTORSHIP`).
- Seat billing beyond the free quota; the quota knob is already in the config registry.
- Coach vetting queue (application + document). Today: manual, curated role grant.
- Minors: KVKK parental consent for under-18 students. `users` carries no birth date; this slice
  assumes 18+ (KPSS/YKS). Must be settled before LGS opens (roadmap §0).
- Move the surface to `apps/panel` when the coach cohort justifies its own app (roadmap §9).

## Related

- [identity.md](./identity.md) — owns `users`/`coach_students` schema block; `UsersService.listDisplayIdentities` is the seam W8 uses.
- [ai.md](./ai.md) — the AI coach, which owns the `coach_*` namespace this module deliberately avoids.
- [coaching.md](./coaching.md) — where the student data a coach will see actually lives.
- [admin.md](./admin.md) — role assignment + audit trail.
