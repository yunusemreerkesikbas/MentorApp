# Bekleme listesi ve davetli kayıt · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kayıt modunu (açık / davetli / kapalı) config'den yöneten, davetli modda landing ve kayıt girişlerinde bekleme listesi modalını gösteren, admin'in tek tıkla davet ettiği ve rolün davetten geldiği akışı kurmak.

**Architecture:**
- Env'deki `PILOT_INVITED_EMAILS` listesi, bekleme listesiyle ortak tek bir `signup_invitations` tablosuna taşınır (identity modülü).
- `assertSignupAdmission` tabloya bakar ve rolü döner. Şifreli kayıt ve Google kayıt rolü oradan alır.
- Herkese açık `POST /v1/auth/waitlist` mevcut auth IP limitini ve Turnstile'ı kullanır.
- Admin uçları admin modülünde durur, identity'nin servisini çağırır.
- Web, `signupWaitlist` availability anahtarıyla link/modal arasında seçim yapar. Modal `@mentor/ui` `Modal` (`placement="sheet"`) üzerine kurulur.

**Tech Stack:** NestJS · Drizzle + Postgres (RLS) · Next.js 16 / React 19 · next-intl · orval (`@mentor/api-client`) · Vitest · Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-waitlist-invite-only-design.md` (okumadan başlama). Tuval (yön A): https://claude.ai/artifact/CLedRf3gaAyDtrajcyiDKX

## Global Constraints
- Kayıt modları mevcut iki bayrakla: açık = `signup.enabled=true` + `signup.pilot.enabled=false`; davetli = `true`/`true`; kapalı = `signup.enabled=false`. Yeni mod anahtarı yok.
- `signupWaitlist = !(signup.enabled && !signup.pilot.enabled)`. Web'de availability `null` ise **waitlist sayılır** (fail closed).
- Rol davet satırından gelir (`student` | `coach`); davetli modda URL `rol=koc` ve form `intent` rolü belirlemez. `coach` satırı `mentorship.applications.open`'ı geçer.
- Saklama: `waiting` satır `created_at`, `invited` satır `invited_at` + **6 ay** sonra silinir; kayıt başarılı olunca satır silinir.
- Waitlist ucu her geçerli istekte aynı cevabı döner (yeni / tekrar / zaten kullanıcı / açık mod); zaten kullanıcıysa ya da mod açıksa satır açılmaz.
- E-posta URL'de taşınmaz. Davet linki: TR `/kayit?davet=1`, EN `/en/signup?davet=1`, koç ek olarak `&rol=koc`.
- Modal metni (TR, birebir): rozet "Çok yakında"; başlık "Yerini şimdiden ayıralım!"; gövde "PuhuKoç'u senin için hazırlıyoruz. E-postanı bırak, açıldığında ilk sana haber verelim."; etiket "E-posta adresin"; yer tutucu "ornek@eposta.com"; buton "Beni listeye ekle"; hata "Bu adres eksik görünüyor. Bir daha yazar mısın?"; ağ hatası "Şu an kaydedemedik. Birazdan tekrar dener misin?"; alt "Hesabın var mı?" + "Giriş yap" (aydınlatma metni linki yok). Başarı: rozet "Yerin hazır"; başlık "Harika, listedesin!"; gövde "Açıldığımızda ilk haber {email} adresine gelecek."; buton "Tamam"; alt "Adresi yanlış mı yazdın?" + "Düzelt". Koç için aynı metin.
- Modalda davet, kısıtlama ya da saklama süresi yazılmaz. Pencere/ışık/gece benzetmesi metinde yok (`docs/copy/voice.md`).
- Davet e-postası (TR): konu "Pencerenin ışığı yandı, davetin geldi!"; gövde "Sıra sana geldi! PuhuKoç'taki yerin hazır. Davetin bu adrese özel, kayıt olurken bu e-postayı kullan."; buton "Hesabımı aç"; alt not "Bu daveti sen istemediysen görmezden gelebilirsin."
- UI değerleri DESIGN.md / landing tokenları (`--landing-night-top`, `--landing-night-bottom`, `--landing-lamp`, `--landing-on-night`, `--landing-on-night-soft`, `--play-radius`, `LEDGE`). Magic number yok.
- Testler: yalnızca etkilenen spec `pnpm --filter @mentor/api exec vitest run <ad>` / `pnpm --filter @mentor/web exec vitest run <ad>`. Web e2e prod build ile (`pnpm --filter @mentor/web build` sonra `pnpm --filter @mentor/web exec playwright test <spec>`). Tam suite + lint + typecheck yalnızca son görevde.
- **Commit yok:** proje alışkanlığı gereği sahibi commit'ler. Her görevin sonu "kontrol noktası": testler yeşil.
- Deploy sırası: API önce, web sonra (web yeni availability anahtarı olmayan cevabı `null` sayar).

## Review Focus
1. **Availability alınamazsa** (`null`) landing "Başla" modal açmalı, form değil. → Görev 6 `signup-waitlist.spec.ts`.
2. **Davetli öğrenci `/kayit?davet=1&rol=koc` ile gelirse** öğrenci hesabı açılmalı. → Görev 2 `auth.service.spec.ts`.
3. **Büyük/küçük harf ya da boşluklu e-posta** (`" Ayse@Ornek.com "`) aynı satıra düşmeli; tekrar satır açmamalı. → Görev 3 `waitlist.service.spec.ts`.
4. **Admin sınırı mevcut davetli sayısının altına indirirse** davetliler yine kayıt olabilmeli, yalnızca yeni davet reddedilmeli. → Görev 1 ve Görev 4 testleri.
5. **Davetli kişi Google ile yanlış hesap seçerse** `/giris`'e değil `/kayit?davet=1`'e dönmeli ve davet hatasını görmeli. → Görev 2 controller testi.

---

### Task 1: Davet tablosu, kayıt kontrolü ve env'in kaldırılması

**Files:**
- Create: `apps/api/src/database/schema-signup-invitations.ts`
- Modify: `apps/api/src/database/schema-all.ts` (export ekle)
- Create: `apps/api/drizzle/0141_*.sql` (generate + RLS ekleri)
- Create: `apps/api/src/modules/identity/infrastructure/signup-invitation.repository.ts`
- Modify: `apps/api/src/modules/identity/application/signup-admission.ts`
- Modify: `apps/api/src/modules/identity/application/signup-admission.spec.ts` (yeniden yaz)
- Modify: `apps/api/src/common/config/config.catalog.ts:415-424`
- Modify: `apps/api/src/common/errors/error-code.ts`, `apps/api/src/i18n/locales/{tr,en}/errors.json`
- Delete: `apps/api/src/config/pilot-invited-emails.ts`, `apps/api/src/config/env-pilot-invites.spec.ts`
- Modify: `apps/api/src/config/env.validation.ts:50`, `.env.example`, `render.yaml` (`PILOT_INVITED_EMAILS` satırları çıkar)
- Modify: `apps/api/src/modules/identity/identity.module.ts` (repo provider)

**Interfaces:**
- Produces:
  - Tablo `signupInvitations` (`signup_invitations`):
    - `id uuid pk`, `email text not null unique` (küçük harf + trim), `role text not null` (`student` | `coach`), `status text not null` (`waiting` | `invited`), `locale text not null default 'tr'` (`tr` | `en`), `organizationId uuid null → organizations.id` (AGENTS §4 #7).
    - Zaman kolonları: `createdAt timestamptz not null default now()`, `invitedAt timestamptz null`.
    - `invitedBy uuid null → users.id on delete set null`.
  - `type InvitationRole = "student" | "coach"`, `type InvitationStatus = "waiting" | "invited"`
  - `SignupInvitationRepository`:
    - `findInvited(email: string): Promise<{ role: InvitationRole } | null>`
    - `insertWaiting(input: { email: string; role: InvitationRole; locale: "tr" | "en" }): Promise<void>` (on conflict do nothing)
    - `upsertInvited(input: { email; role; locale; invitedBy: string }): Promise<SignupInvitationRow>`
    - `markInvited(id: string, invitedBy: string): Promise<SignupInvitationRow | null>`
    - `countInvited(): Promise<number>`
    - `list(q: { status?; role?; search?; page: number; pageSize: number }): Promise<Paginated<SignupInvitationRow>>`
    - `findById(id): Promise<SignupInvitationRow | null>`
    - `deleteById(id): Promise<boolean>`
    - `deleteByEmail(email): Promise<void>`
    - `purgeExpired(): Promise<void>`
    - Hepsi `withServiceContext` içinde.
  - `assertSignupAdmission(registry: Pick<ConfigRegistryService,"get">, invitations: Pick<SignupInvitationRepository,"findInvited">, email: string): Promise<SignupAdmission>`
    - `type SignupAdmission = { mode: "open" } | { mode: "invited"; role: InvitationRole }`
  - ErrorCodes:
    - `WAITLIST_INVITE_LIMIT` (409) TR: "Açık davet sınırına ulaşıldı."
    - `WAITLIST_ENTRY_NOT_FOUND` (404) TR: "Bu kayıt bulunamadı."
    - `AUTH_PILOT_INVITATION_REQUIRED` TR metni: "Bu adres davet listesinde yok. Davetin geldiği adresi yaz."
    - EN karşılıkları aynı anlamda.

- [ ] **Step 1: Failing test.** `signup-admission.spec.ts`'i fake `findInvited` ile yeniden yaz. Testler:
  - `closed rejects even an invited address` → `AUTH_SIGNUP_CLOSED`, 403; `findInvited` çağrılmaz.
  - `open mode needs no invitation` → `{ mode: "open" }`.
  - `invite mode without a row is refused` → `AUTH_PILOT_INVITATION_REQUIRED`, 403.
  - `invite mode returns the row role` → `findInvited` `{role:"coach"}` döner, sonuç `{ mode: "invited", role: "coach" }`.
  - `a lowered capacity never closes admission`: `signup.pilot.max_invited_emails`=1, invited satır var → `{mode:"invited"}`. Kapasite artık okunmaz.
  - `rejection does not expose addresses`.
- [ ] **Step 2:** `pnpm --filter @mentor/api exec vitest run signup-admission.spec` → FAIL (imza farklı).
- [ ] **Step 3:** Şemayı, repo'yu, admission'ı ve error kodlarını yaz.
  - Config `signup.pilot.max_invited_emails`: `identityCount(50, 1000, "Maximum outstanding invitations (invited, not yet registered). Only blocks new invites; never closes signup for people already invited.", true)`.
  - `signup.pilot.enabled` açıklaması: "Invite-only signup: only emails with an invited row in signup_invitations may create password or Google accounts."
  - Env satırlarını kaldır.
  - `pnpm --filter @mentor/api db:generate` çalıştır. Üretilen SQL'in sonuna `ai_chat_quota_attempts` (0140) deseniyle `ENABLE` + `FORCE ROW LEVEL SECURITY` ve `signup_invitations_service` policy ekle.
  - `purgeExpired`: `(status='waiting' and created_at < now() - interval '6 months') or (status='invited' and invited_at < now() - interval '6 months')`. Kod yorumu: `// ponytail: KVKK 6 ay sabit; aydınlatma metniyle birlikte değişir`.
