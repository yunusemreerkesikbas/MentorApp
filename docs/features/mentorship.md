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
next slice; the assignment surface with the one after. What the coach can _ever_ see is already
fixed and shipped as a contract: `MENTORSHIP_DATA_SCOPE` in `@mentor/types`, rendered verbatim on
the consent screen and on the student's `/my-coach` view. The one thing a coach _writes_ into the
student's world is an assignment, and `plan_tasks.coach_note` carries their instruction with it —
their words, read back only to them, never mixed into the student's own `description`.

Communication is deliberately absent. In Phase 2 the coach and student talk off-platform; in-app
chat is Phase 3 (roadmap §9). The app is the tracking tool, not the channel.

## Architecture (key decisions)

- **Bounded context** `apps/api/src/modules/mentorship/**` (domain/application/infrastructure/
  presentation). Imports `IdentityModule` only. It never reads another module's tables; coaching
  data will reach the coach through coaching's own exported aggregate services.
- **`coach_students` is reused, not renamed.** The table has existed since `drizzle/0001` (guardrail
  §4 #7, "org/coach-ready from day one") and has always meant the human relation. Renaming an empty
  table to match a namespace would cost a risky migration and a drizzle snapshot divergence for no
  behavioural gain. Everything _new_ is `mentorship_*`.
- **Ending a link stops the data, not just the badge.** The roster's metrics live in a nullable
  `metrics` sub-object that is `null` for any non-ACTIVE link, so "a coach who no longer follows
  this student sees no numbers" is enforced by the DTO shape rather than remembered by whoever
  edits the mapper next. `listCohortSnapshots` is called only with the ACTIVE students' ids.
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
#   No re-login needed since APP-080: JwtAuthGuard resolves the principal through
#   TokenService.validateSession, which joins `users` on every request, so the role is live
#   at once. Curation now runs through the application queue instead
#   (POST /v1/mentorship/applications -> admin /coach-applications); this endpoint stays as
#   the manual override.
```

## Going live — the flag order

Five flags, and the order is the whole point. Turning `mentorship.enabled` on first opens a screen
that cannot work: a student who redeems a code before any coach exists gets "invalid code", and the
surface is a promise nobody can keep. Each step below is one `POST /v1/admin/config` (SUPER_ADMIN,
audited) or one admin screen.

| #   | Step                                          | What it opens                                                                                                 | Cost                                 | Turning it back off                                                                                                          |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | `mentorship.applications.open = true`         | Self-service coach registration: `/kayit?rol=koc` and the form at `/koc-basvurusu`. **Students see nothing.** | None                                 | Clean. Existing coaches stay; the form says "closed".                                                                        |
| 2   | `mentorship.enabled = true`                   | The coach panel and the student's invite screen.                                                              | None                                 | Clean, and immediate: every W8 endpoint calls `assertEnabled` first. Existing links survive, they just stop being reachable. |
| 3   | `mentorship.risk_digest.enabled = true`       | The 07:00 UTC morning email. Do this **after** a cohort exists.                                               | Email volume                         | Clean.                                                                                                                       |
| 4   | **SMS OTP shipped**                           | Nothing by itself. It is the PREREQUISITE for step 5.                                                         | A provider bill                      | n/a                                                                                                                          |
| 5   | `mentorship.seats.sponsorship_enabled = true` | Coach-sponsored Premium. **Spends money.**                                                                    | `coaches x free_seats` in LLM budget | **NOT clean — see below.**                                                                                                   |

**Step 4 is not optional, and it is new (APP-089).** Approval used to bound the coach count: a
human said yes to each one, so `coaches x free_seats` had a person in front of it. Registration is
self-service now, so that number is bounded by how many verified email addresses somebody can
produce, which is not a bound. Email verification stops nothing here — free addresses are
unlimited — and SMS is the first thing that costs an attacker anything per account. Until it
ships, `sponsorship_enabled = false` IS the defence.

**Before step 5, read `GET /v1/admin/metrics/sponsorship`.** It reports live seats, the setting, and
the cohort's 30-day LLM cost per seat — the number `mentorship.coach.free_seats` is calibrated
against. It exists precisely so this flag is not flipped on a guess (APP-077).

**Two knobs at step 5, two different severities, and neither is the other's undo:**

- `mentorship.seats.sponsorship_enabled = false` is the **emergency brake**: it expires live seats
  immediately, not just future ones. An operator hitting it means "now", not "from the next student".
  Turning it back on does not restore them — the seat decision is made at accept time.
- `mentorship.coach.free_seats` lowered is **not retroactive**: it shapes who gets a seat next, it
  does not take back one already granted. Deciding which existing seats to revoke would be arbitrary.

**Rollback of the whole surface** is step 3 alone: `mentorship.enabled = false` closes every door in
one config write. Links, applications and assignments are untouched — nothing is deleted by a flag.

```bash

```

```http
### Coach
GET    /v1/mentorship/overview                     -> { inviteCode, activeStudents, maxActiveStudents, dataScope }
POST   /v1/mentorship/invite-code                  -> rotates; the previous code stops working
GET    /v1/mentorship/students?status=ACTIVE|ENDED -> Paginated<MentorshipRosterRowDto>
PUT    /v1/mentorship/students/:studentId/note     -> 204  { body: string | null }
DELETE /v1/mentorship/students/:studentId          -> 204
GET    /v1/mentorship/templates                    -> MentorshipProgramTemplateDto[]
POST   /v1/mentorship/templates                    -> upsert by name (saving over a name IS the edit)
DELETE /v1/mentorship/templates/:templateId        -> 204
GET    /v1/mentorship/brief                        -> MentorshipCohortBriefDto | (empty = never written)
POST   /v1/mentorship/brief                        -> writes one; unchanged cohort returns the stored text
POST   /v1/mentorship/students/:id/assignment-suggestions -> a week of drafts for the composer (writes nothing)

### Student (no role required)
POST   /v1/mentorship/invitations/preview  { code } -> { coachDisplayName, coachUsername, dataScope }
POST   /v1/mentorship/invitations/accept   { code } -> MyCoachDto
GET    /v1/mentorship/my-coach                      -> MyCoachDto | (empty = no coach)
GET    /v1/mentorship/my-coach/data                 -> MentorshipSharedDataDto | (empty = no coach)
DELETE /v1/mentorship/my-coach                      -> 204
```

Web'de öğrencinin akışa giriş noktası **profil → "Koçum"** (`/profil` → `/kocum`); oradan koçu
yoksa `/kocluk-daveti`'ye geçer. Koç davet kartından kodu ya da `?code=` taşıyan hazır linki
kopyalar; link yalnız alanı doldurur, kabul gene öğrencinin iki adımıdır.

## API

| Endpoint                                                         | Purpose                                                                                                                                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/mentorship/overview`                                    | The coach's landing state: invite code, seats taken out of the cap, and the data-scope contract mirrored back to them (`@Roles(COACH)`)                                      |
| `POST /v1/mentorship/invite-code`                                | Rotate the code; the previous one stops working immediately (`@Roles(COACH)`)                                                                                                |
| `GET /v1/mentorship/students`                                    | Roster + rule-based risk flags, worst first; `?status=ENDED` for history                                                                                                     |
| `GET /v1/mentorship/students/:studentId`                         | One student's report (gate applies)                                                                                                                                          |
| `POST /v1/mentorship/students/:studentId/assignments`            | Assign 1..21 plan tasks in one call — title, subject, `topic`, `coachNote` (gate applies)                                                                                    |
| `PUT /v1/mentorship/students/:studentId/note`                    | The coach's standing note to this student; `{ body: null }` clears it (gate applies)                                                                                         |
| `DELETE /v1/mentorship/students/:studentId`                      | Coach ends the link (gate applies)                                                                                                                                           |
| `GET /v1/mentorship/templates`                                   | The coach's saved weekly programs (`@Roles(COACH)`)                                                                                                                          |
| `POST /v1/mentorship/templates`                                  | Save a program, upserting on `(coach, name)` — there is no PUT because saving over a name is the edit                                                                        |
| `DELETE /v1/mentorship/templates/:templateId`                    | Delete one of the coach's own; another coach's id is a 404                                                                                                                   |
| `GET /v1/mentorship/brief`                                       | The stored cohort brief. Free — no LLM call, no quota, so the panel may ask on load (`@Roles(COACH)`)                                                                        |
| `POST /v1/mentorship/brief`                                      | Write one. Unchanged cohort returns the stored text and spends nothing (`@Roles(COACH)`, 10/min)                                                                             |
| `POST /v1/mentorship/students/:studentId/assignment-suggestions` | A week of AI-drafted homework for the composer. Writes nothing; uncached (gate applies, 10/min)                                                                              |
| `POST /v1/mentorship/invitations/preview`                        | Consent screen input: who the coach is + the exact data scope                                                                                                                |
| `POST /v1/mentorship/invitations/accept`                         | Student's half of the double opt-in → ACTIVE                                                                                                                                 |
| `GET /v1/mentorship/my-coach`                                    | Student transparency: who my coach is, what they see                                                                                                                         |
| `GET /v1/mentorship/my-coach/data`                               | The same contract with the actual figures in it: how much is travelling under each scope key. No coach-authored field can appear — the snapshot is fetched without a link id |
| `DELETE /v1/mentorship/my-coach`                                 | Student revokes consent, unilaterally (KVKK)                                                                                                                                 |

Error codes: `MENTORSHIP_ASSIGNMENT_TOO_FAR` · `MENTORSHIP_DISABLED` · `MENTORSHIP_LINK_NOT_FOUND` · `MENTORSHIP_INVITE_INVALID` ·
`MENTORSHIP_INVITE_EXPIRED` · `MENTORSHIP_ALREADY_LINKED` · `MENTORSHIP_STUDENT_QUOTA_EXCEEDED` ·
`MENTORSHIP_SELF_LINK` · `MENTORSHIP_TEMPLATE_NOT_FOUND` · `MENTORSHIP_TEMPLATE_QUOTA_EXCEEDED`.

Config: `mentorship.enabled` (flag, default **false**) · `mentorship.coach.max_active_students`
(20) · `mentorship.invite_code.ttl_days` (14) · `mentorship.risk.inactive_days` (3) ·
`mentorship.risk.plan_completion_floor` (0.5) · `mentorship.risk.low_mood_ceiling` (2) ·
`mentorship.risk_digest.enabled` (flag, default **false**) ·
`mentorship.risk_digest.repeat_after_days` (7).

Cron: `POST /v1/internal/cron/dispatch-mentorship-risk-digest` (`CronSecretGuard`, 07:00 UTC) —
the coach's daily risk digest. Only pairs the previous digest did not carry are worth sending.

## Risk triage

Rule-based, not AI. Roadmap §9 calls the AI brief a later layer, and a coach acting on a
hallucinated "this student is struggling" is worse than no signal. Rules live in
`domain/risk-flags.ts` (pure, 18 unit tests); thresholds are config, so they calibrate from live
data without a deploy.

| Flag            | Fires when                                                                                             | Threshold key                           |
| --------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `INACTIVE`      | No completed session or done task for longer than the idle window (a student who never started counts) | `mentorship.risk.inactive_days`         |
| `LOW_MOOD`      | Weekly mean check-in at or below the ceiling                                                           | `mentorship.risk.low_mood_ceiling`      |
| `NET_DROP`      | Latest mock net strictly below the mean of the three before it                                         | —                                       |
| `PLAN_SLIPPING` | Weekly plan completion below the floor                                                                 | `mentorship.risk.plan_completion_floor` |

Two silences are deliberately NOT flagged: a student who planned nothing (`planCompletionRate7d`
is null, not zero) and one who never checked in. Absence of data is not evidence of trouble, and a
flag that cries wolf costs the coach more than it gives.

## Geliştirmeler (timeline)

- **2026-09-12 — `/kocluk` redesign: sinyal dili, tek birincil eylem, taşınan sözleşme.**
  Tasarım incelemesi dört yerde takıldı ve dördü de yerleşim değil karar sorunuydu.

  **Çip sistemi anlam taşımıyordu.** Dört ayrı KİND aynı mor `Chip`'i giyiyordu: bir kişi
  hakkındaki risk bayrağı, kohort genelinde bir sayım, "Yeni", ve durum. Dört anlam tek biçimde
  olunca hiçbiri kendisi gibi okunmuyor; en kötüsü iki bayrak taşıyan bir satırda, çünkü gözün
  onları ayıracak hiçbir şeyi kalmıyor. Artık ayrımı **renk değil biçim** taşıyor:
  bayrak = ince çerçeve + sinyali adlandıran 6px nokta (`SignalPill`); sayım = hap değil, tabular
  sayı + nokta (`SignalCount`); "Yeni" = aksan renginde mikro hap (`NewBadge`); "Yolunda" = hap
  bile değil, sessiz metin (`CalmLabel`). Nokta rengi **kimlik** taşıyor, sıra değil — sıralamayı
  roster zaten yapıyor, ve hiçbir öğrenci kırmızıya boyanmıyor.

  **Token'lar `(coach)` yüzeyine yerel** (`_components/coach-signals.css`, kabuğun dış
  elemanındaki `.coach-signals` sınıfına kapsanmış). `@mentor/ui`'ye girmediler: bunlar ürün
  paleti değil triyaj sözcükleri, ve tek bir rota grubunun okuduğu bir token paylaşılan temada
  taşınacak ikinci bir şey olurdu. **Koyu tema override'ı yok, ve bu unutma değil ölçüm:** dördü
  de orta tonlu, dolayısıyla koyu zemin (#1a1d24) onlara beyazdan **daha çok** ayrışma veriyor
  (5.8:1, 5.9:1, 7.7:1, 7.0:1).

  **`SectionHeading` gitti.** "Öğrencilerim" koçun az önce tıkladığı nav öğesini tekrar ediyordu,
  alt satır da listenin zaten gösterdiği sıralamayı anlatıyordu — sayfadaki tek şeyin üstünde iki
  satır kroşe. `roster_title` / `roster_subtitle` kullanımdan düştü.

  **Sayı bandı artık `Card` değil.** İçeriği tek cümle ve birkaç sayıydı — üzerinde eylem
  yapılacak bir nesne değil bir ölçüm — ve kart çerçevesi onu brifingle roster arasında okunacak
  üçüncü bir şey gibi gösteriyordu. (`cohort-summary-card.tsx` -> `cohort-summary-band.tsx`;
  `cohort-summary.ts` ve 147 satırlık spec'i hiç açılmadı.)

  **Roster satırı üç yığılı şerit olmaktan çıktı.** Tek hairline altında bir bant: solda tek
  cümlelik öneri, sağda "İlgilendim". Bant yalnız yapılacak bir şey varken duruyor; sakin öğrenci
  hap, öneri ve düğme almıyor. Bandın metin yuvası **işaretten önce öneriyi, sonra okumayı**
  taşıyor — ikisi alternatif, ve koç eylemi yaptıktan sonra öneri gösterilecek yanlış cümle.
  Bu yüzden `AttentionButton` okuma satırını bıraktı (`AttentionStatus` ayrıldı): kendi satırını
  taşıyan bir düğme ikisini birden dayatırdı.

  **Davet kartı: tek birincil eylem, maskeli kod, onaylı rotasyon.** Kart eskiden copy /
  copy-link / rotate'i eşit ağırlıkta sunuyordu; koçun fiilen gönderdiği şey link, o yüzden buton
  o oldu. Kod **bearer secret**: onu okuyan kişi öğrenci olarak bağlanabiliyor, ve kopyalamak için
  görmeye gerek yok — artık maskeli duruyor, "Göster" bilinçli bir eylem, kopyalama her zaman
  gerçek kodu veriyor. Rotasyon geri alınamaz ve **öğrencilerin elindeki her kopyayı** öldürür;
  karttaki en sessiz kontrolün tek tıkına asılamayacak kadar ağır, o yüzden `useMentorDialog()`
  onayının arkasına alındı (emsal: `student-report-shell.tsx` bağ sonlandırma). İlk kodu
  **üretmek** onay istemiyor: hiçbir şeyi geçersizleştirmiyor, ve öğrenilip geçilen bir prompt
  asıl riskli basışta hiç yokmuş kadar kötü.

  **Veri kapsamı sözleşmesi `/ayarlar`'a taşındı.** Rail'de kalıcı bir akordeondu; bir onay
  sözleşmesi koç işe başlarken bir kez, sonra merak ettikçe okunur. Artık koç için Ayarlar'da tek
  satır, `@mentor/ui` `Modal` (native `<dialog>`, top layer) açıyor. `dataScope` **satıra
  basılınca** okunuyor, mount'ta değil: Ayarlar'ı öğrenci koçtan çok daha sık açıyor.
  `isCoach(user)` kapısı gerçek: uç `@Roles(COACH)`, öğrenciye gösterilse 403'e açılan bir kapı
  olurdu.

  **Usage:** koç login -> `/kocluk`. Sözleşme: `/ayarlar` -> "Öğrencinde neyi görürsün".

  **Gotchas:**
  (1) **`(coach)` -> `(app)` import etmez, ters yön serbest.** Kapsam kartı `(app)/profile/
_components` altında ve `src/lib/mentorship.ts`'i çağırıyor; o dosya zaten uygulama geneli, yeni
  bir sınır açmıyor. `(app)` layout'u `pickMessages` kullanmadığı için `mentorship` namespace'i
  orada hazır — `route-message-scopes.json` açılmadı.
  (2) **Kart ve düğme dolgusu artboard'u değil primitive'i izliyor.** Tasarım roster kartına 20px
  (mobilde 16) ve 36px sessiz düğme veriyor; `Card` `p-6`, `Button` `px-6 py-3`. Tailwind aynı
  aileden iki utility'yi class attribute sırasına göre değil kendi sırasına göre çözüyor, yani
  `className="p-5"` sessizce kaybedebilir. Redesign'ın özü yerleşim; 4px'lik fark tasarım
  sisteminin kararı ve AGENTS §7'nin "sihirli sayı yok" kuralı zaten orayı işaret ediyor.
  **Tek istisna davet kartındaki 36px ikon düğmeleri** — yerel bir `IconButton`, çünkü paylaşılan
  `Button` etiketli bir eylem için boyutlanmış ve orada etiket gürültü olurdu.
  (3) **`RiskChip` üç yerde okunuyor** (roster, brifing, öğrenci raporu); yeni hapı üçü de aldı.
  Rapor sayfası bu ticket'ın kapsamında değildi ama gözle doğrulandı.
  (4) **`invite_rotate_warning` yeniden kullanıldı**, `invite_rotate_confirm_body` açılmadı: uyarı
  kopyası zaten tam olarak onay mesajı, ikinci bir anahtar aynı cümleyi iki yerde bakımı demekti.
  Aynı gerekçeyle kapatma etiketi `common.dialog.close`.
  (5) **Sayaç mobilde yukarı ALINMADI.** Tasarımın mobil artboard'u sayacı en üste koyuyor
  ("bir bakış, altındaki her şeyi çerçeveliyor"). Denendi ve geri alındı: tek instance iki yerde
  olamıyor, yani ya ikinci bir `CoachCountdownCard` (tek tarih için iki takvim isteği) ya da
  satır yayan bir grid gerekiyor. İkincisi denendi ve masaüstünde iki şeyi birden bozdu — rail'in
  ilk satırı esneyip sayacın altında boşluk bıraktı, ve içerik sidebar'ın altına kaydı. Dört
  kelimelik bir kart ikisine de değmez; APP-090'ın "telefon işin üstünde açılır" kararı duruyor.
  (6) **e2e mock'u gerçek olmayan bir kapsam anahtarı taşıyordu** (`FOCUS_MINUTES`), ve `/v1/users/me`
  catch-all'dan 204 dönüyordu; ikisi de düzeltildi, yoksa Ayarlar ekranı kullanıcısız kalıyordu.

  **İlgili:** `(coach)/_components/{coach-signals.css,signal-pill.tsx,risk-chip.tsx}` ·
  `(coach)/{layout,coach-shell}.tsx` ·
  `(coach)/students/_components/{roster-shell,student-card,attention-button,cohort-brief-card,
cohort-summary-band,coach-capacity-card,roster-content-skeleton}.tsx` ·
  `(coach)/students/_components/invite-code.ts(+spec)` ·
  `(app)/profile/_components/{profile-shell,coach-scope-card,coach-scope-modal}.tsx` ·
  `components/app-nav.tsx` · `messages/{tr,en}.json` · `e2e/coach-home.spec.ts`

- **2026-09-11 — Coach plan Takvim chrome.** The coach `/plan` calendar now uses the student
  Takvim frame: left rail (mini calendar, student filter, selected-day list), Gün/Hafta/Ay
  hour grid, mobile date strip and agenda, hover preview. Chip color comes from the attendee
  set; personal items stay neutral; task vs event is a glyph. Empty-slot and FAB opens an
  action sheet, then the existing right-drawer forms. Toolbar create buttons are unchanged.
  Usage: open `/plan` as COACH. Gotcha: detail stays a live overlay so an authoritative reload
  can replace the open row; do not freeze it in an imperative bottom sheet. Keep the toolbar at
  `z-50` so create still works while that overlay is open. Related:
  `coach-plan-calendar-shell.tsx`, `plan-calendar-{frame,item}.ts*`,
  `lib/coach-plan-calendar-item.ts`, `e2e/coach-plan.spec.ts`.

- **Koçluk kabuğu ortak AppNav kullanıyor (2026-09-10)** - `/kocluk`, koç profili ve öğrenci
  detayları artık panelle aynı `AppNav` kabuğunu kullanır: masaüstünde açılıp daralabilen sol
  sidebar, mobilde ortak üst başlık ve alt tab bar görünür. `(coach)` route grubu ile COACH guard'ı
  değişmedi; yalnız navigasyon kopyası kaldırıldı. Sidebar marka linki koçu öğrenci paneline
  uğratmadan doğrudan `/kocluk`'a götürür. Kullanım: tüm koç rotalarında chrome otomatik gelir.
  Gotcha: koç görünürlüğü `AppNav.visibleTo` üzerinden role-aware filtrelenir; koç kabuğunda ikinci
  bir menü veya rol filtresi eklenmemelidir. İlgili: `coach-shell.tsx`, `app-nav.tsx`,
  `e2e/coach-home.spec.ts`.

- **Koç planında atomik çoklu atama sözleşmesi (APP-091, 2026-09-09)** - Bir görevi 1-20 benzersiz
  öğrenciye tek işlemde verecek katı Zod girdisi ile gruplu görev/katılımcı DTO'ları eklendi.
  Öğrencinin `description` alanı koç sözleşmesine alınmadı. `plan_tasks` ve silinen atama günlüğü
  nullable `assignment_group_id` ve grup sorgusu indeksleri kazandı. Kullanım: sonraki servis
  dilimi her öğrenci kopyasına aynı grup UUID'sini yazar. Gotcha: grup kimliği bir sahiplik veya
  yetki kanıtı değildir; aktif bağ kontrolü yine mentorship servisinde yapılır. İlgili:
  `packages/{types,validation}/src/mentorship.ts`, `apps/api/src/database/schema.ts`,
  `0110_app_091_coach_plan_events.sql`.

- **Koçun kendi dünyası: yönlendirme, ana ekran, bildirim (APP-090, 2026-09-08)** — APP-089 koçu
  onboarding sonunda `/kocluk`'a indirdi ama **login'i değiştirmedi**: `postAuthDestination`
  rollere hiç bakmıyordu, dolayısıyla koç ilk kayıtta doğru yere iniyor, **sonraki her girişte
  öğrenci paneline** düşüyordu. O ekran koça yabancı: streak alevleri, Pomodoro ritüeli, "Bu yolun
  sonunda ne var?" hedef kartı, otomatik açılan ruh hali modalı.

  **Panel koça uyarlanmadı, koç panelden çıkarıldı.** `(coach)/layout.tsx` bu kararı zaten yazmıştı
  ("_the student panel is a daily ritual; this is a work tool. Sharing one shell would put two
  mental models in one chrome_"), ve `panel-shell.tsx` 1381 satır — `(app)` altında bugüne dek
  **sıfır** rol dallanması vardı, oraya ilkini sokmak hem kuralı hem deseni bozardı.

  **Blok listesi, allow-list değil.** `lib/coach-surface.ts`: öğrenci ritüeli (`/panel`,
  `/seans`, `/analiz`, defterler, `/hedef`, AI companion `/koc`, `/kocum`, `/kocluk-daveti`) koça
  kapalı; **`/plan` APP-091 ile role-aware bir koç çalışma yüzeyine dönüştü.** `/ayarlar`, `/profil`,
  `/abonelik` (Koç Pro orada satılıyor), `/topluluk` ve `/bilgi` de açık kalıyor. Guard bir
  nezaket, güvenlik sınırı değil — koçun kapalı bir ekranda göreceği tek
  şey kendi boş verisi — o yüzden fail-open olması doğru: ileride eklenen bir `(app)` rotası koçu
  sessizce kilitlemiyor. Yol eşleştirme **hem kanonik hem TR segmentini** kabul ediyor
  (`app-sidebar.ts`'in deseni); tek form yazmak, yerelleştirilmiş yol geldiği anda sessizce
  eşleşmeyi bırakırdı.

  **`/kocluk` iki kolona çıktı.** Ayrım "ne sıklıkla değişiyor"a göre: solda bugünün işi (brifing →
  sayı bandı → roster), sağda koçun göz ucuyla baktığı sabit gerçekler (sınav sayacı, davet kodu,
  veri kapsamı, topluluk). Sayaç `/v1/coaching/today`'den DEĞİL — bir koça tek tarih için öğrenci
  planı payload'u okutmak olurdu — mevcut `fetchExamCalendarByFamily` seam'inden geliyor.

  **Kural tabanlı brifing tabanı denendi ve KESİLDİ.** Plan, brifing yokken kartı doldurmak için
  `summarizeCohort` + `action_*` kopyasından deterministik bir özet öngörüyordu. Ekranda görülünce
  üretebildiği her satırın — isim, risk çipleri, öneri — birkaç piksel aşağıdaki `StudentCard`'da
  zaten durduğu çıktı; e2e "strict mode violation" olarak yakaladı, çünkü aynı cümle iki kez
  render ediliyordu. Modelin kattığı şey `why` (birkaç sinyalden çıkarılmış tek gerekçe) ve duruma
  özel `action`; ikisi de koçun zaten baktığı satırdan üretilemez. Kart kendi boş haline döndü.

  **Bildirim çekmecesi koç kabuğuna da mount edildi.** Dört koça-yönelik bildirim tipi
  (`MENTORSHIP_STUDENT_JOINED`, `_RISK_DIGEST`, `_ASSIGNMENT_DROPPED`, `_ASSIGNMENT_PROGRESSED`)
  zaten üretiliyordu ama `NotificationDrawerShell` yalnız `(app)/app-shell.tsx`'te mount ediliyordu:
  koç bunları görmek için öğrenci paneline dönmek zorundaydı, ve artık dönemiyor.

  **Koç profili `(coach)` altına taşındı** (`/kocluk/profil`). `/koc-basvurusu` yalnız **kayıt
  formu** olarak kalıyor — oraya giren kişi tanım gereği henüz koç değil.

  **Usage:** koç login → `/kocluk`. Profil → `/kocluk/profil`. Mevcut hesap koç olmak isterse
  `/koc-basvurusu`, kayıttan sonra profiline yönlendiriliyor.

  **Gotchas:**
  (1) **Yönlendirme rolü okur, sicil satırını değil.** Askıya alınan koçun COACH rolü geri alınıyor
  ama sicil satırı adminin gerekçesiyle duruyor; satıra bakan bir yönlendirme onu `(coach)` guard'ına
  fırlatır ve **gerekçeyi hiç okuyamazdı.** O yüzden `/koc-basvurusu` rolsüz-ama-satırlı kişiye
  salt-okunur bir durum kartı gösteriyor.
  (2) Kayıttan sonra `usersControllerMe` ile principal **yeniden okunuyor**: rol sunucuda anında
  canlı ama sekmedeki kopya login'den kalma, ve `(coach)` guard'ı onu okuyor. Tazelemeden gitmek
  yeni koçu "bu alan koçlar için" ekranına indirirdi.
  (3) `CommunityCard` ve `SoftPromoShell` `(app)/dashboard/_components`'ten `src/components`'e
  taşındı: `(coach)` `(app)/**`'dan import edemez, ve dolaylı import da ihlaldir.
  (4) `(coach)` message scope'u büyüdü (`notifications`, `journey_levels`, `countdown`,
  `community`) — `pickMessages` eksik namespace'te **throw ediyor**.
  (5) Mobil tab bar rol filtresini **hiç uygulamıyordu**; koç `/topluluk`'ta beş ölü sekme
  görüyordu ve `/kocluk`'a telefondan hiç ulaşamıyordu. Filtre iki listeye de bağlandı.

  **İlgili:** `apps/web/src/lib/coach-surface.ts` (+spec) · `lib/post-auth-destination.ts` ·
  `(app)/app-shell.tsx` · `components/app-nav.tsx` · `(coach)/coach-shell.tsx` ·
  `(coach)/students/_components/{roster-shell,coach-countdown-card}.tsx` ·
  `(coach)/students/profile/**` · `(app)/coach-application/_components/coach-application-shell.tsx` ·
  `components/{community-card,soft-promo-shell}.tsx` · `e2e/coach-home.spec.ts`

- **Koç kendi kaydını açıyor, admin geri alabiliyor (APP-089, 2026-09-08)** — APP-082 kürasyon
  hattını kurmuştu ama koç adayının o hatta girebilmesi için önce **öğrenci** olması gerekiyordu:
  `/koc-basvurusu` `(app)` altında, `(app)` de `hasCompletedOnboarding = username && examType`
  kapısının arkasında. Yani koç, başvuru formunu görebilmek için beş adımlık öğrenci sihirbazını
  bitirip hedef sınav seçiyor ve _"Bu yolun sonunda ne var?"_ sorusuna kişisel bir hedef yazıyordu.
  Sonra da linki profil listesinin dibinde bulması gerekiyordu. Kürasyonun bedeli, koçun kendini
  öğrenci gibi tanıtmasıydı.

  **Ön onay kalktı. Kürasyon kalkmadı, yeri değişti.** Kayıt `/kayit?rol=koc` ile self servis:
  `signupSchema.intent` COACH rolünü anında veriyor. Bu güvenli, çünkü **COACH tek başına hiçbir
  kapı açmıyor** — roster boş, her öğrenci-kapsamlı okuma zaten `requireActiveLink` üzerinden 404
  dönüyor, ve öğrenci verisine giden tek yol olan **davet kodu** `assertCanInvite`'ın arkasında:
  doğrulanmış e-posta + `ACTIVE` sicil satırı. Signup'ın verdiği şey yetki değil, **şekil**:
  koça göre onboarding, nav ve ana ekran.

  **Tablo aynı, anlamı değişti.** `mentorship_coach_applications` başvuru kuyruğu değil **koç
  sicili** (migration `0108`): `PENDING|APPROVED|REJECTED` → `ACTIVE|PENDING|SUSPENDED`, default
  `ACTIVE`. Tablo adı bilerek değişmedi, rename sıfır davranış için W6/W8/web'e yayılan bir churn
  diff'i olurdu. `canApply` → `canRegister` ve reapply cooldown'ı (`reapply_after_days`) tamamen
  gitti: bekletilecek bir ret yok. Yerine tek kural kaldı, ve asıl kural o: **adminin dokunduğu
  satırı, hakkında olduğu kişi yeniden yazamaz** — kayıt `ACTIVE` yazdığı için, yeniden kaydolabilen
  bir SUSPENDED koç kendi askısını siler.

  **Adminin yönü tersine döndü.** `/admin/coaches`: `POST :userId/status` (ACTIVE rolü verir,
  diğerleri geri alır) ve ayrı `POST :userId/verified-claims`. Ayrı olmaları önemli — statü "bu kişi
  koçluk yapabilir mi", rozet "biz ne kontrol ettik"; birleşse geri açma işlemi kimsenin yeniden
  okumadığı rozetleri sessizce yeniden iddia ederdi. **İki yazımın sırası kural:** çökme anında koçu
  daha az yetkili bırakan sıra kazanır (verirken satır-sonra-rol, alırken rol-sonra-satır).

  **Askıya alma sadece paneli kapatmıyor.** Kodlar veriliş anını aşar; öğrencilerin elinde kopyası
  vardır. Bu yüzden `resolveInvitingCoach` hem `previewInvitation` hem `acceptInvitation` içinde
  koçun hâlâ davet edebilir olduğunu kontrol ediyor, yoksa dağıtılmış her kod TTL'i boyunca canlı
  kalırdı. Ret `INVALID`, "askıya alınmış" değil: kodu tutan kişi bize yabancı, askı da başkası
  hakkında idari bir bilgi. Mevcut bağlantılar **sonlandırılmıyor** ve koltuklar geri alınmıyor —
  koçun sorunu için öğrenciyi ay ortasında Premium'dan düşürmek yanlış fatura. Öğrenci
  `/kocum`'da durumu görüyor: sessizleşen koç, umursamayan koç gibi okunuyordu.

  **Öğrenciye dürüstlük tersine döndü.** `MentorshipCoachProfileDto.verifiedClaims` →
  `claims: {claim, value, verified}[]`. Eskiden yalnız doğrulanmış iddialar giderdi, çünkü her koç
  zaten bir incelemeden geçmişti; doğrulanmamış bir iddia doğrulanmışın yanında **bizim onayımız**
  gibi okunurdu. Self servis kayıtta tehlikeli varsayılan tersine döndü: hiçbir şey göstermeyen ekran,
  kontrol edilmiş koçla edilmemişi **aynı** gösteriyor, üstelik tam da öğrencinin mahrem verisini
  paylaşmaya karar verdiği anda. Artık hepsi gidiyor, `verified` bayrağıyla, ve ekran ikisini
  **görünür biçimde ayrı** render etmek zorunda.

  **Rol yazımı W0'a taşındı.** `users.roles` identity'nin kolonu ama `grantRole` W6'daydı ve W8 oraya
  import edemezdi (cycle). `UsersRepository.setRoles` + `UsersService.addRole/removeRole` tek
  implementasyon oldu; `AdminUsersService` allowlist'i ve audit'i tutmaya devam ediyor.

  **Usage:** koç → `/kayit?rol=koc` → onboarding koç dalı (`goal` yerine `coachProfile`, sınav sorusu
  _"Hangi sınava koçluk yapıyorsun?"_ olarak kalıyor) → `/kocluk`. Mevcut hesap → `/koc-basvurusu`.
  Admin → `/coach-applications` (dosya yolu aynı, ekran "Koçlar").

  **Gotchas:**
  (1) **Sınav adımı koç dalında da duruyor**, ve bu bilinçli: `hasCompletedOnboarding` tüm `(app)`
  yüzeyini `username && examType` ile kapatıyor, atlayan koç kendi profil ekranına bile giremezdi.
  (2) Onboarding dalı **`user.roles`'tan** okunuyor, sessionStorage'dan değil — `JwtAuthGuard`
  principal'ı her istekte DB'den okuduğu için sekme/yenileme/gün farkı bunu bozmuyor.
  (3) `GET /coach-registration/mine` artık **zarf** döndürüyor (`registrationOpen`, `registration`,
  `emailVerified`); kapalı kayıt eskiden yalnız doldurulmuş formu reddederek öğreniliyordu.
  (4) `getCoachOverview` kodu **gizliyor, silmiyor** — geri açılan koçun öğrencilerdeki kodu
  geçersizleşmesin diye. Sebep zarfta, panel hangisi olduğunu söylüyor.
  (5) `MENTORSHIP_APPLICATION_TOO_SOON` **artık atılmıyor**; error-code bloğu append-only olduğu için
  duruyor.
  (6) `coach_profile_claim_*` etiketlerinden "doğrulandı" çıkarıldı — grup başlığı söylüyor, çip değil.
  (7) Sponsorlu koltuk açılmadan önce **SMS OTP zorunlu**: koç sayısını sınırlayan şey artık insan
  onayı değil, üretilebilir e-posta adresi sayısı. Bayrak sırası yukarıda güncellendi.
  (8) **Şikayet kanalı kapsam dışı** (ürün kararı): ön onay kalktığı hâlde öğrenciden gelen tek
  denetim sinyali destek e-postası. Roadmap §12'de açık madde olarak duruyor.
  (9) **Kapsam dışı bir hata bu bilette düzeltildi:** koç dalının son adımı `/kocluk`'a inmiyordu,
  ölçünce sebebin bu dala özgü olmadığı çıktı — `CloudTransitionProvider` overlay'i `initial={false}`
  ile mount olduğu için `onAnimationComplete` hiç ateşlenmiyor, dolayısıyla **hiçbir** onboarding
  yönlendirmesi gerçekleşmiyordu (öğrenci akışı dahil). Tek satırlık düzeltme ve gerekçesi
  [motion.md](./motion.md) 2026-09-08 girdisinde.

  **İlgili:** `packages/{types,validation}/src/mentorship.ts` · `packages/validation/src/auth.ts` ·
  `apps/api/drizzle/0108_w8_coach_registry.sql` · `modules/mentorship/{domain/coach-registration.ts,
application/mentorship-application.service.ts,application/mentorship-link.service.ts,
infrastructure/mentorship-application.repository.ts,presentation/*}` ·
  `modules/identity/{application/users.service.ts,application/auth.service.ts,infrastructure/users.repository.ts}` ·
  `modules/admin/presentation/admin-coach-applications.controller.ts` ·
  `apps/web/src/app/[locale]/(onboarding)/**` · `(auth)/signup/page.tsx` ·
  `(app)/coach-application/**` · `(app)/my-coach/_components/coach-profile-card.tsx` ·
  `(coach)/students/_components/{invite-lock.ts,coach-capacity-card.tsx,roster-shell.tsx}` ·
  `apps/admin/src/app/(general)/coach-applications/page.tsx`

- **Öğrencinin aynası — koçuma ne gidiyor (APP-087, 2026-09-07)** — APP-073 asimetriyi koç
  tarafında kapatmıştı: _"güven çizgisinin kaldıramayacağı tek asimetri, veriyi alan tarafın
  sınırları hakkında veren taraftan az bilmesi."_ Öğrenci tarafında o liste hâlâ **sözdü**:
  `/kocum` "çalışma süren, seans sayın, aktif günlerin ve serin" diyordu ama **kaç** olduğunu
  söylemiyordu. Öğrenci neyin türünü biliyor, miktarını bilmiyordu.
  `GET /v1/mentorship/my-coach/data` her kapsam satırının yanına o an koça giden fiilî değeri
  koyuyor. Vaat, rapora dönüşüyor.
  **Seam zaten öğrenci için tasarlanmıştı.** `CohortEvidenceService.getStudentReport(studentId,
now?, mentorshipLinkId?)` koç id'si almıyor ve link id'si opsiyonel; kendi dokümanı "W8 dışındaki
  çağıranlar onu atlar, `coachNote` ve `assignedByCoach` almaz" diyor. Öğrenci kendisi için
  çağırdığında koçun özel alanları **argüman verilmediği için** gelmiyor — sonradan filtrelenmesi
  gereken, unutulabilecek bir şey değil, **var olmayan bir parametre**. Yeni sorgu, yeni tablo,
  migration, LLM çağrısı, kota **yok**; bu dilim para harcamıyor.
  **Ayrı servis, çünkü kapı farklı.** `MentorshipRosterService`'teki her metot
  `requireActiveLink(coachId, studentId)` ile kapılı; bu "ben bu öğrenciyim" ile. İki
  yetkilendirme modelini tek dosyada karıştırmak, bir sonrakinin yanlış olanı çağırmasının en kısa
  yolu — `mentorship-self-view.service.ts` kapıyı tartışmasız yapıyor.
  **Ölçüldü: aynanın yarısı yeni bilgi, yarısı değil.** Öğrenci deneme netlerini (koçtan bile
  fazlasını), plan başlıklarını ve sınavını zaten kendi ekranlarında görüyor. Ama `sessions7d`,
  `activeDays`, `focusMinutes`, `longestStreak`, **haftalık plan tamamlama oranı** ve **14 günlük
  mod ortalaması** hiçbir ekranında yok. Bu yüzden ekran her satıra sayı basmıyor: **değerin yeni
  olduğu yerde değeri, olmadığı yerde kendi ekranına işareti** gösteriyor. Deneme satırı bu yüzden
  yalnız "kaç deneme, sonuncusu ne zaman" diyor; `/analiz`'in bandını burada yeniden çizmek daha
  kötü bir kopya olurdu. Ama satır **listeden çıkmıyor**: liste onay sözleşmesinin ta kendisi,
  eksik bir liste yanlış beyandır.
  **Risk flag'leri gitmiyor.** `INACTIVE` / `PLAN_SLIPPING` bir operatörün triyaj sözcükleri;
  APP-067 digest'te zaten "flag adı kopyada geçmez, gelen kutusunda teşhis gibi okunur" demişti.
  Aynı gerekçe ekranda da geçerli.
  **Aynı kart, iki an.** `DataScopeCard` hem onay ekranında hem `/kocum`'da. Onay ekranında bağ
  henüz yok, dolayısıyla değer de yok — prop opsiyonel, o ekran hiç değişmedi. Onay ekranı **söz
  vermeye**, `/kocum` **rapor etmeye** devam ediyor.
  **Kullanım:** `/kocum`, otomatik. `mentorship.enabled` kapalıysa bu uç da 403.
  **Gotchas:** (1) Sayılar sunucuda hesaplanıyor, mod ortalaması dahil — iki ekranda iki türlü
  yuvarlanan bir ortalama tam olarak bu özelliğin engellemek için var olduğu sapma olurdu.
  (2) Plan satırı **iki pencere** taşıyor: başlıklar 14 günden, oran 7 günlük. Tek sayıya
  indirmek ikisini birden yanlış raporlardı. (3) Hiç verisi olmayan öğrenciye **sıfır dizisi
  gösterilmiyor**, satır çıplak kalıyor: sıfırları rapor gibi sunmak dürüst değil. Ama
  `planCompletionRate7d = 0` **gösteriliyor** — planlayıp yapmamak bir olgu, veri yokluğu değil.
  (4) `AI_BRIEF`'in değeri yok: o bir veri değil bir yöntem, ve öğrenci onu zaten onayladı.
  (5) Tarayıcıda yakalandı: "Son haftanın %{percent}'ini tamamladın" **Türkçe eki sayının
  okunuşuna göre değişiyor** (%0 → "sıfırını", %5 → "beşini"); statik metin bunu tutturamaz, kopya
  eki hiç almayacak biçimde yeniden yazıldı.
  **İlgili:** `modules/mentorship/application/mentorship-self-view.service.ts`,
  `modules/coaching/application/cohort-evidence.service.ts` (üç pencere sabiti export edildi),
  `apps/web/src/app/[locale]/(app)/my-coach/_components/{my-coach-shell.tsx,scope-values.ts}`,
  `packages/types/src/mentorship.ts`.

- **Eyleme dönük brifing — AI ödev taslağı (APP-086, 2026-09-07)** — APP-085 "ne yapmalı"yı düz
  cümleyle söylüyordu. Bu dilim onu bestecinin içine somut bir haftaya çeviriyor:
  `POST /v1/mentorship/students/:id/assignment-suggestions` bir haftalık görev taslağı döndürüyor.
  **Yeni bir yazma yolu AÇILMIYOR, ve karar bu.** Öneri sadece öneri; koç düzenleyip mevcut
  `POST .../assignments` ile gönderiyor. `PlanService.createFromMentorship` tek yazar olarak
  kalıyor, LLM öğrencinin planına hiç dokunmuyor. Bu APP-074'ün "şablon UYGULANMIYOR, bestecinin
  içine YÜKLENİYOR" kararının aynısı — ve aynı sebeple: taksonominin tek kapısı bestecinin seçicisi.
  **`topic` ayrıştırmada zorla null.** Prompt "böyle bir alan yok" diyor, parser da onu doğru
  kılıyor. Konu, tek bir sınavın taksonomisine yumuşak referans; sunucu yalnız "konunun dersi var
  mı"ya bakıyor, konunun bu öğrencinin sınavında var olup olmadığına bakan tek şey bestecinin
  seçicisi. Model üretse doğrudan öğrencinin planına yazılır ve koça biri kontrol etmiş gibi
  görünürdü.
  **Tarih değil `dayIndex`.** `MentorshipProgramTemplateTaskDto`'nun gerekçesi: taslak "bir
  program", "8'inin haftası" değil. Besteci hangi haftayı gösteriyorsa oraya tarihliyor, model
  takvim aritmetiği yapmıyor. Yan fayda: öneri **şablonla birebir aynı şekle** sahip, dolayısıyla
  `buildTemplateDrafts` olduğu gibi çalışıyor ve istemciye tek satır çizim mantığı eklenmedi.
  **Tavan bir hafta: 7 görev, günde 3.** Bestecinin kendi tavanı 21 ama o koçun KURABİLECEĞİ,
  modelin sormadan önüne koyacağı değil. Yedi görev okunup düzeltilebilen bir hafta; 21'i kimse
  gerçekten okumaz.
  **Kanıt brifingin şekillendiricisi, yeniden kullanıldı.** `buildMentorshipBriefEvidence` zaten
  ismi ve koçun kendi notunu ayıklıyor; onu çağırmak "brifingin kendi cümlesi prompt'a geri
  gitmiyor"u hatırlanan değil **yapısal** bir gerçek yapıyor. Kendi eski cümlesini gören model
  sayılara bakmak yerine ona katılır.
  **Önbellek YOK, ve bu brifingden bilinçli fark.** Brifing aynı özeti iki kez yazmasın diye
  cache'li; öneri ise koçun beğenmediğinde yeniden isteyeceği şey. Parmak iziyle aynı haftayı geri
  vermek düğmeyi bozuk gösterirdi. Sınır kota, ki kotanın işi bu.
  **Kullanım:** öğrenci raporunda bestecinin üstündeki çubukta "AI önerisi". Kota
  `ai.features.mentorship.suggestions.free_{enabled,limit}`, free varsayılan **kapalı**.
  **Canlı koşuda iki kere ders alındı, ikisi de aynı ders.** Bir prompt kuralı talimattır, garanti
  değil — APP-085'te ref sızıntısında öğrenilen şey burada iki kez daha tekrarlandı, ve ikisinde de
  çözüm aynı: kuralı prompt'ta söyle, **ayrıştırmada zorla**.
  **(1) Uydurulan ders.** Kanıtında hiç deneme, hiç ders olmayan bir KPSS adayına "Fen Bilgisi: 5
  deney yaz" ve "İngilizce" önerildi. Model sınavın müfredatını tahmin ediyor, üstelik kendinden
  emin. `collectEvidenceSubjects` artık kanıtın **söylediği** dersleri topluyor
  (`latestMockSubjects` + `planTasks`), ayrıştırma dışındakini **boşaltıyor**. Görev düşürülmüyor,
  yalnız `subject` boşalıyor: başlık koçun düzelteceği düz metin, ama `subject` `plan_tasks.subject`'e
  giren, sonradan gruplanıp sayılan **yapılandırılmış** veri — uydurulmuşu sessiz bozulma olur.
  **(2) Tek görevle doldurulmuş hafta.** Verisi neredeyse hiç olan öğrenciye yedi günün yedisinde
  "Paragraf: 10 soru çöz" geldi. "Veri inceyse az görev öner" denmişti; model azı değil aynısını
  seçti. `MAX_SAME_TITLE = 3`: haftada üç kez tekrar eden bir alıştırma koçun gerçekten yazacağı
  bir program, yedi değil.
  **Gotchas:** (1) `ai_usage` satırı **koça** yazılıyor, admin tablosunda "Koç ödev önerisi";
  brifinglerle kota **paylaşmıyor** — kohortunu okumuş bir koç henüz kimseye hafta yazdırmadı.
  (2) Kart `examType: null` ile yükleniyor: model taksonomi görmedi, dolayısıyla öneri hiçbir
  sınava ait değil ve `buildTemplateDrafts`'in uyumsuzluk dalı boşuna tetiklenmiyor.
  (3) `fake-llm.adapter.ts`'e ikinci sentinel dalı — olmadan dev ve e2e'de her çağrı 503.
  (4) e2e taslağın **hiçbir şey yazmadığını** raporun `planTasks`'ini önce/sonra karşılaştırarak
  iddia ediyor; "yazmıyor" bu özelliğin tek gerçek güvenlik iddiası. (5) Kanıtta hiç ders yoksa
  **her** öneri dersi boş gelir; bu bir hata değil, temellendirmenin doğru sonucu — dersi koç seçer.
  (6) Prompt sürüm sabiti **yok**: sürüm bir önbelleği geçersiz kılmak için vardır, burada önbellek
  yok.
  **İlgili:** `modules/ai/{domain/assignment-suggestion-prompt.ts,application/assignment-suggestion.service.ts}`,
  `modules/mentorship/application/mentorship-suggestion.service.ts`,
  `apps/web/src/app/[locale]/(coach)/students/[studentId]/_components/template-bar.tsx`,
  [`ai.md`](./ai.md).

- **Kohort brifingi — koçun sabah görünümü (APP-085, 2026-09-07)** — APP-078 brifingi öğrenci
  başına verdi; roadmap §9'un cümlesi ise başkaydı: "koç panele girince **kim geride**, neden, ne
  yapmalı otomatik öne çıkar". Yirmi öğrencisi olan koç bunu öğrenmek için yirmi kart açıp yirmi
  kez ödemek zorundaydı. Bu dilim aynı brifingi bir seviye yukarı taşıyor.
  **İki fiil, çünkü ikisi gerçekten farklı iş.** `GET /v1/mentorship/brief` yazılmış olanı okuyor —
  LLM yok, kota yok, ücret yok — ve kart **mount'ta onu istiyor**. `POST` tek para harcayan yol.
  APP-078'in "kendi kendine yazan kart koçu faturalar" kuralı böylece korunuyor ama "otomatik öne
  çıkar" da gerçekleşiyor: bugünün brifingi varsa koç hiçbir şeye tıklamadan görüyor.
  **LLM yalnız cümle yazıyor; kanıt da "yeni mi" de ondan gelmiyor.** Her satırın yanındaki
  `riskFlags` kural motorunun (`domain/risk-flags.ts`), `isNew` ise bir önceki brifingin
  `studentId:FLAG` çiftleriyle küme farkı. İkisi de deterministik. Brifing triyajın **üstüne**
  biniyor, yerine değil — APP-078'in aynı cümlesi.
  **"Yeni haber ne" artık tek yerde.** `domain/risk-pairs.ts` (saf, 8 test): digest'in `toPairs` /
  `hasNewNews`'i oraya taşındı, notifications onu import ediyor. İki kopya kaçınılmaz olarak
  kayardı ve ilk belirtisi şu olurdu: koça 07:00'de e-posta gitmiş bir öğrenciyi panel sabah
  "yeni" diye karşılar. `attention.ts`'in gerekçesinin bir üst katı.
  **Model isim de id de görmüyor — `S1`, `S2`.** APP-078'in gerekçesi (adını bildiği birini
  tanıdığını sanan model) artı `plan-adaptation.ts`'in gerekçesi: hiç görmediği bir id'yi
  **uyduramaz**, uydurduğu ref çözülmez ve **düşürülür**. Bu özelliğin yaşayamayacağı tek hata bir
  cümlenin yanlış öğrencinin adı altında görünmesi.
  **Yeni prompt kuralı: öğrencileri birbiriyle KIYASLAMA.** Kohort ekranında iki satır yan yana
  duruyor, ve roadmap `:616` bireysel utandırmayı açıkça yasaklıyor. Sıralanmış bir listeyi okuyan
  koç sıralamaya göre davranır, öğrenciye göre değil. Diğer bütün brief kuralları aynen devam
  ediyor (flag'lerle çelişme, mood'dan teşhis, resmî bilgi — hepsi yasak).
  **Seçim kuralı tek fonksiyon.** `selectCohortBriefRows` hem kanıtı üretiyor hem servisin `S1`'i
  öğrenciye geri eşlemesini besliyor. Aynı yüklem iki dosyada yazılsaydı ilk sapmada satırlar
  kayardı; e2e bunu yakalamazdı çünkü tek öğrenciyle her ikisi de doğru görünür.
  **`MENTORSHIP_DATA_SCOPE` DEĞİŞMEDİ, ve bu bir karar.** `AI_BRIEF` zaten "bir LLM benim hakkımda
  başkası için yazı yazıyor" diyor. Kohort brifingi aynı yöntem, aynı veri, tek çağrıda N öğrenci —
  yeni kolon okumuyor. Öğrencinin onayladığı cümle değişmediği için liste de değişmiyor. Değişen
  tek şey ekrandaki komşuluk, ve onun karşılığı kod değil yukarıdaki prompt kuralı.
  **Yeni tablo, ve KVKK bu sefer bedava değil.** `mentorship_cohort_briefs` (migration `0106`):
  koç başına tek satır, üstüne yazılıyor. Tarihçe yok — bir sonraki brifingin öncekinden ihtiyaç
  duyduğu tek şey `pairs`, ve o bir kolona sığıyor (digest'in "ayrı durum tablosu yok"unun aynısı).
  `ON DELETE CASCADE` **yetmiyor**: erasure `users`'ı anonimleştiriyor, silmiyor — şablon ve
  başvurunun aynı tuzağı — dolayısıyla `MentorshipErasureService`'e bir satır eklendi.
  **İsim saklanmıyor, `riskFlags` saklanıyor.** Asimetri kasıtlı: isim her okumada
  `listDisplayIdentities` üzerinden çözülüyor, yoksa erasure'dan sonra kimsenin bakmayı akıl
  etmeyeceği bir önbellekte yaşamaya devam ederdi. Flag'ler ise **o anın** flag'leri; dünkü cümlenin
  yanına bugünün flag'ini koymak metne söylemediği bir şeyi söyletmek olurdu.
  **Bağ biterse satır da gider.** Okuma her seferinde aktif bağlarla kesişiyor: dün yazılmış bir
  brifing, bu sabah ayrılan öğrenciyi anlatmaya devam edemez.
  **Kullanım:** kart `/kocluk` roster ekranının en üstünde. Kota Koç Pro'ya bağlı —
  `ai.features.mentorship.cohort_brief.free_enabled` varsayılan **kapalı**; APP-079'un ücretli
  koltuğunun bugüne kadar eksik olan somut karşılığı bu.
  **Gotchas:** (1) `ai_usage` satırı **koça** yazılıyor, admin maliyet tablosunda "Koç kohort
  brifingi". Kotası per-student brifinginkiyle **paylaşılmıyor**: kohort görünümü koçun hangi
  öğrenciyi açacağına karar verdiği yer, onu tek tek okumaların payından harcamak haritayı yürünen
  yola göre kısıtlamak olurdu. (2) Kimse beklemiyorsa model **hiç çağrılmıyor**; `model: "empty"`
  dönüyor ve satır yine de yazılıyor, ki değişmemiş sakin kohort bir sonraki çağrıda tanınsın.
  (3) `pairs` yalnız **brifingde görünen** satırları kaydediyor: on kişilik tavana takılan ya da
  modelin atladığı öğrenci gösterilmedi, yarın "yeni" olarak gelebilmeli. (4) `fake-llm.adapter.ts`
  yeni sentinel dalı olmadan dev ve e2e'de her çağrı 503 olurdu — ayrıştırıcı katı. (5) Servis
  **senkron**, `backend.md:49`'un "LLM işi kuyruğa" kuralından sapıyor; sapma `ai.md:778`'de zaten
  kayıtlı ve `ponytail:` yorumu yükseltme yolunu adlandırıyor (POST kuyruğa, GET yoklamaya —
  zaten okuduğu satırı yokluyor). (6) Roster sayfası zaten kohortun tamamı: `pageSize` = kontenjan
  tavanı, yani hiçbir öğrenci görünürden sıralanıp çıkmıyor.
  **İlgili:** `apps/api/drizzle/0106_w8_mentorship_cohort_brief.sql`,
  `modules/ai/{domain/cohort-brief-prompt.ts,application/cohort-brief.service.ts}`,
  `modules/mentorship/{domain/risk-pairs.ts,application/mentorship-cohort-brief.service.ts,infrastructure/mentorship-cohort-brief.repository.ts}`,
  `packages/types/src/{mentorship,payments}.ts`,
  `apps/web/src/app/[locale]/(coach)/students/_components/cohort-brief-card.tsx`,
  [`ai.md`](./ai.md), [`notifications.md`](./notifications.md).

- **Yayın kapısı: CI yeşil, koçluk açılabilir (APP-084, 2026-09-06)** — Karar iki karanlık yüzeyi
  (`forum.enabled`, `mentorship.enabled`) açmaktı; ama `security-release-checklist.md`'nin **ilk
  kapısı** "Tam CI … yeşil" diyor ve master altı testte kırmızıydı. Yani kırmızı CI rakip bir iş
  değil, açma işinin birinci maddesiydi.
  **Düzeltme: CI'ı kırmızı yapan bu altı test DEĞİLDİ.** Koşu kayıtları okunduğunda CI'ın sır
  tarama adımında düştüğü ve lint/typecheck/build/test'in **hiç koşmadığı** çıktı; testler
  yerelde kırıktı ve CI oraya hiç varmıyordu. O hikâye
  [`base-infrastructure.md`](../core/base-infrastructure.md)'de. Aşağısı testlerin kendisi.
  **Altı kırmızı, üç ayrı kök neden — hiçbiri "testi güncelle" değildi.**
  **(1) Doğrulanmayan başlık, gerçek 500.** `@Headers() dto: AdIdempotencyHeadersDto` doğrulama
  **yapmıyordu**: Nest başlık parametrelerini `ArgumentMetadata.type === "custom"` diye bildiriyor
  ve pipe'a bildirilen sınıf yerine `Object` veriyor, dolayısıyla `ZodValidationPipe` şema bulamayıp
  ham başlıkları geçiriyor. Bozuk bir `Idempotency-Key` böylece `ad_reward_sessions.idempotency_key`
  (**uuid kolonu**) sorgusuna ulaşıp Postgres hatası → 500 üretiyordu. Sonda ile ölçüldü:
  `PROBE {"type":"custom","metatype":"Object","hasSchema":false}`.
  **Pipe da eklenemiyor:** `Headers` `(property?: string) => ParameterDecorator` diye tanımlı —
  `@Body`/`@Query`/`@Param`'ın aksine pipe almıyor, verilen sessizce yok sayılıyor. Denendi,
  ölçüldü, hâlâ 500 döndü. Yani bir başlık **yalnızca** onu çıkaran dekoratörün içinde doğrulanabilir.
  Çözüm `common/http/idempotency-key.decorator.ts`: `createParamDecorator` gövdesi istek yolunda
  sıradan kod, dolayısıyla kontrol gerçekten koşuyor. Şema ve DTO **silindi** — doğrulama gibi
  okunup hiçbir şey yapmayan bir şema yem, ve bir sonraki kişi doğrulanmış başlık lazım olunca ona
  uzanır.
  **(2) Harness üretim hattını elle kopyalıyordu ve kopya bayatlamıştı.** `main.ts` `bodyParser:
false` ile açılıp `configureBodyParsers` çağırıyor; o helper yükleme PUT'unu **atlıyor**, çünkü
  alıcı ham akışa ihtiyaç duyuyor. 31 e2e dosyasının **hiçbiri** onu çağırmıyordu; forum spec'i
  `express.raw`'ı APP-080'de ölen bir rotaya (`/v1/storage/fake-upload`) besliyordu. Sonuç: varsayılan
  ayrıştırıcı gövdeyi yiyor, alıcı boş okuyor, 400. `test/app-harness.ts` artık `src/`'den **aynı
  fonksiyonu** çağırıyor — kural yeniden yazılmadığı için üretimde doğru testte bayat olamaz.
  `bodyParser: false` neden `AppModule`'e taşınamıyor: fabrika seçeneği, Nest varsayılan
  ayrıştırıcıları app oluşturulurken kaydediyor, modül middleware'inden önce.
  **(3) İki test fixture'ı gerçek görsel değildi.** Harness düzeldikten sonra bayt akışı alıcıya
  ulaştı ve doğrulayıcı onları **haklı olarak** reddetti. Forum'un PNG'i 70 bayt: IDAT'tan sonraki
  chunk başlığı `"\0\0IE"` okunuyor, akış kaymış. ai-photo'nun JPEG'i `ff64` ile bitiyor, `ffd9`
  ile değil — kesik. İkisi de "gerçek bir görsel yükleniyor" iddia eden testlerdi ve **hiçbir zaman
  onu kanıtlamamışlardı**; harness hatası aynı 400'ü ürettiği için görünmüyordu. Yerlerine
  doğrulayıcıya karşı **ölçülmüş** fixture'lar kondu (JPEG: SOI · SOF0 1x1 · SOS · EOI, 33 bayt).
  **Sözleşme farkı:** bilet alıcısı `@HttpCode(204)`, testler 200 bekliyordu. Bu gerçek bir
  değişiklik, testler geride kalmıştı.
  **`content.service.spec` bayat imzayla çağırıyordu** (`("BODY","image/webp")`); imza
  `(userId, sessionId, purpose, contentType)`. Controller doğruydu, yani üretim hatası yok. Yeni
  iddia `ownerId`/`sessionId`'nin presign'a gerçekten gittiğini **kontrol ediyor** — APP-080 o
  alanları bir sebeple ekledi ve testin onları hiç görmemesi sorunun kendisiydi.
  **Ayrıca:** kayıt onay kutusuna 18 yaş maddesi (`auth.register.kvkk`, tr+en) — ayrı veli onayı
  akışı yok, karar buydu. **Hukuk onayı bekliyor** (roadmap §12 zaten lansman öncesi açık madde).
  Ve bayrak açma runbook'u: beş bayrak, sırası önemli, hiçbir yerde yazmıyordu.
  **İlgili:** `common/http/idempotency-key.decorator.ts`, `apps/api/test/app-harness.ts`,
  `modules/ads/presentation/{ads.controller.ts,ads.dto.ts}`, `packages/validation/src/ads.ts`,
  `apps/api/test/{forum,ai-photo}.e2e-spec.ts`,
  `modules/content/application/content.service.spec.ts`, `apps/web/messages/{tr,en}.json`.

- **Güven yüzeyi — koç profili öğrenciye görünüyor (APP-083, 2026-09-06)** — APP-082 kürasyonu
  kurdu ama ürettiği veriyi kimse görmüyordu: öğrenci onay ekranında hâlâ **bir isim** görüp
  mahrem verisini teslim ediyordu (`MentorshipInvitationPreviewDto` yalnız `coachDisplayName` +
  `coachUsername` taşıyordu). Bu dilim o boşluğu kapatıyor.
  **Ham iddialar öğrenciye GİTMİYOR.** `coachProfile` yalnız `headline`, `bio` ve **doğrulanmış**
  iddiaları taşıyor. Doğrulanmamış bir kurum, doğrulanmışın yanında render edilseydi bizim
  onayladığımız gibi okunurdu. Doğrulanmış olan ise **değeriyle** gidiyor ("Ankara Üniversitesi ·
  doğrulandı") — birinin kontrol ettiği bir olguyu genel bir rozete indirgemek bilgiyi boşuna
  atmaktı. Rozet hâlâ "bu koç iyidir" demiyor; puan yok, liste var.
  **`null` gerçek bir durum, doldurulacak bir boşluk değil.** Kuyruk var olmadan önce elle COACH
  alan her koçun profili yok, ve ekran "bu koç hakkında henüz bir profil yok" diyor — boş bir kart
  değil. Bağlanmayı **engellemedik**: kürasyonun kapısı COACH rolünün kendisi (APP-082), ve
  profilin üstüne ikinci bir kapı koymak var olan kuralı iki yerde tutmak olurdu.
  **Kart paylaşılıyor, iki ekran tek ilişkiyi anlatıyor.** `CoachProfileCard` hem onay ekranında
  hem `/kocum`'da — `DataScopeCard`'ın gerekçesinin aynısı. Onay ekranında **kapsam listesinin
  üstünde**: öğrenci önce KİM'e, sonra NE'ye karar veriyor.
  **Düzenleme yeni bir rota açmıyor.** Koç `headline`/`bio`'sunu `/koc-basvurusu`'nda düzenliyor,
  çünkü onaylanmış başvuru profilin ta kendisi; ikinci bir ekran aynı satırı iki kez gösterirdi.
  Uç da aynı kaynak: `PUT /v1/mentorship/applications/mine`, yalnız APPROVED satırda (yoksa 404).
  **İddialar ve rozet koça kapalı** — imzada yok, şemada yok, formda yok. Doğrulayan biz olduğumuz
  için rozetin arkasında biz duruyoruz; koç kurumu değiştirebilseydi rozet yalan olurdu.
  **Repodaki ilk Tier-1 moderasyonu.** `domain/contact-pattern.ts` (saf, 14 test): telefon · e-posta
  · IBAN · `@handle` · uygulama adı + rakam. Roadmap §9 aracısızlaşmayı marketplace'in ana kaçağı
  sayıp "chat'te numara/IBAN maskele" diyor; chat yok ama koç profili aynı deliğin bir dilim erken
  hali — serbest metin, tam da koçun platform dışına çıkarmak isteyeceği kişilere gösteriliyor.
  **Reddetme, maskeleme değil.** Rakamları yıldızlamak koça yazdığını sandığı bir şeyi kaydettiğini
  düşündürürdü ve bunu ilk kez bir öğrenci "bu yıldızlar ne" diye sorunca öğrenirdi.
  **Normalizasyon desenlerden daha önemli.** `İ` küçültünce `i` + birleşen nokta oluyor, hiçbir
  ASCII deseni tutmuyor; `toLocaleLowerCase("tr-TR")` + NFD + birleşen işaretleri atma + `ı`→`i`.
  **Tavan `ponytail:` yorumuyla adlandırıldı:** bu Tier-1, deneyen herkes geçer. Dürüst bir koçun
  alışkanlıkla numarasını yazmasını durduruyor; kararlı olan için Tier-2 sınıflandırıcı gerekiyor
  ve o Faz 2 (roadmap §9). Forum'un Tier-1 dilimi geldiğinde bu dosyayı devralır.
  **Kontrol iki yerde: hem düzenlemede hem BAŞVURUDA**, ve yalnız `headline`/`bio`'da. Yoksa aday
  numarasını yazar, admin gözle yakalamak zorunda kalır, ve onaylandığı an profil onunla yayına
  girer. `claimNote` **kontrol edilmiyor** — o alan admine yazılıyor, oraya telefon yazmak alanın
  amacının ta kendisi.
  **Gotchas:** (1) İlk eşleşen kural dönüyor, hepsi değil: çağıran zaten reddediyor, ve tüm
  eşleşmeleri listelemek yazara etrafından nasıl dolaşacağını anlatmaktan başka işe yaramazdı.
  (2) IBAN ve telefon **ayraçsız** metne bakıyor (ikisi de her zaman boşluklu yazılır), e-posta ve
  handle **yazıldığı gibi** olana — ayraçları önce atmak alakasız kelimeleri birbirine yapıştırıp
  yanlış eşleşme üretirdi. (3) Telefon deseni 10 haneden kısasını görmezden geliyor: "2019 mezunu"
  ve "40 yıllık" bir numara değil, ve boşuna bir ret koça sebepsiz bir yeniden yazım maliyeti.
  (4) Doğrulanmış ama değeri sonradan boşalmış bir iddia **düşürülüyor** — etiketi boş bir rozet
  göstermektense hiç göstermemek. (5) `toMyCoachDto` senkron kaldı, profil parametre olarak
  geçiyor: iki çağıranın ikisi de zaten `coachId`'yi elinde tutuyor.
  **İlgili:** `modules/mentorship/domain/contact-pattern.ts`,
  `modules/mentorship/application/{mentorship-application.service.ts,mentorship-link.service.ts}`,
  `modules/mentorship/infrastructure/mentorship-application.repository.ts` (`updateProfile`),
  `packages/{types,validation}/src/mentorship.ts`,
  `apps/web/src/app/[locale]/(app)/my-coach/_components/coach-profile-card.tsx`,
  `apps/web/src/app/[locale]/(app)/coach-application/_components/application-status-card.tsx`.

- **Kürasyon hattı — koç başvurusu ve vetting kuyruğu (APP-082, 2026-09-06)** — `mentorship.enabled`
  üretimde kapalıydı ve açılamıyordu: açıldığı gün koç adayının **başvuracağı bir yer yoktu**.
  Kürasyon şuydu — birileri bir şekilde ulaşıyor, biri elle `POST /v1/admin/users/:id/roles/COACH`
  çağırıyor. Roadmap §5 "açık kayıt değil, **kürasyon**: başvuru + belge + kısa değerlendirme"
  diyor; başvurunun girişi hiç yapılmamıştı.
  **Tek tablo, ve onaylanmış satır profilin ta kendisi.** `mentorship_coach_applications`
  (migration `0105`). İkinci bir "profil" tablosu reddedildi: koçun profili tam olarak vetting'ten
  geçen şeydir, ve "ne onaylandı"nın kaydı W6'nın append-only `admin_audit_log`'unda **zaten var** —
  ikinci tablo var olan bir olgunun ikinci kopyası ve KVKK'nın kovalayacağı üçüncü yer olurdu.
  **İki yazar, ayrım servis imzasında.** `submit` yalnız adayın alanlarını alıyor; `verifiedClaims`
  ya da `status` parametresi hiçbir yerde **yok**, yani "aday kendini onaylar" unutulan bir
  kontrolle doğabilecek bir hata değil, var olmayan bir argüman. Uçta da `.strict()`: gövdeye
  `status` koymak **400**, sessizce kırpılan bir alan değil.
  **Belge yok, yapılandırılmış iddia var.** Kanıt `claim_institution/branch/years` ve adminin
  **hangisini doğruladığı** (`verified_claims`). Belge sistemdeki en ağır kişisel veri olurdu,
  üstelik reddedilenler için de saklanan; rozetin ihtiyacı olan şey ise yalnız "ne kontrol edildi".
  Değerlendirmenin evrak işi platform dışında (§5'in "kısa değerlendirme"si). Şema (a)'ya hazır:
  bir `credential_key` kolonu ve private bir prefix eklemek yeter.
  **Rozet "bu koç iyidir" demiyor**, "şu iddia doğrulandı" diyor — `verified_claims` bir liste,
  puan değil. Ret ile gönderilen iddialar şemada **düşürülüyor**: bir reddetme hiçbir şeyi
  doğrulamaz, ve arkasında kimsenin durmadığı bir rozet hiç rozetten kötüdür.
  **En kritik karar: onay = rol, ama tek transaction DEĞİL.** `grantRole` W6'nın
  `AdminUsersService`'inde; admin kuyruk için mentorship'i import ediyor, mentorship rol için
  admin'i import etse **döngü** olurdu. İki yazma, iki transaction, ve **sıra tasarımın kendisi**:
  önce rol, sonra karar. Aradaki çökme COACH'lu ama PENDING bir satır bırakır — kuyrukta
  **görünür**, admin tekrar onaylar, `grantRole` idempotent, tamamlanır. Ters sıra
  APPROVED-ama-rolsüz bırakırdı: satır kuyruktan **düşer**, kimse fark etmez, koç panele giremez
  ve nedenini bilmez. Görünür ve kendini iyileştiren bir hata, görünmez bir hatadan iyidir. Üstüne
  kuyruk satır başına `hasCoachRole` taşıyor — boşluk hafızaya bırakılmıyor.
  **`review` idempotent.** Repository yalnız PENDING satırı güncelliyor, yani ikinci çağrı ilk
  değerlendirenin iddialarını boş kümeyle ezmiyor; audit satırı `applied: false` ile ne değiştiğini
  dürüstçe yazıyor.
  **İki bayrak, ikisi ayrı.** `mentorship.applications.open` bilerek `mentorship.enabled`'dan
  bağımsız: koç yüzeyi açılmadan önce başvuru toplayabilmek gerekiyor, ve yüzey açıldığı gün
  musluğu kapatan düğme bu. `reapply_after_days` (30) olmasa ret bir karar değil bir döngü olurdu.
  **Throttle bilerek sıkı DEĞİL** (10/dk, davet uçlarıyla aynı): asıl abuse sınırı burada değil,
  `UNIQUE (user_id)` kişi başına tek satır demek ve ne zaman yeniden yazılabileceğine `canApply`
  karar veriyor. Saatlik bir sınır çoğunlukla doğrulama hatasını düzelten adayı cezalandırırdı —
  rate limiter 400'leri de sayıyor. Davet kodunun "ayrı sayaç gerekmez" gerekçesinin aynısı.
  **Düzeltme: "koç yeniden giriş yapmalı" uyarısı artık YANLIŞ.** Bu doküman
  `POST /v1/admin/users/:id/roles/COACH` yanında "roller DB'den refresh'te okunuyor, canlı JWT'ye
  yamalanmıyor" diyordu. APP-080'in `auth_sessions` işi bunu değiştirdi: `JwtAuthGuard`,
  `TokenService.validateSession` üzerinden **her istekte** `users`'ı join ediyor, yani onay anında
  geçerli. e2e bunu artık iddia ediyor (onaylanan aday **mevcut** token'ıyla panele giriyor).
  **KVKK:** `MentorshipErasureService`'e tek satır. FK cascade yetmez — erasure `users`'ı
  anonimleştiriyor, silmiyor, `mentorship_program_templates`'in aynı tuzağı; burada daha da önemli,
  çünkü başvuru kişinin kendini anlattığı metnin yanında adminin ona verdiği kararı taşıyor.
  **Gotchas:** (1) Aday ucu **yeni bir controller**: `MentorshipCoachController` `@Roles(COACH)`
  taşıyor, yani henüz koç olmayan herkesi reddederdi; student controller'a koymak da o dosyanın
  adını yalan yapardı. (2) `hasCoachRole` `status`'tan **türetilmiyor**, API'den geliyor.
  (3) Kuyruk `AdminUsersService.listByIds` ile insanı geri koyuyor — W8 `users`'ı hiç okumuyor,
  admin ikisini aynı anda tutmasına izin verilen tek katman (APP-077'nin sponsorluk metriği deseni).
  (4) Onay **SUPER_ADMIN**: bir başvuruyu onaylamak o rolü vermenin ta kendisi, dolayısıyla
  doğrudan vermekten daha yumuşak bir izin olamaz. (5) Ret mevcut COACH rolünü **almıyor** —
  rol geri almak kendi şiddeti olan ayrı bir eylem (`free_seats`'in "geriye dönük değil" çizgisi).
  (6) Yeniden başvuru satırı canlandırıyor ve eski kararı **siliyor**: adaya taze başvurusunun
  yanında geçen seferki reddi göstermek, henüz verilmemiş bir kararı anlatmak olurdu.
  **İlgili:** `apps/api/drizzle/0105_w8_coach_applications.sql`,
  `modules/mentorship/{domain/coach-application.ts,application/mentorship-application.service.ts,infrastructure/mentorship-application.repository.ts,presentation/mentorship-application.controller.ts}`,
  `modules/admin/presentation/admin-coach-applications.controller.ts`,
  `modules/admin/{application/admin-users.service.ts,infrastructure/admin-users.repository.ts}` (`listByIds`),
  `packages/{types,validation}/src/mentorship.ts`,
  `apps/web/src/app/[locale]/(app)/coach-application/**`,
  `apps/admin/src/app/(general)/coach-applications/page.tsx`,
  [`admin.md`](./admin.md), [`identity.md`](./identity.md).

- **Müdahale döngüsü — "ilgilendim" işareti (APP-081, 2026-09-06)** — Roadmap §9'un koç vaadi üç
  parçalıydı: **kim geride, neden, ne yapmalı**. İlk ikisi APP-063/073/078 ile kapandı, üçüncüsü hiç
  kapanmıyordu. Bayrak yanıyor, digest gidiyor, koç öğrenciyle konuşuyor ve **panel bunu hiç
  öğrenmiyordu**: ertesi sabah aynı kırmızı satır aynı yerde, e-posta aynı ismi tekrar sayıyor.
  Roster bir listeydi; artık bir iş listesi.
  **İşaret "çözüldü" demiyor.** Uygulamanın bilebileceği tek şey koçun baktığı ve bir şey yaptığı.
  İyileşmeye hâlâ kurallar karar veriyor, koçun tıklaması değil. Bayraklar da **gizlenmiyor** —
  kart soluklaşıyor, çipler duruyor: veriyi saklamak koçun tıklamalarını kohort diye anlatmak olurdu.
  **İki mekanizma, ikisi de zorunlu.** İşaret şu iki durumda bozuluyor: (1) işaretin **kapsamadığı**
  bir bayrak düşerse (ertesi gün gelen `NET_DROP` için TTL beklemek bir hafta geç olurdu),
  (2) işaret **bayatlarsa** (`mentorship.attention.ttl_days`, 7). Yalnız küme farkı olsaydı kronik
  `INACTIVE` — en sık bayrak — tek tıkla sonsuza susardı; yalnız TTL olsaydı yeni haber bir hafta
  beklerdi. **İkisi de icat değil:** digest'in `hasNewNews`'i küme farkı, `repeat_after_days`'i TTL.
  Bu dilim aynı cümleyi tek öğrenci için kuruyor, `domain/attention.ts` (saf, 10 test).
  **Bayrakları sunucu değerlendiriyor, istemci göndermiyor.** Şema `.strict()`, `flags` göndermek
  **400**. İstemciden gelen bir küme, koçun sayfa render edildikten sonra düşen bir bayrağı
  susturabilir ve koça hiç görmediği bir şeyi hallettiğini söyletirdi. Bedeli tek
  `listCohortSnapshots([studentId])` — raporun zaten yaptığı iş.
  **`needsAttention` sunucuda türetiliyor.** Digest aynı kuralı tüketiyor; istemcideki bir kopya,
  panel ile sabah e-postasının "kim bekliyor" konusunda ayrılabileceği ikinci yer olurdu.
  (`cohort-summary.ts`'teki `FLAG_ORDER` kopyası bilerek güvenli — sürüklenirse yalnız çipler
  yeniden sıralanır; bu **yanlış sayardı**.)
  **Digest'in asıl boşluğu içerikteydi, kapıda değil.** `hasNewNews` e-postanın **çıkıp
  çıkmayacağına** koç başına karar veriyordu, ama gövde adayın taşıdığı **herkesi** listeliyordu —
  yani bir öğrencide yeni haber varken dün aranan öğrenci de tekrar sayılıyordu. Filtre artık
  `listAllActiveLinks`'in select'ine eklenen iki kolonla adayın **öğrencilerine** uygulanıyor;
  yeni sorgu yok, `CoachRiskDigestCandidate`/`hasNewNews`/`toPairs` değişmedi.
  **Model: link satırına iki nullable kolon** (`attended_at`, `attended_flags`, migration `0103`) —
  `coach_note` (0097) ve `brief` (0100) ile birebir aynı şekil ve aynı gerekçe: ilişki başına tek
  olgu, yerinde üzerine yazılıyor, **KVKK bedava** (erasure link satırlarını siliyor). `end()`
  ikisini de temizliyor; yeniden bağlanma bu satırı canlandırıyor ve aylar önceki bir "ilgilendim"
  yeni ilişkiyi sakin gösterirdi. `attended_flags` yeniden hesaplanmıyor **saklanıyor**: soru "koç
  işaretlerken ne gördü", ve sonradan düşen bayrağı ayırt edebilecek tek şey o an'ın fotoğrafı.
  **Gotchas:** (1) Düğme kartın `<Link>`'inin **dışında** — anchor içinde button geçersiz HTML,
  öneri satırının zaten kaçındığı tuzak; `StudentCard`'ın dış elemanı artık `Card`, `Link` yalnız
  içeriği sarıyor. (2) İstemci sıralaması (`compareByAttention`) meşru çünkü sayfa **tüm kohortu**
  tutuyor (`pageSize=100`, koltuk tavanı onlarca); sunucunun şiddet sırası bant içinde korunuyor
  (`Array.prototype.sort` kararlı). (3) İyimser güncelleme: tıklama koçun kendi eylemi, karar ile
  görme arasına spinner koymak dilimin kaldırmak istediği sürtünmenin ta kendisi; hatada satır geri
  dönüyor ve sebebini söylüyor. (4) Bant `attended` sayacını **sıfırken göstermiyor** — kimsenin
  başlamadığı bir sabahta "0 ilgilenildi" sitem gibi okunur. (5) `attended`, "bekleyen değil" değil
  "bayraklı ama halledilmiş" — yoksa her sağlıklı öğrenci sayacı şişirir ve bant koçun yapmadığı işi
  ona mal ederdi. (6) Ek `@Throttle` **yok**: iki kolonluk bir update, brifingin 10/dk'sı çağrı
  başına para harcadığı için sıkı.
  **Yanına sığan bir şey:** rapor artık "senin verdiğin 12 görevin 7'si yapıldı" diyor.
  `planCompletionRate7d` bilerek kullanılmadı — o, öğrencinin planladığı **her şeyi** kapsıyor ve
  çoğunu koç yazmadı. Bu, ekrandaki koç hakkında olan tek sayı; sayfanın zaten tuttuğu
  `assignedByCoach` satırlarından türüyor, uç yok, sorgu yok.
  **İlgili:** `apps/api/drizzle/0103_w8_mentorship_attention.sql`,
  `modules/mentorship/domain/attention.ts`,
  `modules/mentorship/application/mentorship-roster.service.ts` (`setAttention`),
  `modules/mentorship/infrastructure/{mentorship-link.repository.ts,mentorship-query.adapter.ts}`,
  `common/config/config.catalog.ts` (`mentorship.attention.ttl_days`),
  `packages/{types,validation}/src/mentorship.ts`,
  `apps/web/src/app/[locale]/(coach)/students/_components/{attention-button.tsx,student-card.tsx,cohort-summary.ts,roster-shell.tsx}`,
  `apps/web/src/app/[locale]/(coach)/students/[studentId]/_components/student-report-shell.tsx`,
  [`notifications.md`](./notifications.md).

- **Ücretli koltuk — Koç Pro (APP-079, 2026-09-05)** — Sponsorlu koltuk üç öğrenciyle sınırlıydı;
  artık koçun kendi planı fazlasını ödeyebiliyor. Koltuk hakkı = `mentorship.coach.free_seats` +
  koçun planının `seat_count`'u.
  **Planda `COACH_PRO` tier'ı vardı; yapılmadı, gerekmedi.** Tier'ın satın alacağı iki şey vardı:
  koçun kendi premium'u ve koltuk hakkı. Birincisi **zaten geliyor** — `coach-pro-10` sıradan bir
  abonelik, ACTIVE yolundan `isPremium: true` çıkıyor. İkincisi bir **sayı**, planın özelliği
  (`plans.seat_count`, migration `0101`). Yani `SubscriptionTier` FREE|PREMIUM kaldı ve
  `computeEntitlement` yine **hiç değişmedi**; üstündeki 18 test regresyon ağı olarak duruyor.
  Tek açık abonelik kısıtı da korundu: koç, öğrenci planı yerine koç planına abone oluyor, ikinci
  bir ürün doğmuyor.
  **Koltuk bitince bağ engellenmiyor.** Planın taslağında aşım `MENTORSHIP_SEAT_REQUIRED` (409) idi;
  yazarken yanlış olduğu görüldü. Kimin takip edilebileceği `max_active_students`, kimin Premium
  aldığı koltuk — ikincisini duvara çevirmek roadmap §5'in "bedava koçluk araçları" sözünü
  koçluğun kendisine konmuş bir paywall'a çevirirdi. Koltuk biterse öğrenci **bağlanır, sponsor
  edilmez**, ve kart bunu açıkça söyler.
  **Yeni modül oku: `mentorship → payments`.** APP-076 bu oku olaylarla kurmaktan bilerek
  kaçınmıştı; her koltuk bedavayken bu mümkündü. Koltuğa **para** girince kuplaj zaten var demektir,
  ve koltuk kararı kabul transaction'ının kilidi altında **senkron** verilmek zorunda — bir olay
  oraya çok geç varırdı. Döngü yok: payments identity/promotions/coaching import ediyor,
  mentorship'i değil (`mentorship → ai → payments` zaten vardı).
  **`paidSeatsFor` üç şeyi reddediyor:** açık aboneliği olmayan (0), `provider = 'SPONSOR'` olan
  (koç, koçlanıyor olmaktan koltuk türetemez) ve premium vermeyen durumlar (INCOMPLETE bir checkout
  henüz hiçbir şey satın almamıştır).
  **`mentorship.seats.billing_enabled` gerçek bir kapı.** Kapalıyken koç planları katalogda
  **listelenmiyor** _ve_ id'yle checkout **reddediliyor** (`PAYMENT_DISABLED`). Yalnız listeden
  gizlemek bir UI geleneği olurdu; iyzico doğrulanmadan satın alınabilir bir plan göstermek de
  olmayan bir akışı vaat etmek olurdu.
  **Fiyatlar PLACEHOLDER** — 999₺/10 koltuk, 1999₺/25. Faz-0 WTP araştırması hâlâ açık (roadmap §12).
  **Gotchas:** (1) `seat_count` `NOT NULL DEFAULT 0` olarak eklendi; Postgres 11+ varsayılanı
  katalogda tuttuğu için dolu tabloya rağmen rewrite yok, `NOT VALID` ayrımı gerekmiyor.
  (2) `AdminPlanDto.seatCount` **salt okunur**: koltuk sayısı bir ürün şekli, fiyat değil —
  tıklamayla değiştirilecek bir şey olmamalı, migration kararı. (3) `PlanDto`'ya da eklendi ki
  billing açıldığında katalog "Koç Pro 10"un ne verdiğini söyleyebilsin.
  **İlgili:** `apps/api/drizzle/0101_w8_coach_pro_seats.sql`,
  `modules/payments/application/subscriptions.service.ts` (`paidSeatsFor`, `listPlans`, `checkout`),
  `modules/mentorship/application/mentorship-link.service.ts`,
  `packages/types/src/{payments,mentorship}.ts`,
  `apps/web/src/app/[locale]/(coach)/students/_components/coach-capacity-card.tsx`.

- **Koç zekâ katmanı — AI brifingi (APP-078, 2026-09-05)** — Risk triyajı üç dilimdir kural
  temelliydi ve öyle kalıyor; brifing onun **üstüne** biniyor. `POST /v1/mentorship/students/:id/brief`
  raporun sayılarından üç bölümlük kısa bir özet yazıyor: bu hafta ne oldu, neden dikkat
  gerektiriyor, koç ne yapabilir.
  **Aktör özne değil — katalogdaki ilk özellik.** `PremiumFeatureGateService.assertAllowed` kotayı
  **isteyen** kullanıcıya yazar; burada isteyen koç, konu öğrenci. Kota, roller ve `ai_usage` satırı
  hep **koça** ait. Öğrencinin tier'ı hiç sorulmuyor: brifingi o istemedi, bedelini de ne kotayla ne
  parayla ödemeli. Bu, entitlement modelinin bugüne kadar hiç modellemediği bir ayrım; yeni bir
  mekanizma gerektirmedi çünkü doğru cevap "koçu geçir"di.
  **Yetki W8'de, metin W3'te.** `MentorshipBriefService` (W8) kapıyı ve önbelleği tutuyor,
  `MentorshipBriefService` (W3) yalnız yazıyor. AI servisi **hazır yetkilendirilmiş raporu argüman
  olarak alıyor** — kendi başına veri çekmiyor. Böylece `requireActiveLink`'i kazara bile atlayamaz
  ve koç bağının ne olduğunu hiç öğrenmez. Ok tek yönlü: `mentorship → ai`; `ai.module.ts`
  mentorship'i import etmiyor, döngü yok.
  **Güven çizgisi:** prompt'a giden tek şey `MentorshipStudentReportDto`, yani
  `cohort-evidence.ts`'in zaten çizdiği sözleşme. Ek olarak **isim de gitmiyor** (model, adını
  bildiği birini tanıdığını sanarak yazmaya başlıyor) ve **koçun kendi notu da gitmiyor** (geri
  beslersen model sayılara bakmak yerine nota katılıyor).
  **Kayıt: `MENTORSHIP_DATA_SCOPE`'a `AI_BRIEF`.** Brifing yeni bir kolon **okumuyor** — zaten
  kapsamdaki verilerden türüyor — ama **yöntem** yeni, ve "bir LLM benim hakkımda başkası için yazı
  yazıyor" bir öğrencinin "koçum aktivitemi görüyor"dan çıkarabileceği bir şey değil. Liste API'den
  geldiği için hem onay ekranı hem koçun aynası kendiliğinden güncellendi. Mevcut bağlar için kapsam
  genişlemesi: bayrak kapalı ve üretimde bağ yokken maliyeti sıfır (APP-066'nın `EXAM_TRACK` anı).
  **Önbellek link satırında, yeni tablo yok.** `coach_students.brief` + `brief_at` +
  `brief_fingerprint` (migration `0100`) — `coach_note` ile birebir aynı şekil ve aynı gerekçe.
  Parmak izi raporun **şekillendirilmiş** hâlini hashliyor, yani brifingin hiç görmediği bir alan
  önbelleği bozamıyor ve `MENTORSHIP_BRIEF_PROMPT_VERSION` hash'in içinde olduğu için sürümü
  yükseltmek hepsini bir anda geçersiz kılıyor. **KVKK bedava:** erasure link satırlarını siliyor,
  brifing onlarla gidiyor; erasure servisine tek satır eklenmedi. `end()` üçünü de temizliyor —
  yeniden bağlanma bu satırı canlandırıyor.
  **Register yeni.** Modüldeki diğer bütün prompt'lar öğrenciye "sen" diye sesleniyor
  (`companionPromptSystem` / `companionCoachOpening`). Bu, üçüncü bir kişi hakkında bir başkasına
  yazıyor; o sıcaklığı ödünç almak öğrenciyle konuşuyormuş gibi bir brifing üretirdi. Kendi kuralları
  var: risk flag'lerini yeniden adlandırma/çelişme yasak (kural motoru taban), `moodTrend`'den teşhis
  veya kişilik çıkarma yasak, resmi bilgi üretme yasak, veri inceyse "ince" de.
  **Gotchas:** (1) Uç **POST**, GET değil: LLM çağrısı ve kota harcıyor, bir sayfa yüklemesi ya da
  prefetch tetikleyememeli. Kart da mount'ta hiçbir şey istemiyor. (2) Throttle 10/dk — ödev
  ucundan (20/dk) daha sıkı, çünkü bu çağrı başına para harcıyor. (3) Ekonomi:
  `ai.features.mentorship.brief.free_{enabled,limit}`, ikisi de admin'den; free_enabled varsayılan
  **kapalı**. (4) `AiUsageFeature.MENTORSHIP_BRIEF` satırları **koçun** id'siyle yazılıyor, admin AI
  maliyet tablosunda "Koç brifingi" olarak görünüyor.
  **İlgili:** `apps/api/drizzle/0100_w8_mentorship_brief.sql`,
  `modules/ai/{domain/mentorship-brief-prompt.ts,application/mentorship-brief.service.ts}`,
  `modules/mentorship/application/mentorship-brief.service.ts`,
  `packages/types/src/{payments,mentorship}.ts`,
  `apps/web/src/app/[locale]/(coach)/students/[studentId]/_components/brief-card.tsx`,
  [`ai.md`](./ai.md), [`payments.md`](./payments.md).

- **Sponsorluk görünürlüğü ve acil fren (APP-077, 2026-09-05)** — APP-076
  `mentorship.coach.free_seats`'i "tüm maliyet riskini tutan tek düğme" diye tanımladı ama o
  düğmenin ne yaptığını gösteren hiçbir şey yoktu: `countByStatus()` sponsor satırlarını _aktif
  olarak_ filtreliyor ve başka hiçbir sorgu geri saymıyordu, `ai_usage`'ın da `subscriptions` ile
  hiçbir join'i yok. Yani "koltuk başına ne harcıyorum" — free_seats'in doğru olup olmadığına karar
  veren tek sayı — sorulamıyordu bile. Bayrağı canlıda açmanın ön koşulu buydu.
  **`GET /v1/admin/metrics/sponsorship`** — canlı koltuk sayısı, ayarın kendisi, kohortun 1/7/30
  günlük LLM maliyeti ve **koltuk başına 30 günlük maliyet**.
  **Tablolar buluşmuyor, admin orkestre ediyor.** Cevap `subscriptions` ile `ai_usage`'ı yan yana
  getirmeyi gerektiriyor ama ikisi ayrı modülün tablosu; SQL'de join etmek modül sınırını
  veritabanına taşırdı. Yerine iki public servis sırayla çağrılıyor: payments **kimin** koltuğu var
  der (`listSponsoredUserIds`), AI **ne harcadı** der (`costForUsersSince`). Admin, ikisini aynı
  anda tutmasına izin verilen tek yüzey — modülün varlık sebebi bu.
  **Koltuk yokken ortalama `null`, sıfır değil.** Sıfır "koltuklar bedava" diye okunur; boş
  kohortun anlamı bunun tam tersi. Ekranda tire çıkıyor.
  **Tavan gürültülü.** `listSponsoredUserIds` 1000'de kesiyor; aşılırsa DTO `truncated: true`
  taşıyor ve kart "eksik sayıyor" uyarısı gösteriyor — sessizce kısmi bir ortalama vermektense.
  **Acil fren: bayrak artık gerçekten kesiyor.** `mentorship.seats.sponsorship_enabled` baştan beri
  yeni sponsorlukları kapatıyordu ama mevcutlara dokunmuyordu — yani bir kapı vardı, fren yoktu.
  Artık kapatmak canlı koltukları da `EXPIRED` yapıyor. Premium maliyetli diye düğmeye basan
  operatör "şimdi" demek istiyor, "bir sonraki öğrenciden itibaren" değil.
  **`free_seats` bilerek geriye dönük DEĞİL.** Kotayı düşürmek kimden koltuk alınacağını şekillendirir,
  verilmiş olanı geri almaz — hangi ikisinin kalacağı da keyfi olurdu. İki düğme, iki şiddet.
  **Bayrağı geri açmak hiçbir şeyi geri getirmiyor:** koltuk kararı kabul anında veriliyor.
  **Mekanizma:** `ConfigRegistryService.set` artık `config.changed` olayı yayıyor; payments'taki
  `SponsoredSeatListener` yalnız kendi anahtarını dinliyor. Genel bir olay, çünkü alternatif admin
  config uç noktasına payments'a özel bir çağrı koymaktı — kill-switch bilgisi sonucun sahibi olan
  modülde kalsın diye.
  **Ayrı bütçe tavanı eklenmedi, bilerek.** Sponsorlu kohort global `ai.budget.monthly_cap_usd_cents`
  tavanını yiyip **ödeyen** kullanıcıları 503'e düşürebilir. Gerçek veri olmadan tavan uydurmak
  yanlış yerden kesen bir fren takmak olurdu ve bu dilim tam da o veriyi üretiyor. Bayrak kapalı,
  `free_seats` düşük, kill-switch var. Karar [`payments.md`](./payments.md)'ye yazıldı ki sonraki
  okuyan bunun bir unutma değil tercih olduğunu bilsin.
  **Gotchas:** (1) `costForUsersSince` boş dizide sorgu **atmıyor** — `in ()` bazı sürücülerde
  "hepsi" demek. (2) Sorgu `ai_usage`'ın mevcut `(user_id, created_at)` index'ini kullanıyor, yeni
  index gerekmedi. (3) "Kaç koç sponsorluyor" **yok**: `coach_students`'a join gerektirirdi
  (payments → mentorship tablo sınırı) ve kararı veren sayı değil.
  **İlgili:** `modules/admin/presentation/admin-metrics.controller.ts`,
  `modules/payments/application/sponsored-seat.{service,listener}.ts`,
  `modules/payments/infrastructure/payments.repositories.ts`,
  `modules/ai/{application/ai-cost-stats.service.ts,infrastructure/ai-usage.repository.ts}`,
  `common/config/config-registry.service.ts`, `apps/admin/src/app/SponsorshipCards.tsx`.

- **Sponsorlu koltuk — koçun bağladığı öğrenci Premium alıyor (APP-076, 2026-09-05)** — W8 bugüne
  kadar parasal hiçbir şey bilmiyordu; tek sınır `max_active_students` idi ve aşımı bir hataydı.
  Artık koçun **koltuğu** var: bağladığı ilk `mentorship.coach.free_seats` (3) öğrenci Premium'a
  erişiyor.
  **Guardrail bilerek genişletildi.** AGENTS.md §4 #4 "AI'ı tattıran **iki** yol" diyordu; artık
  **üç**. Kaldırılmadı, koşulu adlandırıldı: yol kürasyonlu COACH rolüne, config'li koltuk sayısına
  ve `mentorship.seats.sponsorship_enabled` bayrağına bağlı, ve harcadığı her çağrı hâlâ
  `ai.budget.monthly_cap_usd_cents` tavanının altında. Roadmap §7'nin "koçtan abonelik sıkma"
  kararına da revizyon notu düşüldü.
  **`free_seats` tüm maliyet riskini tutan tek düğme:** koç sayısı × koltuk = bedava premium.
  **Mimari: sponsorluk gerçek bir `subscriptions` satırı, ikinci entitlement kaynağı değil.**
  `getEntitlement` neredeyse her istekte çağrılıyor; oraya modüller arası bir join koymak tüm
  platformun sıcak yolunu bir avuç kişi için zehirlerdi. Satır yazmak sayesinde `computeEntitlement`
  **tek satır bile değişmedi** — 18 testlik entitlement spec'i regresyon kalkanı olarak duruyor.
  **Modüller arası ok yok.** W8 koltuğa karar veriyor (kabul transaction'ının kilidi altında,
  `activeBefore` sayımından), olaya `seatKind` koyuyor; W4'ün yeni `SponsoredSeatListener`'ı onu
  okuyor. `PaymentsModule` `MentorshipModule`'ü import etmiyor, tersi de. W5'in
  `MentorshipEventsListener`'ıyla birebir aynı desen.
  **Süresiz ACTIVE, cron yok.** Sponsor satırı `currentPeriodEnd: null` ile yazılıyor; `ACTIVE` dalı
  bitiş tarihi yokken süre kontrolü yapmıyor (STAFF'ın `validUntil: null` deseni). Aylık uzatma
  cron'u gerekmedi.
  **Değişen üç sayım** — atlanırsa sessiz yanlış üretirlerdi: (1) `hasAnyForUser` sponsor satırını
  saymıyor, yani koçluk biten öğrencinin **kendi trial hakkı duruyor** — dönüşüm için en değerli an
  o. (2) `countByStatus` sponsor satırını dışlıyor; yoksa her bedava koltuk `conversionRate`'in
  paydasını şişirip huniyi olduğundan kötü gösterirdi. (3) `checkout` açık satır SPONSOR ise
  `PAYMENT_ALREADY_SUBSCRIBED` atmıyor, koltuğu emekliye ayırıp öğrencinin kendi aboneliğine yol
  veriyor.
  **Gotchas:** (1) `revoke` satırı **doğrudan EXPIRED** yazıyor, yalnız `currentPeriodEnd`
  doldurmuyor: `listMaybeRanOut` dunning grace'ini bekliyor, yani satır 3 gün daha açık kalır ve
  `findOpenForUser` öğrenciyi kendi checkout'undan alıkoyardı. (2) `coach-seat` planı `is_active`
  ama `findActive()` onu **adıyla dışlıyor** — `purchaseEnabled` plan başına değil global bir
  anahtar olduğu için, katalogda görünseydi yanında satın alma düğmesi de olurdu. (3) `/abonelik`
  sponsorlu koltukta "otomatik yenilenir" **demiyor** ve **iptal düğmesi göstermiyor**: arkasında
  kart yok, `providerRef` null, ve koltuk dönem sınırında değil bağ bitince biter. (4) Öğrencinin
  kendi açık aboneliği varsa sponsor satırı **hiç yazılmıyor** — kısmi unique index zaten tek açık
  abonelik istiyor, ve ödenmiş bir şeyin bedava koltukla yer değiştirmesi olmaz.
  **Bilerek yapılmayanlar:** onay ekranında "sana Premium açılacak" sözü yok (preview ile kabul
  arasında son koltuk dolabilir; tutamayacağımız söz vermeyiz) · sponsorluk bildirimi yok (bağ
  bitince öğrenci zaten "bağlantın sonlandı" bildirimi alıyor, `/abonelik` de durumu gösteriyor) ·
  ücretli koltuk ve Pro tier (APP-077, iyzico doğrulanana kadar açılamaz).
  **İlgili:** `apps/api/drizzle/0099_w8_sponsored_seat.sql`,
  `modules/payments/application/{sponsored-seat.service.ts,sponsored-seat.listener.ts}`,
  `modules/payments/infrastructure/payments.repositories.ts`,
  `modules/mentorship/{domain/mentorship.constants.ts,application/mentorship-link.service.ts}`,
  `packages/types/src/{payments,mentorship}.ts`,
  `apps/web/src/app/[locale]/(app)/subscription/_components/subscription-facts.ts`,
  [`AGENTS.md`](../../AGENTS.md) §4 #4, [`payments.md`](./payments.md).

- **Admin'de koç görünürlüğü (APP-075, 2026-09-05)** — `GET /v1/admin/users` yalnız serbest metin
  araması alıyordu; rol bir ismin ya da e-postanın parçası olmadığı için **"kim koç" sorusu
  sorulamıyordu**. Bayrağı ilk kez açacak operatörün ilk sorusu tam olarak buydu.
  **Yeni uç yok, yeni modül bağımlılığı yok:** `searchUsersQuerySchema`'ya `role` eklendi,
  repository bir `roles @> ARRAY[:role]::text[]` koşulu ekliyor. `@>` (containment) seçildi çünkü
  `roles` bir `text[]` ve dizi index'inin cevaplayabileceği soru bu; `= ANY` değil.
  **`q` ile birlikte çalışıyor**, birbirini ezmiyor: ikisi de verilirse ikisi de uygulanır.
  **Öğrenci sayıları kapsam dışı bırakıldı** — admin→mentorship modül bağımlılığı gerektirirdi ve
  filtrelenmiş liste operatörün asıl sorusunu zaten cevaplıyor. Gerektiğinde `MentorshipModule`'ün
  export ettiği bir servisle eklenir.
  **Gotchas:** (1) Bilinmeyen rol **400** döner, boş liste değil: `z.nativeEnum(UserRole)` kenarda
  reddediyor. Sessizce boş dönmek "bu rolde kimse yok" gibi okunurdu. (2) Filtre listesi
  (`FILTERABLE_ROLES`) `STUDENT`'ı dışarıda bırakıyor — her hesapta var, dolayısıyla hiçbir şeyi
  süzmez. (3) Rol seçimi forma basmadan yüklüyor (select'in `onChange`'i), arama kutusu ise
  submit bekliyor; ikisi de aynı `load(q, role)` çağrısına gidiyor.
  **İlgili:** `packages/validation/src/admin.ts`,
  `modules/admin/{infrastructure/admin-users.repository.ts,application/admin-users.service.ts,presentation/admin-users.controller.ts}`,
  `apps/admin/src/{lib/roles.ts,app/(general)/users/page.tsx}`, [`admin.md`](./admin.md).

- **Program şablonu — bir haftayı kaydet, başka öğrenciye uygula (APP-074, 2026-09-05)** — Besteci
  öğrenci başına çalışıyordu; aynı programı ikinci öğrenciye vermek sıfırdan yazmak demekti. 20
  öğrenci kotasındaki gerçek darboğaz buydu (roadmap §9'un "aynı ekiple 2-3x öğrenci" iddiası).
  **En kritik karar: şablon UYGULANMIYOR, bestecinin içine YÜKLENİYOR.** Ayrı bir `apply` ucu yok.
  Sebep teknik değil, doğruluk: `topic` sunucuda öğrencinin sınav taksonomisine karşı **hiç
  doğrulanmıyor** — `refinePlanTaskTaxonomy` yalnız "konu dersi ister" diyor. Tek gerçek kapı
  bestecinin `useExamTopicTaxonomy` seçicisi. Sunucu tarafı bir apply, KPSS için yazılmış bir konuyu
  YKS öğrencisine sessizce yazardı. Yükleme taslakları dolduruyor, yazma gene
  `POST /students/:id/assignments` ile oluyor: 21 tavanı, 120 gün ufku, 20/dk throttle ve
  all-or-nothing tx aynen geçerli, ikinci bir yazma yolu doğmuyor.
  **Sınav uyuşmazlığı sessiz değil.** Şablonun `examType`'ı öğrencininkinden farklıysa konular
  düşürülüyor ve **kaç tanesinin düştüğü söyleniyor**; ders kalıyor (ders koçun elle de yazabileceği
  geniş bir etiket, sınava özgü olan onun altındaki dal). Yarısını sessizce kaybeden bir şablon,
  hiç yüklenmeyeninden kötüdür: koç kalanı bütün program sanıp atar.
  **Model:** `mentorship_program_templates` (migration `0098`) — `tasks` jsonb, alt tablo değil
  (dizi 21 ile sınırlı, hep bütün okunuyor, alanına göre hiç sorgulanmıyor). `UNIQUE (coach_id, name)`
  upsert anahtarı: **ada göre kaydetmek düzenlemenin ta kendisi**, ayrı PUT yok.
  **`dayIndex` 0..6 değil 0..20:** bestecinin 21 tavanı zaten "üç hafta"; hafta düğmesine basmak
  önceki taslakları yerinde bıraktığı için bir program bugün bile birden fazla haftaya yayılabiliyor.
  Ofset programın **kendi ilk gününden** sayılıyor (en erken görev 0), yeniden tarihlenebilirliğin
  şartı bu.
  **Kota kilitsiz.** Sayım ve insert tek transaction'da ama advisory lock yok — `acceptInvite`'in
  aksine burada kota, sayacı olmayan bir davet kodunun tek sınırı değil, koçun kendi listesinin
  düzen tavanı; yarışın üretebileceği en kötü şey 20 yerine 21 şablon.
  **Erasure açık yazılmak zorunda.** `coach_id` FK'sı ON DELETE CASCADE taşısa da erasure `users`
  satırını **anonimleştiriyor, silmiyor** — cascade hiç ateşlenmiyor. `mentorship_dropped_assignments`
  cascade'e güvenebiliyor çünkü o link'e bağlı ve link'ler gerçekten siliniyor.
  **Yan temizlik:** besteci 362 satırdı; `ComposerSelect` (eski `TaxonomySelect`, artık
  `{value,label}` alıyor) ve `composer-dates.ts` ayrı dosyalara çıktı.
  **Gotchas:** (1) `mentorshipTemplateTaskSchema` `planTaskFieldsSchema`'dan türetiliyor,
  `mentorshipAssignmentTaskSchema`'dan değil: ikincisi `.superRefine` ile bitiyor, yani `ZodEffects`,
  ve `ZodEffects` `.pick()`/`.omit()` kabul etmiyor. (2) Şema `.strict()`; `taskDate` göndermek 400
  döner — şablonun taşıyamayacağı bir alanı sessizce kırpmak koça olmayan bir şey kaydettiğini
  düşündürürdü. (3) `0098`'deki FK `NOT VALID` taşımıyor ve taşımamalı: tablo aynı migration'da boş
  doğuyor. (4) Şablon **hiçbir öğrenciden bahsetmiyor**, dolayısıyla `requireActiveLink` bu uçlara
  uygulanmıyor; sahiplik repository'de her okuma ve silmede `coach_id` filtresiyle duruyor ve
  başkasının id'si 404 (403 değil) dönüyor.
  **İlgili:** `apps/api/drizzle/0098_w8_mentorship_program_templates.sql`,
  `modules/mentorship/{infrastructure/mentorship-template.repository.ts,application/mentorship-template.service.ts,application/mentorship-erasure.service.ts}`,
  `packages/{types,validation}/src/mentorship.ts`,
  `apps/web/src/app/[locale]/(coach)/students/[studentId]/_components/{template-apply.ts,template-bar.tsx,composer-select.tsx,composer-dates.ts,assign-task-form.tsx}`,
  `apps/web/src/lib/mentorship.ts`, `apps/web/messages/{tr,en}.json`.

- **Roster'dan kokpite — kohort özeti, kontenjan ve kapsam aynası (APP-073, 2026-09-05)** — Roster
  bir liste idi; roadmap §9'un "koç panele girince **kim geride, neden, ne yapmalı** öne çıkar"
  vaadinin yalnız ilk üçte biri karşılanıyordu. Aynı ekrana üç şey eklendi ve hiçbiri yeni bir
  sorgu istemiyor.
  **Bloklayıcı bulgu — kontenjanın faturası öğrenciye kesiliyordu.**
  `mentorship.coach.max_active_students` (20) yalnız `acceptInvite` içinde kontrol ediliyor, yani
  tavanı **üzerinde hiçbir tasarrufu olmayan taraf** öğreniyordu: koç kodu paylaşıyor, 21. öğrenci
  409 yiyor, koç bunu hiç duymuyor. `GET /v1/mentorship/invite-code` yerine
  `GET /v1/mentorship/overview` geldi (`inviteCode` + `activeStudents` + `maxActiveStudents` +
  `dataScope`); davet kartı artık "3/20 öğrenci" diyor, dolu iken de bunu söylüyor.
  **Sayımın tek tanımı var.** `acceptInvite`'in advisory lock'u içindeki ACTIVE sayımı modül-özel
  `countActive(tx, coachId)` fonksiyonuna çıkarıldı; `countActiveByCoach` onu kendi
  `withServiceContext`'i içinde çağırıyor. Ayrı bir sayım yazmak, başlığın vaat ettiği koltuğu
  kabulün reddettiği bir durum üretebilirdi.
  **Kohort bandı backend'siz.** Sayfa zaten `pageSize=100` ile tüm ACTIVE satırları çekiyor (kota
  20), dolayısıyla özet saf bir fonksiyon: `summarizeCohort` → ilgi bekleyen sayısı, flag dağılımı
  ve plan uyumu ortalaması. **Ortalama `planCompletionRate7d === null` satırlarını paydadan
  düşürüyor**, sıfır saymıyor: aksi halde plan ekranını hiç açmamış bir kohort "plan yapıp
  tutturamayan" bir kohort gibi okunur, ve koç yanlış soruna müdahale ederdi. Payda da ekranda
  duruyor ("%50 (2 öğrenci)") — 2 kişiden alınan ortalama 20 kişiden alınanla aynı iddia değil.
  **"Ne yapmalı" öğrenci başına tek satır**, en kötü flag'e göre. Kod tablosu yok: eşleme `action_{FLAG}`
  i18n anahtarının kendisi. En kötü flag'i **istemci seçmek zorunda**, çünkü `evaluateRiskFlags`
  değerlendirme sırasıyla dönüyor (PLAN_SLIPPING, LOW_MOOD'dan önce) ama şiddet sırası tersi;
  `compareByRisk` satırları sıralıyor, bir satırın içindeki flag'leri hiç sıralamıyor.
  **Kapsam aynası.** Öğrenci kabul öncesi tam onam ekranı görüyordu, koç ise boş bir listeye
  düşüyordu — güven çizgisinin kaldıramayacağı tek asimetri, veriyi **alan** tarafın sınırları
  hakkında **veren** taraftan az bilmesi. `dataScope` koç tarafında da API'den geliyor, sabitten
  değil; iki ekran tek sözleşmeyi anlatıyor ve istemcideki ikinci bir kopya sürüklenecek ikinci
  bir yer olurdu. Kart `<details>`, state hook'u yok, ve boş roster'da açık açılıyor.
  **Gotchas:** (1) Öneri satırı **düz metin**, link değil: kartın tamamı zaten rapora giden bir
  `<Link>` ve içine ikinci bir `<a>` koymak geçersiz HTML üretirdi. Rapor sayfasında not alanı ve
  besteci zaten yan yana duruyor, çapa kazancı bir kaydırma. (2) `FLAG_ORDER` API'nin `SEVERITY`
  dizisinin kopyası; paylaşılmadı çünkü sınırı yalnız sunum için geçiyor — sürüklenirse çipler
  yeniden sıralanır, hiçbir şey yanlış sayılmaz. (3) `?status=ENDED` sekmesinde özet bandı
  render **edilmiyor**: o satırların `metrics`'i zaten `null` ve kapanmış bir pencereyi özetlemek
  "metrics null" kuralını arka kapıdan delerdi. (4) Kontenjan doluyken **kod yenileme
  engellenmedi**: dolu bir roster de boşalır, ve engellemek sunucuda olmayan bir kural icat etmek
  olurdu. (5) `roster-shell.tsx` 320 → 170 satır; `StudentCard` kendi dosyasına çıktı ve
  `(coach)` grubu ilk kez sayfaya özel iskeletine kavuştu (frontend.md § Loading skeletons).
  (6) `MENTORSHIP_STUDENT_QUOTA_EXCEEDED` kopyası çıkmaz sokaktı ("Bu koçun öğrenci kontenjanı
  dolu."); `MENTORSHIP_INVITE_EXPIRED`'ın deseniyle sonraki adım eklendi.
  **İlgili:** `modules/mentorship/{application/mentorship-link.service.ts,infrastructure/mentorship-link.repository.ts,presentation/mentorship-coach.controller.ts}`,
  `packages/types/src/mentorship.ts` (`MentorshipCoachOverviewDto`),
  `apps/api/src/i18n/locales/{tr,en}/errors.json`,
  `apps/web/src/app/[locale]/(coach)/students/_components/{cohort-summary.ts,cohort-summary-card.tsx,coach-capacity-card.tsx,coach-scope-card.tsx,student-card.tsx,roster-content-skeleton.tsx,roster-shell.tsx}`,
  `apps/web/src/lib/mentorship.ts`, `apps/web/messages/{tr,en}.json`,
  [`mvp-status.md`](../core/mvp-status.md) (W8 satırı eklendi).

- **Mentorship'in tarayıcı kapsamı (APP-072, 2026-09-04)** — 24 Playwright spec'i vardı ve
  hiçbiri mentorship'e değmiyordu; W8'in en yeni yüzeyi aynı zamanda tarayıcıda hiç koşmayan
  tek yüzeydi. `apps/web/e2e/mentorship.spec.ts` iki masaüstü/mobil projede 18 test koşuyor.
  **Öğrenci yarısı bayrak kapısı:** profil satırı → `/kocum` → `/kocluk-daveti` → veri kapsamı →
  kabul. Bu tam yol APP-069'a kadar hiç var olmadığı için, geri gitmesi de en kolay olan yol.
  Ayrıca üç sözleşme maddesi kilitlendi: kodu **okumak** kabul değil (`acceptCalls === 0`),
  `?code=` yalnız alanı dolduruyor (`previewCalls === 0`), bayrak kapalıyken ekran hata değil
  "kapalı" durumu gösteriyor.
  **Koç yarısı** üç dilimin görünür iddialarını doğruluyor: hazır davet linki panoya
  `/kocluk-daveti?code=…` olarak gidiyor, rapor silinen ödevi gösteriyor, "geçen haftayı kopyala"
  taslak sayacını 0/21'den 1/21'e taşıyor, not `PUT .../note` gövdesine düşüyor.
  **Backend gerekmiyor:** harness `page.route()` ile `/v1/**` mock'luyor, mevcut spec'lerin deseni.
  **Gotchas:** (1) Kopyalama testi "Kendi çalışmam" başlığının **yokluğunu** iddia edemiyor —
  raporun plan listesi aynı satırları sayfanın altında zaten render ediyor. Süzme iddiası
  `repeat-week.spec.ts`'te; e2e'nin işi düğmenin ona bağlı olduğunu göstermek, sayaç bunu tek
  başına taşıyor. (2) Kaynak hafta `daysFromToday()` ile tarayıcının kendi takviminden üretiliyor;
  sabit tarih yazmak testi birkaç ay sonra sessizce kırardı.
  **İlgili:** `apps/web/e2e/mentorship.spec.ts`, `apps/web/e2e/profile.spec.ts` (mock deseni).

- **Koçun öğrenciye duran notu (APP-071, 2026-09-04)** — Koçun öğrencinin dünyasına yazabildiği tek
  şey bir ödevdi; "bu hafta paragrafa ağırlık ver" demek için cümleyi bir görev başlığına
  sıkıştırmak gerekiyordu. Artık link'e bağlı **tek bir duran not** var: öğrenci `/kocum`'da görüyor,
  koç raporunda kendi yazdığını geri okuyor.
  **Kanal değil.** Thread yok, cevap yok, okundu bilgisi yok; `PUT` ile satır **değiştiriliyor**,
  geçmiş tutulmuyor. Faz 2'de iletişim platform dışı, in-app chat Faz 3 (roadmap §9) — bu dilim o
  çizgiyi geçmiyor, sadece koçun tek yönlü sesini ödeve bağlı olmaktan kurtarıyor.
  **Model:** `coach_students`'a iki nullable kolon, `coach_note` + `coach_note_at` (migration
  `0097`). Ad `plan_tasks.coach_note` ile bilerek aynı: aynı ses (koçun kendi sözleri, öğrencinin
  `description`'ı hâlâ koça kapalı), farklı kapsam — biri göreve biniyor, bu tek başına duruyor.
  Ayrı tablo yok; tek not tutuluyorsa ikinci bir tablo yalnız ikinci bir doğruluk kaynağı olurdu.
  **`end()` notu siliyor.** Zorunlu: yeniden bağlanma ENDED satırını **canlandırıyor**
  (`onConflictDoUpdate` + `setWhere: status = 'ENDED'`), temizlenmezse iki tarafın da bıraktığı bir
  ilişkiden kalma cümle aylar sonra geri gelirdi. e2e bunu mevcut "iptal et → geri dön" akışının
  içinde doğruluyor.
  **Bildirim:** `mentorship.note.updated` → öğrenciye in-app, `/my-coach` deep-link'i, günlük
  dedupe (`mentorship-note:{studentId}:{todayIso()}`) — bir cümleyi beş kez düzelten koç hâlâ tek
  haber. Push yok, e-posta yok. **Notu silmek hiç olay yaymıyor:** "koçun bir şeyi kaldırdı"
  bildirimi kimseye bir şey öğretmez, kartın yokluğu zaten mesajın kendisi.
  **KVKK:** `MENTORSHIP_DATA_SCOPE` koçun **okuduğunu** tanımlıyor, not okuma değil yazma → yeni
  scope anahtarı eklenmedi. Yalnız `scope_coach_writes` kopyası güncellendi (eskiden sadece ödev
  altındaki nottan bahsediyordu).
  **Gotchas:** (1) `toCoachNoteDto` iki kolonu birlikte okuyor ve biri eksikse `null` dönüyor;
  gövdesiz zaman damgası ya da tersi API'nin kazara üretebileceği bir durum olmamalı. (2) Yeni e2e
  testi `invitations/accept` çağırmıyor: o uç 5/dk throttle'lı ve suite'in bütçesini tüketmek
  sonraki testleri 429'a düşürüyor — canlanma iddiası zaten var olan iptal/geri-dönüş testine
  eklendi. (3) `0097` yalnız nullable kolon ekliyor, CHECK/FK yok → dolu tabloya rağmen
  `NOT VALID` gerekmiyor.
  **İlgili:** `modules/mentorship/application/mentorship-link.service.ts`,
  `modules/mentorship/domain/coach-note.ts`,
  `modules/mentorship/infrastructure/mentorship-link.repository.ts`,
  `modules/notifications/application/listeners/mentorship-events.listener.ts`,
  `drizzle/0097_w8_mentorship_coach_note.sql`,
  `apps/web/src/app/[locale]/(coach)/students/[studentId]/_components/coach-note-card.tsx`,
  `apps/web/src/app/[locale]/(app)/my-coach/_components/my-coach-shell.tsx`.

- **Silinen ödevlerin raporda kalması (APP-070, 2026-09-04)** — Rapor **yaşayan** planı
  gösteriyordu, dolayısıyla öğrenci koç ödevini sildiğinde satır sessizce kayboluyor ve koç bu
  yokluğu "hiç atanmamış" diye okuyordu. APP-068 anlık bir bildirim getirmişti ama bildirim geçmiş
  değil: kutudan düşünce geriye hiçbir şey kalmıyordu. Backlog #1 kapandı.
  **Model:** `mentorship_dropped_assignments` (migration `0096`) — append-only, satır bir kez
  yazılır. `link_id` **gerçek FK + ON DELETE CASCADE**; `plan_tasks.origin_ref_id`'nin aksine bu
  kolon modül sınırını aşmıyor, W8'in kendi tablosunu gösteriyor. Cascade aynı zamanda tüm KVKK
  hikâyesi: `MentorshipErasureService` link satırlarını anonimleştirmiyor **siliyor**, kayıtlar da
  onlarla gidiyor; erasure servisine tek satır eklenmedi.
  **Yalnız silme loglanıyor.** Tamamlanan görev planda DONE olarak duruyor, MENTORSHIP görevi
  yeniden adlandırılamıyor ve taşınamıyor (`assertMentorshipTaskEditable`) — bilgi kaybının tek
  yolu silme. İkinci bir "atandı" logu aynı gerçeği iki yerde tutmak olurdu.
  **W2'ye hiç dokunulmadı:** `PlanTaskDeleted` zaten `taskDate` + `title` taşıyor ve W8'in kendi
  `PlanTaskFeedbackListener`'ı `origin_ref_id`'yi link'e çözüyordu; eksik olan tek şey kalıcılıktı.
  **Sıra: önce bildir, sonra logla.** İkisi de patlayabilir ve korunmaya değer yarı zamanında gelen
  sinyal: hiç haber alamayan koç müdahale edemez, eksik bir geçmiş satırı ise yalnız retrospektifi
  götürür. Log yazımı patlarsa `catch` logluyor, bildirim gitmiş oluyor.
  **Rapor:** `MentorshipStudentReportDto.droppedAssignments`, `planTasks` ile aynı 14 günlük
  pencere ve aynı `link.id` scope'u — koç bir öncekinin sildiklerini de görmüyor. Ekranda plan
  kartının içinde, ayrı kart değil: çoğu öğrencide boş olurdu.
  **Yan temizlik:** roster dilimi geldiğinden beri ölü olan `MentorshipLinkService.listStudents()`
  ve `MentorshipStudentDto` silindi (controller `MentorshipRosterService`'e gidiyor);
  `assertEnabled` ham `"mentorship.enabled"` dizesi yerine tüketicisi olmayan
  `FeatureFlag.MENTORSHIP_ENABLED` sabitini kullanıyor.
  **Gotchas:** (1) Cascade yalnız link'in **silinmesi** doğru olduğu sürece yeterli; erasure bir gün
  anonimleştirmeye dönerse log ayrıca temizlenmeli (servis yorumunda yazılı). (2) `0096`'daki FK
  `NOT VALID` taşımıyor ve taşımamalı — tablo aynı migration'da **boş** doğuyor, backend.md'nin
  kuralı dolu tablolara (`plan_tasks` gibi) bakıyor. (3) e2e sıralı bir suite: yeni test tek başına
  (`-t`) çalışmaz, komşuları da çalışmıyor; sözleşme tam koşu.
  **İlgili:** `modules/mentorship/infrastructure/mentorship-dropped-assignment.repository.ts`,
  `modules/mentorship/application/plan-task-feedback.listener.ts`,
  `modules/mentorship/application/mentorship-roster.service.ts`,
  `drizzle/0096_w8_mentorship_dropped_assignments.sql`,
  `apps/web/src/app/[locale]/(coach)/students/[studentId]/_components/student-report-shell.tsx`.

- **Davet akışının ulaşılabilirliği ve "geçen haftayı kopyala" (APP-069, 2026-09-03)** — Yalnız
  `apps/web`; migration ve API değişikliği yok.
  **Bloklayıcı bulgu:** `/kocum` ve `/kocluk-daveti` ekranlarına uygulamada **hiçbir giriş noktası
  yoktu** — ne alt sekmede, ne kenar çubuğunda, ne profilde, ne ayarlarda. `/kocluk-daveti`'ye tek
  yol `/kocum`'un boş-durum butonu, `/kocum`'a tek yol bir MENTORSHIP bildirimiydi; yani bildirim
  alabilmek için zaten bağlı olman gerekiyordu. Eline davet kodu verilen öğrenci ekrana hiç
  ulaşamıyordu. Backend altı dilimdir hazırdı ama `mentorship.enabled` bugün açılsa çıkmaz sokak
  yayınlanmış olacaktı. Profil hesap kartına `/kocum` satırı eklendi; ekran iki durumu zaten kendisi
  ayırt ediyor (koç yoksa davet ekranına CTA, varsa veri kapsamı sözleşmesi).
  **Koç tarafı:** davet kartına "Linki kopyala" — `{origin}/kocluk-daveti?code=…`. Koçun gerçekte
  yaptığı şey kodu bir mesajda paylaşmak; kod butonu duruyor, link onun yanına geldi.
  **Besteci:** "Geçen haftayı kopyala". Kaynak, sayfanın zaten yüklediği raporun `planTasks`'i →
  ek istek yok. Yalnız `assignedByCoach` satırları kopyalanır: raporun geri kalanı öğrencinin
  kendi planı ve onu kaldırmak öğrencinin tercihlerini koçun ödevine çevirirdi. 21 tavanına kadar
  doldurur, mevcut taslakların **üstüne** ekler.
  **Gotchas:** (1) Kaynak pencere `weekStart`'a değil **bugüne** göre: besteci geleceğe park
  edilmiş olabiliyor ve "baktığım haftadan önceki hafta" raporun 14 günlük penceresinden çıkıp
  sessizce boş dönerdi. Hafta düğmesi tam 7 gün adımladığı için haftanın içindeki gün her iki
  okumada da korunuyor. (2) `(app)` grubunun `route-message-scopes.json`'da kaydı yok →
  `getMessages()` ile **tüm** namespace'leri alıyor, profil kartı bu yüzden `mentorship`
  namespace'ini doğrudan kullanabiliyor. `(coach)` grubu scope'lu, oraya bir namespace eklemek
  gerekirse `coaching` satırı da güncellenmeli, yoksa `pickMessages` fırlatır. (3) Bayrak
  kapalıyken `/kocum` artık hata toast'ı değil "koçluk şu an kapalı" boş durumu gösteriyor:
  profil satırı bayraktan bağımsız görünür, ve kill-switch bir arıza değil bir durum.
  (4) `?code=` hâlâ yalnız alanı dolduruyor — link kopyalamak rızayı otomatikleştirmiyor,
  öğrenci gene kodu getirip veri kapsamını okuyup onaylıyor.
  **İlgili:** `apps/web/src/app/[locale]/(app)/profile/_components/account-links-card.tsx`,
  `apps/web/src/app/[locale]/(app)/my-coach/_components/my-coach-shell.tsx`,
  `apps/web/src/app/[locale]/(coach)/students/_components/roster-shell.tsx`,
  `apps/web/src/app/[locale]/(coach)/students/[studentId]/_components/repeat-week.ts` (+ spec),
  `apps/web/messages/{tr,en}.json`.

- **Code review düzeltmeleri — W8 üç dilim (2026-09-03)** — Üç PR'ın (besteci · risk özeti · geri
  bildirim döngüsü) max-effort incelemesinde çıkan yedi bulgu kapatıldı.
  **(1) Bloklayıcı:** tamamlama bildiriminin dedupe anahtarı görevin **planlandığı** günü
  taşıyordu (`mentorship-progress:{studentId}:{taskDate}`). Haftalık besteci 7 farklı tarihe görev
  yazdığı için, birikmiş haftayı bir akşamda bitiren öğrenci koça **7 ayrı bildirim** gönderiyordu
  — dedupe'un önlemek için var olduğu "completion storm"un ta kendisi. Anahtar artık teslim günü
  (`todayIso()`), ve `MentorshipAssignmentProgressed` hiç tarih taşımıyor: çökme yapısal.
  **(2)** `plan_tasks.topic` artık `planTaskFieldsSchema`'da olduğu için öğrenci kendi görevine de
  konu yazabiliyordu; ardından `PATCH {subject: null}` göndermek `plan_tasks_topic_requires_subject_chk`
  ihlaline ve meşru bir düzenleme için açıklamasız 400'e yol açıyordu. `update()` artık `subject`
  null'a çekilirken `topic`'i de temizliyor. `refinePlanTaskTaxonomy`'nin "her iki tarafta" sözü
  yalnız create yollarında tutuluyordu.
  **(3)** Risk özeti `{rest}` argümanını hesaplayıp hiçbir kopyada render etmiyordu: 5 öğrencilik
  bir özet başlıkta "5" deyip gövdede 2 isim sayıyor, kalan 3'ü sessizce düşürüyordu. Artık isim
  sınırı yok (dedupe zaten yalnız **yeni** işaretleri gönderdiği için liste kısa kalıyor) ve
  `count` isim sayısıyla birebir; hiç isim çözülemezse bildirim hiç gönderilmiyor.
  **(4)** `MentorshipQueryAdapter` koç başına sıralı `getNotificationContact` çağırıyordu (N+1);
  metodun geri kalanı batch'liyken. `Promise.all`'a alındı.
  **(5)** `MentorshipAssignmentInput`'taki `Omit<…, "description">` bir çağıranın `description`
  geçmesini **engellemiyor** (TS'te omit edilmiş tip hâlâ atanabilir), alan da yazımda sessizce
  düşüyordu — checklist'in yasakladığı sessiz fallback. `description?: never` ile derleme hatası.
  **(6)** Düşürülen ödev bildirimi Türkçe metne ham ISO tarih (`2026-09-10`) basıyordu; tarih
  kopyadan çıkarıldı (başlık görevi zaten tanımlıyor).
  **(7)** `PlanTaskFeedbackListener` link ve kimlik sorgularını sıralı yapıyordu → `Promise.all`.
  **Kapsam dışı bırakılan:** `0095`'teki iki CHECK `NOT VALID` olmadan eklenmiş (büyük tabloda
  ACCESS EXCLUSIVE kilit + tam tarama). Migration **zaten uygulandığı** için dosyayı düzenlemek
  `docs/standards/backend.md`'deki "migrations are forward-only" kuralını çiğner ve drizzle'ın
  hash'ini bozar. Bunun yerine kural backend standardına yazıldı (yeni madde), gelecekteki
  migration'lar için bağlayıcı.
  **Gotchas:** (1) Tamamlama dedupe'u artık **teslim gününe** göre; bir testin "yarına ata ki kendi
  slotunu alsın" hilesi geçersiz — e2e bunun yerine çok-günlü birikmenin tek bildirime çöktüğünü
  doğruluyor. (2) `count` artık `students.length` değil `names.length`; isimsiz kimlikler sayıya
  da girmiyor ki başlık ile gövde çelişmesin.
  **İlgili:** `modules/notifications/application/listeners/mentorship-events.listener.ts`,
  `modules/mentorship/domain/mentorship.constants.ts`,
  `modules/mentorship/application/plan-task-feedback.listener.ts`,
  `modules/coaching/application/plan.service.ts`,
  `modules/mentorship/infrastructure/mentorship-query.adapter.ts`,
  `modules/notifications/application/mentorship-risk-digest.service.ts`,
  [`backend.md`](../standards/backend.md).

- **Geri bildirim döngüsü — silme ve tamamlama koça geri gider (APP-068, 2026-09-03)** — Öğrenci
  koç ödevini silebiliyordu (bilerek açık — plan hâlâ öğrencinin) ama koç bunu asla öğrenmiyordu;
  rapor "atandı ama silindi"yi göstermeden sessizce eksik kalıyordu. Artık ikisi de koça gidiyor.
  **Yeni tablo yok** — kayıt `user_notifications`'ın kendisi, zaten append-only.
  Zincir: `PlanService` (`plan_tasks`'ın sahibi) koşulsuz `PlanTaskDeleted`/genişletilmiş
  `PlanTaskCompleted` yayar → W8'in yeni `PlanTaskFeedbackListener`'ı `origin_ref_id`'yi
  `coach_students`'a çevirip ACTIVE ise mentorship olayına dönüştürür → mevcut
  `MentorshipEventsListener` teslim eder. Desen `coaching/application/notebook-forum.listener.ts`
  ile birebir aynı — coaching bir link'in ne olduğunu hiç öğrenmiyor.
  **Politika:** silme **dedupe'suz** (nadir, her biri raporun artık göstermeyeceği ayrı bir olgu;
  başlık koçun kendi yazdığı için geri okumak güven çizgisine dokunmuyor). Tamamlama **günde bir,
  `(studentId, taskDate)` dedupe'lu, başlıksız** (`mentorship-progress:...`) — 20 öğrencili koçta
  akşam tamamlama fırtınası olmasın diye.
  **Gotchas:** (1) `PlanTaskCompleted`'a **default değer verilmedi** — `taskDate`/`originType`/
  `originRefId` zorunlu; sessiz fallback olurdu. İki emit yeri var (`plan.service.ts`,
  `session.service.ts` — seans plan görevini otomatik DONE yapıyor, o da gerçek iş olduğu için
  bildirim doğru). (2) `events.emit` senkron ama dinleyici zinciri async — best-effort'un bedeli:
  bir yazma isteğinin yanıtı döndüğü anda bildirim henüz DB'de olmayabilir (e2e'de polling ile
  test edildi, `process-jobs` cron testiyle aynı desen). (3) **Erasure `PlanService.remove()`'dan
  geçmiyor** (`coaching-erasure.repository.ts` toplu `update` kullanıyor) — bu yüzden silinen bir
  hesabın koçuna yüz bildirim gitmiyor; bu bağımlılık `remove()`'un doc yorumunda işaretli, ileride
  erasure'ı `remove()` üzerinden geçirecek bir refactor bunu kırar. (4) ENDED bağ kuralı event
  tarafında da geçerli: bağ bittikten sonra öğrencinin eski koç görevini silmesi/tamamlaması eski
  koça bildirim göndermez — "metrics null" kuralının event karşılığı.
  **Yan bulgu, aynı PR'da düzeltildi:** `notificationCategorySchema` (packages/validation) Zod
  enum'unda `MENTORSHIP` hiç yoktu — APP-063'ten beri, `NotificationCategory` tipinde vardı ve
  `createFromTemplate(..., "MENTORSHIP", ...)` her yerde kullanılıyordu ama `GET /v1/notifications`
  bugüne kadar hiç e2e test edilmemişti. Sonuç: kutusunda **herhangi bir** MENTORSHIP bildirimi
  olan biri (link kabulünden beri her koç) kutusunu her açtığında 500 alıyordu. Enum'a eklendi;
  regresyon artık mentorship.e2e-spec.ts'in bu PR'daki testleriyle kapalı.
  **İlgili:** `modules/coaching/domain/coaching.events.ts` (`PlanTaskDeleted`, genişletilmiş
  `PlanTaskCompleted`), `modules/coaching/application/{plan,session}.service.ts`,
  `modules/mentorship/{domain/mentorship.constants.ts,application/plan-task-feedback.listener.ts,infrastructure/mentorship-link.repository.ts}` (`findById`),
  `modules/notifications/application/listeners/mentorship-events.listener.ts`,
  `packages/validation/src/notifications.ts`.

- **Koçun günlük müdahale uyarısı (APP-067, 2026-09-03)** — Risk triyajı bugüne kadar yalnız
  _pull_ idi: koç panele girmedikçe hiçbir şey duymuyordu, ve 20 öğrencili bir koç haftada iki kez
  girerse "3 gün inaktif" sinyali ölü doğuyordu. Roadmap §9'un istediği veri-tetikli müdahale
  uyarısı artık cron'la gidiyor: `POST /v1/internal/cron/dispatch-mentorship-risk-digest`,
  `render.yaml`'da `"0 7 * * *"` UTC (= 10:00 TRT). In-app her zaman, e-posta
  `notification_preferences.email_enabled`'a saygılı; **push yok** (koçun gününü bölmemeli).
  **Yalnız YENİ haber gider.** Birim `studentId:FLAG` çifti; bugünün kümesinde son özetin
  taşımadığı bir çift varsa gönderilir. Aksi halde on gündür sessiz olan öğrenci her sabah ping
  atardı ve üçüncü sabah koç okumayı bırakırdı. **İyileşme bildirilmez** — haber yokluğu iyi
  haberdir, roster zaten gösterir. Kronik durum `mentorship.risk_digest.repeat_after_days` (7)
  sonra bir kez hatırlatılır.
  **Kullanım:** `mentorship.risk_digest.enabled` **varsayılan kapalı** ve `mentorship.enabled`'dan
  ayrı — koç yüzeyini açıp toplu e-postayı kapalı tutabilmek ilk canlıya çıkışta istenecek şey.
  Admin config ekranından (veya `PATCH /v1/admin/config/mentorship.risk_digest.enabled`) açılır.
  **Gotchas:** (1) Baseline'ı **yeni bir tablo değil**, bir önceki özetin kendi
  `user_notifications.data.pairs` alanı tutuyor. Bildirim zaten "bu kişiye ne söyledik"in
  append-only kaydı; ikinci bir depo yalnız doğru tutulacak ikinci bir şey ve KVKK silmesinde
  kovalanacak üçüncü bir kopya olurdu. (2) Tek dedupe mekanizması in-app satırın `dedupeKey`'i:
  `createFromTemplate` satır zaten varsa **false** döner ve e-posta o false ile durur — cron iki
  kez koşarsa ikinci e-posta çıkmaz. `notification_deliveries` bu akışta kullanılmıyor
  (`DailyReminderService`'in iki ayrı dedupe'lu deseni bilerek kopyalanmadı). (3) **Flag adı
  kopyada geçmez** — "INACTIVE" gelen kutusunda teşhis gibi okunur; kopya isim taşır, rozet
  bağlamıyla raporda kalır (§0). (4) `repeat_after_days` düşürülürse eski baseline'lar bir anda
  bayatlar ve ertesi sabah herkese özet gider. (5) Risk mantığı W8'de kaldı:
  `MENTORSHIP_QUERY_PORT` (`coaching-query.port.ts`'in birebir kardeşi) yalnız "kimin haberi var"ı
  taşıyor, W5 bir flag'in ne demek olduğunu hiç öğrenmiyor.
  **İlgili:** `modules/mentorship/{domain/mentorship-query.port.ts,infrastructure/mentorship-query.adapter.ts}`,
  `modules/notifications/application/mentorship-risk-digest.service.ts`,
  `modules/notifications/infrastructure/user-notification.repository.ts` (`findLatestByTemplateKey`),
  `modules/notifications/presentation/cron.controller.ts`, `render.yaml`,
  `apps/api/src/i18n/locales/{tr,en}/notifications.json`, [`notifications.md`](./notifications.md).

- **Haftalık ödev bestecisi, konu ataması ve koç yönergesi (APP-066, 2026-09-03)** — API üç
  dilimdir dizi kabul ediyordu (`max(21)`), ama form tek görevlikti; koç haftalık program
  veremiyordu. Form artık bir besteci: gün seç → görev ekle → hepsi **tek POST** ile yazılır
  (all-or-nothing, `createFromMentorship` tek tx). 21 tavanı yeniden tanımlanmadı, şemanın tavanı
  UI kısıtı olarak yüzeye çıktı — ikisi ayrışamaz. Ayrıca `plan_tasks`'a iki soft-ref kolon:
  `topic` (`subject`'in birebir kardeşi) ve `coach_note`. Migration `0095_w8_plan_task_topic_coach_note`.
  **Kullanım:** koç öğrenci raporunun üstündeki formda ders seçer → o dersin konuları gelir →
  başlık + (isteğe bağlı) konu + (isteğe bağlı) not girip güne ekler. Konu listesi **öğrencinin**
  sınavından gelir (`studentExamType`, yeni `useExamTopicTaxonomy` hook'u); koçun kendi sınavını
  okumak yanlış liste üretirdi. Rapor artık satır başına `assignedByCoach` + `coachNote` taşıyor ve
  altında konu bazlı ilerleme (en düşük tamamlama üstte) gösteriyor.
  **Güven çizgisi:** `coach_note` sözleşmeyi bozmuyor, çünkü koçun **kendi** sözü — koç yazıyor,
  öğrenci görüyor, koç raporda geri okuyor. `description` (öğrencinin kutusu) hâlâ koça kapalı;
  ikisi ayrı kolon olmasının sebebi tam olarak bu. `cohort-evidence.ts` başlığına "ONE EXCEPTION,
  and why it is not one" şerhi eklendi. `MENTORSHIP_DATA_SCOPE`'a **`EXAM_TRACK`** eklendi:
  öğrencinin sınavı davranış değil profil verisi, kapsam listesi onu saymadan eksik anlatırdı
  (`mentorship.enabled` kapalı ve üretimde bağ yokken maliyeti sıfır olan tek an buydu).
  **Gotchas:** (1) `coach_note` yalnız **okuyan koçun kendi link'inin** yazdığı satırlarda dönüyor
  (`case when origin_ref_id = :linkId …`); aksi halde bağ bitip yeni koç bağlandığında öncekinin
  notunu okurdu — e2e'de test edilen gerçek bir sızıntıydı. (2) `plan_tasks_coach_note_origin_chk`
  koç notunu origin'siz satırda yasaklıyor; bu yüzden `clearMentorshipOrigin` ve KVKK silme
  `coachNote: null` yazmak **zorunda** — unutulursa erasure 500 verir. Sessiz veri kalıntısı yerine
  gürültülü hata, istenen bu. (3) `plan_tasks_topic_requires_subject_chk` + `refinePlanTaskTaxonomy`:
  konu, dersi olmayan dalsız bir etiket olamaz (`topics.subject_id` NOT NULL). Kural DB'de ve
  Zod'da birlikte duruyor, tek tarafta değil. (4) `topic` **`updatePlanTaskSchema`'ya eklenmedi**:
  öğrenci plan formunda konu seçici yok, eklenirse `assertMentorshipTaskEditable`'ın yasak alan
  listesine de girmesi gerekirdi — tuzak hiç açılmadı. (5) `PlanAdaptationSnapshotTask`'a
  `coachNote`/`topic` **eklenmemeli**, yoksa koçun notu LLM'e gider.
  **İlgili:** `apps/api/drizzle/0095_w8_plan_task_topic_coach_note.sql`,
  `modules/coaching/{domain/cohort-evidence.ts,infrastructure/cohort-evidence.repository.ts}`
  (`planTaskTitles` → `planTaskRows`), `modules/coaching/application/plan.service.ts`
  (`MentorshipAssignmentInput`), `modules/mentorship/application/mentorship-roster.service.ts`,
  `packages/validation/src/{coaching,mentorship}.ts`,
  `apps/web/src/lib/use-exam-topic-taxonomy.ts`,
  `apps/web/src/app/[locale]/(coach)/students/[studentId]/_components/assign-task-form.tsx`,
  [`coaching.md`](./coaching.md).

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

- **Code review düzeltmeleri — W8 (2026-09-02)** — Üç dilimin gözden geçirilmesinde çıkan
  bulgular kapatıldı.
  **(1) Bloklayıcı:** `?status=ENDED` roster'ı, bağı sonlanmış öğrencilerin **güncel** metriklerini
  döndürüyordu; koç bağlantıyı bitirip "Geçmiş" sekmesinden izlemeye devam edebiliyordu. Bu hem
  `/kocum` ekranındaki söze ("verilerine erişimi hemen kapanır") hem KVKK'da rızanın geri
  çekilebilirliğine aykırıydı. Metrikler artık `MentorshipRosterRowDto.metrics` alt nesnesinde ve
  ACTIVE olmayan bağda `null`. Kaçıran test de düzeltildi: adı "closes the coach's access
  immediately" idi ama yalnız satır sayısına bakıyordu.
  **(2)** Silinen koç, öğrencilerinde düzenlenemez görevler bırakıyordu: `plan_tasks.origin_ref_id`
  FK'sız soft ref olduğu için bağ silinince rozet ve 403 kilidi kalıyordu. Erasure artık
  `PlanService.clearMentorshipOrigin` ile o görevlerin provenance'ını temizliyor; görevin kendisi
  öğrencinin emeği olduğu için duruyor.
  **(3)** Kota check-then-act idi; sayım ve insert ayrı transaction'lardaydı, aynı kodu eşzamanlı
  kullanan iki öğrenci ikisi de geçebiliyordu. Artık tek transaction, koç üzerinde
  `pg_advisory_xact_lock`. Davet kodunun kendi sayacı olmadığı için kotanın gerçek bir sınır olması
  gerekiyordu.
  **Düşükler:** ödev şeması `description` kabul etmiyor (`.strict()` — sessizce kırpmak yerine
  reddediyor, koç geri okuyamayacağı bir not yazamaz) · ödev tarihine ufuk sınırı
  (`MENTORSHIP_ASSIGNMENT_MAX_DAYS_AHEAD = 120`) · `POST /assignments` throttle (20/dk) ·
  düzenleme kilidindeki ölü `taskDate` alanı kaldırıldı.
  **Gotcha:** `mentorshipAssignmentTaskSchema` `.strict()`; bilinmeyen alan 400 döner. Zod
  varsayılanı sessiz kırpmadır ve o, checklist'in yasakladığı sessiz fallback olurdu.
  **İlgili:** `mentorship-roster.service.ts`, `domain/risk-flags.ts` (`compareByRisk` artık
  `metrics` üzerinden), `mentorship-link.repository.ts` (`acceptInvite` kota+upsert tek tx),
  `mentorship-erasure.service.ts`, `packages/validation/src/{coaching,mentorship}.ts`.

- **Koç ödev ataması (APP-065, 2026-09-02)** — Ayrı bir ödev tablosu YOK: ödev,
  `origin_type = 'MENTORSHIP'` taşıyan bir `plan_tasks` satırı. Böylece öğrencinin her sabah
  açtığı ekranda beliriyor ve `daily_activity`, streak, panel, bildirim entegrasyonu bedava
  geliyor. Paralel bir yapılacaklar listesi günlük döngüyü ikiye böler ve "yaptın mı" sorusunun
  iki cevabı olurdu. Migration `0094_w8_mentorship_plan_origin`.
  **Kullanım:** koç, öğrenci raporunun üstündeki "Ödev ver" formundan başlık + ders + tarih
  giriyor; `POST /v1/mentorship/students/:id/assignments`. Öğrenci görevi `/plan`'da "Koçundan"
  rozetiyle görüyor.
  **Gotchas:** (1) Öğrenci görevi **tamamlar ve siler ama düzenleyemez**
  (`COACHING_TASK_COACH_ASSIGNED`, 403): başlığı değiştirebilseydi koçun raporu sessizce yalan
  söylerdi. Silme bilerek açık — plan hâlâ öğrencinin kendi planı. (2) Bu kural iki arayüz
  yüzeyinde birden geçerli (satır menüsü + takvim etkinlik sayfası); ikisi de
  `lib/plan-task-permissions.ts`'teki tek yüklemi kullanıyor, birbirinden ayrışmasın diye.
  (3) `origin_meta` **null** — koçun adı jsonb'ye kopyalanmıyor, okuma anında çözülüyor; KVKK
  silmesinde kovalanacak ikinci bir kopya kalmıyor. (4) `NotificationCategory` genişledi;
  web'de üç haritanın (ikon/renk/fallback) hepsi güncellenmeli, tip sistemi zaten zorluyor.
  (5) Rapor "atandı ama silindi"yi göstermez; olay logu backlog'da.
  **İlgili:** `modules/mentorship/application/mentorship-assignment.service.ts`,
  `modules/coaching/application/plan.service.ts` (`createFromMentorship`,
  `assertMentorshipTaskEditable`), `apps/web/src/lib/plan-task-permissions.ts`,
  `apps/web/src/app/[locale]/(coach)/students/[studentId]/_components/assign-task-form.tsx`,
  `modules/notifications/application/listeners/mentorship-events.listener.ts`.

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

- **2026-09-09 — APP-091 W8 koç planı orkestrasyonu.** Koç takvimi artık kendi görevlerini,
  aktif bağlantılar üzerinden verdiği ödevleri ve düzenlediği etkinlikleri tek, gruplama sonrası
  sayfalanan `GET /v1/mentorship/plan` yanıtında birleştiriyor. Çoklu ödev tek SERVICE
  transaction'ında, tek `assignmentGroupId` ile ve öğrenci kilitleri sıralı alınarak yazılıyor;
  tekli/grup düzenleme ve silme yalnız koçun yazdığı PENDING satırlara dokunuyor. Etkinlik
  katılımcıları her create/update öncesi `requireActiveLink` ile doğrulanıyor; bağlantı biterken
  gelecekteki katılımcı satırları ilişki ENDED yapılmadan kaldırılıyor. Koç görünümü öğrencinin
  açıklamasını taşımaz; tam katılımcı kimlikleri yalnız bu COACH yüzeyindedir, öğrenci
  `/plan-items` yanıtı count-only kalır. Kullanım: toplu ödev için `POST /mentorship/assignments`,
  etkinlikler için `/mentorship/events`; grup mutasyonlarında aktif katılımcı `studentIds`
  listesi gönderilir. Gotcha: grup çağrısı yalnız doğrulanan link kapsamını değiştirir ve DONE
  satırları korur. İlgili: `mentorship-{assignment,event,plan-orchestration}.service.ts`,
  `mentorship-plan.controller.ts`, W2 `plan-mentorship.ts`.

- **2026-09-09 — APP-091 active-link transaction gate hardening.** Coach plan writes now run
  inside one W8-owned SERVICE transaction that locks the relevant ACTIVE `coach_students` rows
  with `FOR UPDATE` in stable student-id order, rechecks consent under lock, and passes that same
  transaction to W2. Link end uses the identical lock, removes future event attendance through
  W2, and transitions the link to ENDED atomically. Event input is capped at 100 attendees before
  the gate. SERIES edits hydrate W2's returned replacement event id. The aggregate keeps organized
  personal/former-attendee events while hydrating only active identities; student filtering removes
  unrelated personal items. Grouped tasks split by their visible signature when DONE history and
  edited PENDING rows diverge. Usage: open `withServiceTransaction`, take any required W2 lock,
  then call `requireActiveLinksInTransaction` before the W2 write; never precheck and write in
  separate transactions. Gotcha:
  `assignmentGroupId` remains the mutation key, while `CoachPlanGroupedTaskDto.id` is a stable
  display-group key. Related: `mentorship-link.repository.ts`,
  `mentorship-{assignment,event,link,plan-orchestration}.service.ts`.

- **2026-09-09 — APP-091 organizer-first event lock order.** Create, update, and cancel now open
  one W8 SERVICE transaction and follow the same order: W2 organizer advisory lock, ordered ACTIVE
  link row locks/recheck, then the W2 event write. Cancellation resolves every affected occurrence
  attendee in that transaction; an ended/missing link aborts before cancellation, while personal
  events with no attendees remain valid. Publication occurs only after the shared transaction
  commits. Link end deliberately takes only the link row before W2 attendance cleanup, so it never
  waits on the event organizer lock and a waiting event mutation rechecks consent after the end.
  Usage: open `withServiceTransaction`, call `lockOrganizerInTransaction`, then
  `requireActiveLinksInTransaction`, then the W2 mutation seam. Gotcha: the link gate is explicit
  and transaction-bound; resolver callbacks must not decide lock order. Related:
  `mentorship-{event,link,assignment}.service.ts`.

- **2026-09-09 — APP-091 role-aware coach plan UI.** Canonical `/plan` now keeps the existing
  student plan unchanged and renders a week/month coach calendar for COACH accounts. The coach can
  move by period, return to today, filter by every active roster student, open a day or read-only
  task/event detail, and follow `?date=YYYY-MM-DD&event={id}` links. Roster, task participants and
  event attendees use W0-resolved public avatar URLs; month cells show at most three unique
  students plus `+N`, while personal items stay visible without a fake avatar. Usage: choose “Tüm
  öğrenciler” or one avatar filter; the latter reloads `/v1/mentorship/plan` with `studentId`, so
  W8 remains authoritative instead of hiding unrelated rows in the browser. The range client
  drains every 100-row page in server order and fetches the complete active roster. Gotcha: role
  selection only chooses the presentation; endpoint role and active-link checks remain the
  security boundary. Related: `apps/web/.../plan/_components/coach-plan-*`,
  `apps/web/src/lib/{coach-plan-calendar,mentorship}.ts`,
  `mentorship-roster.service.ts`, `packages/types/src/mentorship.ts`.

- **2026-09-09 — APP-091 coach plan review hardening.** Same-route `date`/`event` query changes now
  re-key only calendar state, load the new range and select the returned event without reloading
  the mounted roster. Roster and plan pagination forward abort signals, stop obsolete page loops,
  and treat cancellation as lifecycle rather than an error. “Bugün” uses the Europe/Istanbul
  calendar date. Historical events remain shared from `attendeeCount` even when no active identity
  can be shown. Month headings are visibly Monday-first, avatar overflow announces the total, and
  an opened read-only detail receives focus without trapping it. Role planners are separate dynamic
  chunks. The month board uses native table headers/cells and names every unique overflow student
  to assistive technology; retry restarts only the resource that failed. A query event is consumed
  only by the first successful range load, closing detail restores the exact still-connected
  button that opened it (no shared DOM ids), and error states temporarily hide any preserved
  detail selection. Related:
  `coach-plan-{shell,calendar-shell,month,detail,item-card}.tsx`,
  `lib/{coach-plan-calendar,date-time,mentorship-plan}.ts`.

- **2026-09-09 — APP-091 coach plan task and event actions.** The coach calendar now creates
  personal tasks/events when no attendee is selected, sends one atomic assignment request for a
  selected cohort, and sends recurrence rules to W8 without materializing occurrences in the
  browser. Pending personal/assignment tasks can be edited or removed; group calls contain only
  the currently displayed PENDING students. Scheduled current/future events can be edited or
  cancelled, and series actions require an explicit occurrence/series scope. Usage: open “Yeni
  görev” or “Yeni etkinlik” from the toolbar, or open a mutable detail and choose edit/remove.
  Successful writes close the action, toast, and reload the current server-filtered range.
  Gotchas: task recipients stay read-only while editing, completed participants remain history,
  and W2 does not expose personal-task date edits, so that date is visibly locked. Timed events
  announce the 15-minute reminder rule; all-day events announce that no reminder is sent.
  Related: `coach-plan-{task,event}-form.tsx`, `coach-plan-detail-actions.tsx`,
  `lib/coach-plan-mutations.ts`, `e2e/coach-plan.spec.ts`.

- **2026-09-09 — APP-091 coach plan mutation integrity.** Group task update/delete bodies now
  carry the selected card's complete visible signature plus its PENDING student ids. W2 checks
  every requested row against that signature under the existing per-student locks; a stale or
  partial match raises a localized conflict and rolls the whole transaction back. Series event
  forms diff against the selected event, so title/attendee-only edits omit unchanged date and
  recurrence fields and stay on W2's non-regeneration path. Authoritative reloads replace an open
  detail with the fresh row or close it when its id/signature disappeared. Week headings are
  44px-selectable creation dates, task/event date inputs use Istanbul today as their native
  minimum, and destructive scope plus focus reset after confirmation dismissal. Usage: select an
  empty future week day before opening a creation form. Gotcha: the 120-day assignment horizon is
  currently a backend-only policy constant, not a shared client contract, so the form deliberately
  has no hardcoded `max`; W8 remains authoritative. Related:
  `coach-plan-{calendar-shell,week,detail-actions}.tsx`,
  `lib/coach-plan-{calendar,mutations}.ts`, `packages/validation/src/mentorship.ts`,
  `plan-task-mentorship.repository.ts`, `e2e/coach-plan.spec.ts`.

- **2026-09-09 — APP-091 unchanged event edit guard.** Event update payload construction now
  returns no mutation when every editable value matches the selected event. The edit form disables
  Save in that state and also exits silently on programmatic submission, so `{scope}` is never sent
  and no generic validation error is shown. Choosing a series scope alone is not a change. Related:
  `coach-plan-event-form.tsx`, `lib/coach-plan-mutations.ts`.

- ~~**Role changes need a re-login.**~~ **Stale — corrected 2026-09-07.** APP-080 made
  `JwtAuthGuard` resolve the principal through `TokenService.validateSession`, which joins `users`
  on every request, so a freshly granted COACH sees the surface at once. The Tutorials block
  (`:75-79`) and the APP-082 entry both say so; this line had not been updated and contradicted them.
- **Empty 200, not `null` JSON.** `GET /my-coach` returns an empty body when there is nothing. The
  shared `http()` client already tolerates this (`res.json().catch(…)`). `GET /overview` does not
  share the quirk: it always returns an object, with `inviteCode: null` inside it.
- **Three ways to change a task, not two.** Besides the row menu and the calendar sheet, the AI
  plan adaptation (`POST /v1/plan-tasks/adapt`) can MOVE a task to another day. Coach-assigned
  tasks are filtered out of the adaptation snapshot so they are never proposed, and the apply path
  refuses them outright (`COACHING_TASK_COACH_ASSIGNED`). Any future writer of `plan_tasks` has to
  answer the same question: would this change a date or a wording the coach reported on?
- **Two edit surfaces on the plan screen.** The row menu and the calendar event sheet both offer
  editing; both must consult `isCoachAssigned`. A third surface would need the same call.
- **The gate is easy to forget.** Any future service reading student data on a coach's behalf must
  call `requireActiveLink` first. It is exported from `MentorshipModule` for exactly that reason.
- **Erasure deletes links, it does not anonymize them.** A relation is a fact about two people;
  keeping a dangling half after one exercises erasure serves nobody. The counterpart simply loses
  the link, as if it had been ended.

## Backlog

- ~~AI "smart brief"~~ — shipped (APP-078). The rules stayed as the floor, as planned.
- **Whole-cohort risk ranking — not needed yet, and here is why.** Today a page is sorted, not the
  cohort. But `mentorship.coach.max_active_students` defaults to 20 against a page size of 100, so
  one page IS the cohort: nothing is ranked out of view. The item is born the day that ceiling is
  raised past 100, and not before. The cohort brief (APP-085) relies on the same fact.
- ~~AI cohort brief~~ — shipped (APP-085). Rules stayed the floor there too: the chips beside each
  line are `risk-flags.ts`, the "new" badge is a set comparison, and only the sentence is a model's.
- ~~Seat billing beyond the free quota~~ — shipped (APP-076/077/079: sponsored seats, the kill
  switch and the paid Koç Pro plans).
- ~~Coach vetting queue~~ — **shipped (APP-082)**, minus the document: the evidence is a
  structured claim plus the admin's mark of what they checked. A credential file stays out on
  purpose (it would be the heaviest personal data in the system, retained for rejected
  applicants too); the schema takes a `credential_key` column and a private storage prefix
  whenever that changes.
- ~~The approved profile shown to the student~~ — **shipped (APP-083)**, with the coach editing
  their own two lines and the repo's first Tier-1 contact detector behind it. Tier-2 (the AI
  classifier that survives deliberate evasion) stays Phase 2, roadmap §9.
- ~~Minors~~ — **decided and shipped (APP-084).** No separate parental-consent flow; the signup
  consent checkbox now carries "18 yaşından büyüğüm" / "I am over 18" (`auth.register.kvkk`).
  `users` still holds no birth date and the app enforces no age it cannot verify — the consent
  screen states it instead. **The wording awaits legal sign-off** (roadmap §12 keeps that as a
  pre-launch item); changing it is a copy edit, not a code change.
- **Topic-level evidence for the coach — rejected (2026-09-06), with the reason.** The
  `mistake_notebook_entries` line in `cohort-evidence.ts` stays: even an aggregate count is a
  behaviour pattern produced in a space framed as the student's own, and that file's header ("a
  student's words stay with the student") is what makes the notebook usable at all. If topic
  evidence is ever wanted, the honest path is `mock_exam_photo_categorizations.topic_ref` — a label
  attached to a mock exam, already inside the `MOCK_EXAMS` scope the student consented to. Not the
  notebook.
- **AI brief transparency — open.** `coach_students.brief_at` records when a brief was last written
  about a student, and APP-087 deliberately does not show it: the scope line already says a coach
  MAY run an AI summary, and "your coach ran one on the 5th" is a decision about surveillance-feel
  rather than a number that screen was asked to report. Worth revisiting with a real coach cohort.
- Move the surface to `apps/panel` when the coach cohort justifies its own app (roadmap §9).

## Related

- [identity.md](./identity.md) — owns `users`/`coach_students` schema block; `UsersService.listDisplayIdentities` is the seam W8 uses.
- [ai.md](./ai.md) — the AI coach, which owns the `coach_*` namespace this module deliberately avoids.
- [coaching.md](./coaching.md) — where the student data a coach will see actually lives.
- [admin.md](./admin.md) — role assignment + audit trail.
