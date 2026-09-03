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
GET    /v1/mentorship/invite-code                  -> { code, expiresAt } | (empty = none yet)
POST   /v1/mentorship/invite-code                  -> rotates; the previous code stops working
GET    /v1/mentorship/students?status=ACTIVE|ENDED -> Paginated<MentorshipRosterRowDto>
DELETE /v1/mentorship/students/:studentId          -> 204

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
| `GET/POST /v1/mentorship/invite-code` | Read or rotate the coach's single invite code (`@Roles(COACH)`) |
| `GET /v1/mentorship/students` | Roster + rule-based risk flags, worst first; `?status=ENDED` for history |
| `GET /v1/mentorship/students/:studentId` | One student's report (gate applies) |
| `POST /v1/mentorship/students/:studentId/assignments` | Assign 1..21 plan tasks in one call — title, subject, `topic`, `coachNote` (gate applies) |
| `DELETE /v1/mentorship/students/:studentId` | Coach ends the link (gate applies) |
| `POST /v1/mentorship/invitations/preview` | Consent screen input: who the coach is + the exact data scope |
| `POST /v1/mentorship/invitations/accept` | Student's half of the double opt-in → ACTIVE |
| `GET /v1/mentorship/my-coach` | Student transparency: who my coach is, what they see |
| `DELETE /v1/mentorship/my-coach` | Student revokes consent, unilaterally (KVKK) |

Error codes: `MENTORSHIP_ASSIGNMENT_TOO_FAR` · `MENTORSHIP_DISABLED` · `MENTORSHIP_LINK_NOT_FOUND` · `MENTORSHIP_INVITE_INVALID` ·
`MENTORSHIP_INVITE_EXPIRED` · `MENTORSHIP_ALREADY_LINKED` · `MENTORSHIP_STUDENT_QUOTA_EXCEEDED` ·
`MENTORSHIP_SELF_LINK`.

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
- **Empty 200, not `null` JSON.** `GET /invite-code` and `GET /my-coach` return an empty body when
  there is nothing. The shared `http()` client already tolerates this (`res.json().catch(…)`).
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

- Append-only assignment event log, so the report can show "assigned but deleted". Today a deleted
  assignment simply disappears; the coach sees the living plan, not its history.
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