- [ ] **Step 4:** `pnpm --filter @mentor/api exec vitest run signup-admission.spec env.validation config.catalog` → PASS. `rg PILOT_INVITED_EMAILS apps` boş (e2e hariç, Görev 2'de değişiyor).
- [ ] **Step 5 (kontrol noktası):** `pnpm --filter @mentor/api db:migrate` yerel DB'de hatasız.

### Task 2: Rol davetten; şifreli ve Google kaydı; Google hata dönüşü

**Files:**
- Modify: `apps/api/src/modules/identity/application/auth.service.ts:65-100`
- Modify: `apps/api/src/modules/identity/application/google-auth.service.ts:138-160`
- Modify: `apps/api/src/modules/identity/presentation/auth.controller.ts:144-150`
- Test: `apps/api/src/modules/identity/application/auth.service.spec.ts`, `google-auth.service.spec.ts`, `apps/api/test/signup-admission.e2e-spec.ts`

**Interfaces:**
- Consumes: `assertSignupAdmission`, `SignupInvitationRepository.deleteByEmail` (Görev 1).
- Produces: davetli modda hesap rolü = satır rolü; kayıt sonrası satır silinir.

- [ ] **Step 1: Failing tests.**
  - `auth.service.spec.ts`:
    - `invited coach becomes COACH while applications are closed`: admission `{mode:"invited",role:"coach"}`, `mentorship.applications.open=false`, intent yok → `createService` `roles: [STUDENT, COACH]` ile çağrılır, `MENTORSHIP_APPLICATIONS_CLOSED` atılmaz.
    - `invited student asking for COACH stays a student`: `{role:"student"}` + `intent:"COACH"` → `roles` geçilmez.
    - `open mode keeps the intent and applications rule`: `{mode:"open"}` + COACH + kapalı başvuru → `MENTORSHIP_APPLICATIONS_CLOSED`.
    - `signup deletes the invitation`: başarılı kayıtta `deleteByEmail("ayse@ornek.com")` çağrılır.
  - `google-auth.service.spec.ts`: `invited coach via Google becomes COACH` ve `deleteByEmail` çağrılır.
  - Controller: signup modundaki Google hatası `APP_URL/kayit?davet=1&googleError=…&googleErrorCode=…`'a (EN `/en/signup?davet=1`) yönlenir; login modu bugünkü gibi `/giris`.
- [ ] **Step 2:** `pnpm --filter @mentor/api exec vitest run auth.service.spec google-auth.service.spec` → FAIL.
- [ ] **Step 3:** Uygula.
  - `const coach = admission.mode === "invited" ? admission.role === "coach" : input.intent === "COACH"`.
  - Başvuru kontrolü yalnız `admission.mode === "open" && coach` iken.
  - Google `createService` aynı `roles` kuralıyla.
  - Satır silme `createService` sonrası. Kod yorumu: `// ponytail: transaction dışı; silinemezse satır 6 ayda düşer`.
  - Controller catch: `state?.mode === "signup"` → signup yolu + `davet=1`.
- [ ] **Step 4:** Aynı komut → PASS. `signup-admission.e2e-spec.ts`'i `config.set("PILOT_INVITED_EMAILS")` yerine `signup_invitations`'a `invited` satır ekleyecek şekilde güncelle. Rol e2e'si ekle: koç satırıyla şifreli kayıt → `roles` COACH içerir. `pnpm --filter @mentor/api exec vitest run signup-admission.e2e-spec` → PASS.

### Task 3: Herkese açık bekleme listesi ucu, availability, IP limiti, günlük silme

**Files:**
- Create: `apps/api/src/modules/identity/application/waitlist.service.ts` (+ `waitlist.service.spec.ts`)
- Create: `apps/api/src/modules/identity/presentation/waitlist.dto.ts`
- Modify: `apps/api/src/modules/identity/presentation/auth.controller.ts` (yeni uç)
- Modify: `apps/api/src/modules/identity/application/auth-rate-limit.service.ts:7` (`"waitlist"` bucket), `presentation/auth-throttler.guard.ts:24-31`
- Modify: `apps/api/src/common/config/config.catalog.ts:1043` civarı (`"identity.auth_rate.waitlist_ip_limit": authCount(5, 1000, "Waitlist joins per IP window.")`)
- Modify: `apps/api/src/common/config/app-availability.service.ts`, `packages/types/src/app-availability.ts`
- Modify: `apps/api/src/modules/notifications/presentation/cron.controller.ts:37-45` (purge)
- Test: `waitlist.service.spec.ts`, `app-availability.service.spec.ts`, throttler bucket spec (varsa mevcut dosyaya)

**Interfaces:**
- Produces:
  - `POST /v1/auth/waitlist`:
    - Body `JoinWaitlistDto { email: string (IsEmail, max 254); role: "student" | "coach"; locale: "tr" | "en"; turnstileToken?: string }`.
    - Cevap **204**. Geçersiz e-posta 400.
  - `WaitlistService.join(input: JoinWaitlistDto): Promise<void>`
  - `APP_AVAILABILITY_KEYS`'e `"signupWaitlist"` (alfabetik sırada).
  - `AuthRateBucket` += `"waitlist"`; `authRateBucket("/auth/waitlist") === "waitlist"`.

- [ ] **Step 1: Failing tests.**
  - `waitlist.service.spec.ts`:
    - `stores a normalized waiting row`: `" Ayse@Ornek.com "` → `insertWaiting({email:"ayse@ornek.com",role:"student",locale:"tr"})`.
    - `existing user adds no row`: `usersRepo.findByEmailService` bulur → `insertWaiting` çağrılmaz, hata yok.
    - `open mode adds no row`: `signup.enabled=true`, `pilot=false` → `insertWaiting` çağrılmaz.
    - `asserts turnstile with action waitlist`.
  - `app-availability.service.spec.ts`: `signupWaitlist` → (true,false)=false; (true,true)=true; (false,false)=true; (false,true)=true.
  - Throttler: `authRateBucket("/auth/waitlist")` → `"waitlist"`.
- [ ] **Step 2:** `pnpm --filter @mentor/api exec vitest run waitlist.service.spec app-availability auth-throttler` → FAIL.
- [ ] **Step 3:** Uygula.
  - Mod okuma admission ile aynı iki bayrak.
  - Turnstile: `this.turnstile.assertValid(token, "waitlist")`.
  - Cron `dispatchDailyReminders` `Promise.all`'ına `this.waitlist.purgeExpired()` ekle. Notifications modülü identity'den servisi zaten import ediyor mu kontrol et; etmiyorsa `IdentityModule` exports'una `WaitlistService` ekle.
- [ ] **Step 4:** Aynı komut → PASS.

### Task 4: Admin uçları ve davet e-postası

**Files:**
- Modify: `apps/api/src/modules/identity/application/waitlist.service.ts` (admin metotları)
- Create: `apps/api/src/modules/admin/presentation/admin-waitlist.controller.ts`
- Modify: `apps/api/src/modules/admin/presentation/admin.dto.ts`, `apps/api/src/modules/admin/domain/admin.constants.ts`, `apps/api/src/modules/admin/admin.module.ts`
- Modify: `apps/api/src/shared/notifications/constants.ts` (`EmailTemplate.SIGNUP_INVITATION = "identity.signup-invitation"`, `EMAIL_COPY_KEY` → `"identitySignupInvitation"`)
- Modify: `apps/api/src/shared/adapters/email/email-render.ts:24-32` (`"identity.signup-invitation": { kind: "reminder", footer: "transaction", path: "link" }`)
- Modify: `apps/api/src/i18n/locales/{tr,en}/notifications.json` (`email.identitySignupInvitation`)
- Test: `waitlist.service.spec.ts`, `email-render.spec.ts`, Create `apps/api/test/admin-waitlist.e2e-spec.ts`

**Interfaces:**
- Consumes: Görev 1 repo, `JOB_QUEUE_PORT`, `JobName.SEND_EMAIL`.
- Produces:
  - `WaitlistService`:
    - `list(q): Promise<Paginated<AdminWaitlistEntry>>`
    - `invite(id: string, actorId: string): Promise<AdminWaitlistEntry>`
    - `inviteEmail(input: { email; role; locale }, actorId): Promise<AdminWaitlistEntry>`
    - `resend(id): Promise<void>`
    - `remove(id): Promise<void>`
  - `AdminWaitlistEntry { id; email; role; status; locale; createdAt: string; invitedAt: string | null }`
  - Uçlar (`@Roles(SUPPORT, FINANCE)` okuma; mutasyon `@Roles(SUPPORT)` + `@Audit`):
    - `GET /v1/admin/waitlist?status&role&q&page&pageSize`
    - `POST /v1/admin/waitlist/:id/invite`
    - `POST /v1/admin/waitlist/invite` body `{email, role, locale}`
    - `POST /v1/admin/waitlist/:id/resend`
    - `DELETE /v1/admin/waitlist/:id`
  - Audit:
    - `AuditAction.SIGNUP_INVITATION_INVITE = "signup-invitation.invite"`, `_RESEND = "signup-invitation.resend"`, `_DELETE = "signup-invitation.delete"`
    - `AuditTargetType.SIGNUP_INVITATION = "signup-invitation"`

- [ ] **Step 1: Failing tests.**
  - `waitlist.service.spec.ts`:
    - `invite at the cap is refused`: `countInvited()` = `max_invited_emails` → `WAITLIST_INVITE_LIMIT`; `markInvited` çağrılmaz.
    - `invite enqueues the invitation email`: `SEND_EMAIL` `{ to, template: "identity.signup-invitation", variables: { link: "https://app.test/kayit?davet=1" } }`.
    - `coach link carries rol=koc`: `…/kayit?davet=1&rol=koc`.
    - `en row links to /en/signup?davet=1`.
    - `resend of a waiting row is not found`: `WAITLIST_ENTRY_NOT_FOUND`.
  - `email-render.spec.ts`: şablon konu "Pencerenin ışığı yandı, davetin geldi!" ve CTA "Hesabımı aç" ile render olur, link `vars.link`.
  - `admin-waitlist.e2e-spec.ts`:
    - SUPPORT listeler, davet eder (satır `invited`, job kuyrukta), siler.
    - FINANCE davet edemez (403).
    - Audit satırı yazılır.
- [ ] **Step 2:** `pnpm --filter @mentor/api exec vitest run waitlist.service.spec email-render.spec admin-waitlist` → FAIL.
- [ ] **Step 3:** Uygula.
  - Copy `identitySignupInvitation`: `subject` / `preheader` ("PuhuKoç'taki yerin hazır.") / `heading` ("Sıra sana geldi!") / `bubble` ("Sıra sana geldi!") / `body` / `cta` / `footnote`. Global Constraints'teki metin birebir.
  - E-posta dili satırın `locale`'i.
- [ ] **Step 4:** Aynı komut → PASS.

### Task 5: API client ve admin paneli sayfası

**Files:**
- Regenerate: `packages/api-client/openapi.json`, `packages/api-client/src/generated/api.ts`
- Create: `apps/admin/src/app/(general)/waitlist/page.tsx`
- Modify: `apps/admin/src/lib/types.ts` (`AdminWaitlistEntry`), `apps/admin/src/utils/fackData/menuList.ts` (`name: "Bekleme listesi"`, `path: "/waitlist"`, `icon: "feather-clock"`, `roles: ["SUPER_ADMIN", "SUPPORT"]`)
- Modify: `apps/admin/src/app/(general)/config/config-hints.ts` (üç mod açıklaması)

**Interfaces:**
- Consumes: Görev 3–4 uçları.

- [ ] **Step 1:** `pnpm --filter @mentor/api openapi:export && pnpm --filter @mentor/api-client generate` → diff'te `waitlist` uçları görünür.
- [ ] **Step 2:** Sayfayı `coach-applications/page.tsx` deseniyle yaz.
  - Bileşenler: `AdminPageHeader`, `AsyncState`, `DataTableShell`, `IconAction`, `StatusBadge`, `apiClient`.
  - Tablo kolonları: E-posta · Rol (Öğrenci/Koç) · Durum (Bekliyor/Davetli) · Katılım · Davet.
  - Filtreler: durum, rol, arama. Satır aksiyonları: "Davet et" (waiting), "Yeniden gönder" (invited), "Sil" (Swal onayı).
  - Üstte "E-postayla davet et" formu (e-posta + rol).
  - `WAITLIST_INVITE_LIMIT` hatası Swal ile gösterilir.
- [ ] **Step 3:** `config-hints.ts`'e `signup.enabled` / `signup.pilot.enabled` için tabloyu yaz: "Açık: true/false · Davetli: true/true · Kapalı: false/–".
- [ ] **Step 4:** `pnpm --filter @mentor/admin typecheck` → PASS; admin'i `pnpm --filter @mentor/admin dev` ile açıp liste → davet → sil akışını gör.

### Task 6: Web bekleme listesi modalı ve CTA bileşeni

**Files:**
- Create: `apps/web/src/lib/signup-waitlist.ts` (+ `signup-waitlist.spec.ts`)
- Create: `apps/web/src/components/waitlist/waitlist-modal.tsx`
- Create: `apps/web/src/components/waitlist/signup-cta.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/_components/signup-turnstile.tsx:13` (`action` union'a `"waitlist"`)
- Create: `apps/web/public/visuals/waitlist/` (yer tutucu: `city-facade.webp` → `w1`, `room-puhu.webp` → `w2` kopyaları; gerçek sanat gelince değişir)
- Modify: `apps/web/messages/{tr,en}.json` (`waitlist.*`)

**Interfaces:**
- Consumes: `POST /v1/auth/waitlist` (api-client), `useAppAvailability()`.
- Produces:
  - `isWaitlistOn(availability: AppAvailabilityDto | null): boolean` (null → true)
  - `isInviteLink(search: URLSearchParams): boolean` (`davet=1`)
  - `opensWaitlist(code: string | null): boolean` (`AUTH_GOOGLE_ACCOUNT_NOT_FOUND` | `AUTH_SIGNUP_CLOSED` | `AUTH_PILOT_INVITATION_REQUIRED`)
  - `<WaitlistModal role: "student" | "coach"; onClose: () => void />`
  - `<SignupCta href: Href; role: "student" | "coach"; className: string; children />`: waitlist kapalıysa `Link`, açıksa modalı açan `<button type="button">` (modal `next/dynamic` ile yüklenir).

- [ ] **Step 1: Failing test.** `signup-waitlist.spec.ts`:
  - `null availability counts as waitlist`.
  - `signupWaitlist false → false`.
  - `davet=1 is an invite link, davet=0 is not`.
  - `opensWaitlist` üç kod için true, `AUTH_GOOGLE_EMAIL_UNVERIFIED` için false.
- [ ] **Step 2:** `pnpm --filter @mentor/web exec vitest run signup-waitlist` → FAIL.
- [ ] **Step 3:** Helper'ları yaz → PASS.
- [ ] **Step 4:** `WaitlistModal`'ı yaz.
  - Temel: `@mentor/ui` `Modal`, `placement="sheet"`, `banner`=sanat (W1; başarıda W2 ve ışık parlaması, `useReducedMotion` ile parlama yok), `onSubmit`, `initialFocusRef`=e-posta alanı.
  - Görünüm: tuvaldeki `Main.dc.html` / `A-Mobile.dc.html` gece kartı. `className` ile `--landing-*` tokenları; buton lamba sarısı LEDGE.
  - Durumlar: `idle | sending | success | error | network`. E-posta formatı istemci tarafında da kontrol edilir; hata `aria-invalid` + `role="alert"`.
  - Turnstile `SignupTurnstile action="waitlist"`.
  - Başarıda `aria-live="polite"`. "Düzelt" e-postayı koruyarak forma döner; "Tamam" kapatır.
  - Link: "Giriş yap" → `/login`. Aydınlatma metni linki yok (kullanıcı kararı).
  - Metin `waitlist.*` anahtarlarında, Global Constraints'teki TR birebir.
- [ ] **Step 5:** `SignupCta`'yı yaz.
- [ ] **Step 6:** `pnpm --filter @mentor/web typecheck` → PASS.

### Task 7: Web bağlantıları (landing, kayıt, giriş)

**Files:**
- Modify (`Link href="/welcome"` → `SignupCta role="student"`):
  - `apps/web/src/app/[locale]/_components/landing/city-panels.tsx:91` ve `:236`
  - `landing-after.tsx:108`
  - `landing-nav.tsx:72`
  - `career-picker.tsx:73`
  - `landing-premium.tsx:77`
- Modify (koç CTA → `SignupCta role="coach"`; görünürlük `isWaitlistOn(availability) || coachSignupOpen`):
  - `landing-nav.tsx:66-67`
  - `landing-after.tsx:18-35`
  - `apps/web/src/app/[locale]/for-coaches/_components/coaches-hero.tsx:76`, `coaches-round.tsx:160`, `for-coaches/page.tsx:41`
  - Landing tarafı `landingAvailability()`'yi kullanır.
- Modify: `apps/web/src/app/[locale]/(auth)/signup/page.tsx`
  - waitlist açık ve `!isInviteLink` ise form yerine `<WaitlistModal role={isCoach ? "coach" : "student"} onClose={() => router.push("/")} />`.
  - `isInviteLink` iken koç "kapalı" ekranı (`:156`) gösterilmez.
  - Forma `<GoogleAuthFeedback />` eklenir.
- Modify: `apps/web/src/app/[locale]/(auth)/login/page.tsx`
  - `:95` "Kayıt ol" → `SignupCta href="/signup" role="student"`.
  - waitlist açıkken `opensWaitlist(googleErrorCode)` ise `GoogleAuthFeedback` yerine modal açık gelir.
- Create: `apps/web/e2e/waitlist.spec.ts`; Modify: `apps/web/e2e/pilot-signup.spec.ts` (`/kayit?davet=1`)

**Interfaces:**
- Consumes: Görev 6 bileşenleri ve helper'ları.
- Not: `/hosgeldin` son slayt ve `welcome-guard.tsx:36` değişmez; `/signup` artık modalı kendisi gösterdiği için ikisi de oraya düşer. *(ponytail: ayrı tetik yok)*

- [ ] **Step 1: Failing e2e.** `waitlist.spec.ts` (availability sunucu tarafında; fixture deseni `apps/web/playwright.question-ads.config.ts:13-18`).
  - `landing start opens the waitlist modal`: "Ücretsiz başla" → dialog "Yerini şimdiden ayıralım!".
  - `waitlist join shows success`: `**/v1/auth/waitlist` 204 → "Harika, listedesin!" ve yazılan e-posta görünür.
  - `/kayit shows the modal, /kayit?davet=1 shows the form`.
  - `login Kayıt ol opens the modal`.
  - `login googleErrorCode=AUTH_GOOGLE_ACCOUNT_NOT_FOUND opens the modal`.
  - `open mode keeps the old links` (signupWaitlist=false → `/welcome`).
  - `reduced motion swaps the art without the glow`.
- [ ] **Step 2:** `pnpm --filter @mentor/web build && pnpm --filter @mentor/web exec playwright test waitlist pilot-signup` → FAIL.
- [ ] **Step 3:** Bağlantıları yap.
- [ ] **Step 4:** Aynı komut → PASS. Ayrıca `landing.spec.ts` ve `onboarding-redesign.spec.ts` yeşil.
- [ ] **Step 5:** Tarayıcı kontrolü: 375 ve 1440 ekran görüntüsü, klavyeyle aç-doldur-gönder-kapat (odak tetikleyiciye döner), Esc kapatır.

### Task 8: KVKK metni, dokümanlar, son kontrol

**Files:**
- Modify: `apps/web/src/lib/legal.ts` (`LEGAL_COPY.kvkk.tr` / `.en`'e bekleme listesi bölümü)
- Modify: `docs/features/identity.md` (zaman çizelgesi), `docs/core/deployment.md:65-66` (çıkış: `signup.pilot.enabled=true`; "public signup" notu), `docs/copy/voice.md` (Bekleme listesi: enerjik Puhu satırı + "davet/kısıt/saklama modalda yazılmaz")

- [ ] **Step 1:** KVKK TR taslağını ekle (hukuki onay gerekir, PR açıklamasında belirt):
  > **Bekleme listesi.** Bekleme listesine yazdığın e-posta adresini yalnızca PuhuKoç açıldığında ve davetin hazır olduğunda sana haber vermek için işleriz. Kayıt olduğunda bu kayıt silinir. Kayıt olmazsan listeye katıldığın, davet edildiysen davet edildiğin tarihten 6 ay sonra otomatik olarak silinir.

  EN karşılığını aynı anlamla ekle. `legal.spec.ts` yeşil.
- [ ] **Step 2:** Doküman güncellemeleri.
- [ ] **Step 3:** Tam kontrol: `pnpm lint && pnpm typecheck && pnpm --filter @mentor/api test && pnpm --filter @mentor/web test` → hepsi yeşil. Önceden kırmızı olan varsa ayrı not et.
