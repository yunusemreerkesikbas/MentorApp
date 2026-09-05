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
the consent screen and on the student's `/my-coach` view. The one thing a coach *writes* into the
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
  behavioural gain. Everything *new* is `mentorship_*`.
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
#   The coach must re-login: roles are read from the DB on refresh, not patched into a live JWT.
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

### Student (no role required)
POST   /v1/mentorship/invitations/preview  { code } -> { coachDisplayName, coachUsername, dataScope }
POST   /v1/mentorship/invitations/accept   { code } -> MyCoachDto
GET    /v1/mentorship/my-coach                      -> MyCoachDto | (empty = no coach)
DELETE /v1/mentorship/my-coach                      -> 204
```

Web'de öğrencinin akışa giriş noktası **profil → "Koçum"** (`/profil` → `/kocum`); oradan koçu
yoksa `/kocluk-daveti`'ye geçer. Koç davet kartından kodu ya da `?code=` taşıyan hazır linki
kopyalar; link yalnız alanı doldurur, kabul gene öğrencinin iki adımıdır.

## API

| Endpoint | Purpose |
|---|---|
| `GET /v1/mentorship/overview` | The coach's landing state: invite code, seats taken out of the cap, and the data-scope contract mirrored back to them (`@Roles(COACH)`) |
| `POST /v1/mentorship/invite-code` | Rotate the code; the previous one stops working immediately (`@Roles(COACH)`) |
| `GET /v1/mentorship/students` | Roster + rule-based risk flags, worst first; `?status=ENDED` for history |
| `GET /v1/mentorship/students/:studentId` | One student's report (gate applies) |
| `POST /v1/mentorship/students/:studentId/assignments` | Assign 1..21 plan tasks in one call — title, subject, `topic`, `coachNote` (gate applies) |
| `PUT /v1/mentorship/students/:studentId/note` | The coach's standing note to this student; `{ body: null }` clears it (gate applies) |
| `DELETE /v1/mentorship/students/:studentId` | Coach ends the link (gate applies) |
| `GET /v1/mentorship/templates` | The coach's saved weekly programs (`@Roles(COACH)`) |
| `POST /v1/mentorship/templates` | Save a program, upserting on `(coach, name)` — there is no PUT because saving over a name is the edit |
| `DELETE /v1/mentorship/templates/:templateId` | Delete one of the coach's own; another coach's id is a 404 |
| `POST /v1/mentorship/invitations/preview` | Consent screen input: who the coach is + the exact data scope |
| `POST /v1/mentorship/invitations/accept` | Student's half of the double opt-in → ACTIVE |
| `GET /v1/mentorship/my-coach` | Student transparency: who my coach is, what they see |
| `DELETE /v1/mentorship/my-coach` | Student revokes consent, unilaterally (KVKK) |

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
  düğmenin ne yaptığını gösteren hiçbir şey yoktu: `countByStatus()` sponsor satırlarını *aktif
  olarak* filtreliyor ve başka hiçbir sorgu geri saymıyordu, `ai_usage`'ın da `subscriptions` ile
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
  *pull* idi: koç panele girmedikçe hiçbir şey duymuyordu, ve 20 öğrencili bir koç haftada iki kez
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

- **Role changes need a re-login.** `TokenService.loadPrincipal` re-reads roles on refresh, so a
  freshly granted COACH sees the surface only after their next refresh or login.
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

- AI "smart brief" on top of the rule-based triage (roadmap §9). The rules stay as the floor.
- Whole-cohort risk ranking. Today a page is sorted, not the cohort; fine to 100 students a page.
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
