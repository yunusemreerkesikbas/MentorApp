# Invite Referral Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the profile "Davet et" card into a referral flow that brings paying users: `PUHU-` codes shared as links, an automatic invitee discount through the promotions module, a study-buddy link between the two, an honest Duolingo-style card with progress, and coaches kept out.

**Architecture:** Economy keeps owning invites and the inviter's Coin (unchanged conversion path). Promotions gains an `INVITED` rule; payments feeds it two new signals (`invitedAt` via a registry economy fills at boot, so payments never imports economy, and `hasPaid`/`phoneFingerprint` from its own data). Web adds a public `/davet/[code]` landing that survives signup + onboarding through session storage, and the card reads one extended `GET /economy/invite` view.

**Tech Stack:** NestJS + Drizzle (Postgres, RLS service context), zod (`@mentor/validation`), Next.js 16 App Router + next-intl, framer-motion, Vitest, Playwright, orval (`@mentor/api-client`).

**Spec:** [`docs/superpowers/specs/2026-10-25-invite-referral-design.md`](../specs/2026-10-25-invite-referral-design.md)

## Global Constraints

- Code format `PUHU-` + 8 chars from alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0 O 1 I`); legacy `MENTOR-` codes become `PUHU-` + their old 12-hex suffix.
- Input normalization everywhere: `trim → toUpperCase → ^MENTOR- → PUHU-`; accepted shape `^PUHU-[0-9A-Z]{8,12}$`.
- Redeem window: `economy.invite.redeem_window_days`, default `7`, counted from `users.created_at` (exact 24h days).
- Inviter reward unchanged: `economy.invite.reward_coin` (default 20), only on the invitee's first positive successful payment; existing caps and refund reversal stay.
- Invite discount = an admin-created promotion with `ruleType: "INVITED"`, `ruleParams: { withinDays }` (default 30, days since redeem); needs a verified phone; once per phone fingerprint per promotion; web checkout only (no change to the sellable-plan filter).
- Discount is frozen at checkout (`promotions.reserve`): a code entered during a trial gets no discount.
- Coaches (`UserRole.COACH`) are fully out: no code, no redeem, coach-owned codes are invalid, no Coin when either side is a coach at conversion.
- Inviter sees joined friends by display name, payers only as a count (CONVERTED and `reward_outcome` not in `REFUNDED`, `REVERSED`).
- Disclosure line before any redeem: tr `"{name} katıldığını görecek. Premium'a geçersen ona Coin düşer."`, no-name variant `"Davet eden kişi katıldığını görecek. Premium'a geçersen ona Coin düşer."`; en `"{name} will see that you joined. If you go Premium, they get Coin."` / `"Whoever invited you will see that you joined. If you go Premium, they get Coin."`.
- Copy: card, landing and invite notifications = Puhu (Duolingo-like: short, warm, max one `!` per sentence, max one emoji per line, none in `aria-label`); errors and payment lines = companion. `sen`, no em dash `—`, no "lütfen", no "hak kazan". tr and en together.
- UI values from DESIGN.md tokens / `@mentor/ui`; new page gets a mirroring skeleton; components split before ~250–300 lines.
- Modules never read another context's tables; cross-module reads go through exported services.
- Dev tests per module only: `pnpm --filter @mentor/api exec vitest run <spec-name>`, `pnpm --filter @mentor/web test`, targeted Playwright. Full suite + lint + typecheck once before the PR.
- Each task appends a timeline entry to the matching `docs/features/*.md` (economy, promotions, identity, notifications as touched).

## Review Focus

1. **Link opened in an in-app browser, account finished elsewhere** (session storage lost) — the landing page shows the code in readable text so the person can type it in Ayarlar within 7 days. Pinned in Task 7.
2. **Auto-redeem after onboarding races a manual redeem** (or a double click) — exactly one redemption, one buddy request/follow pair, one inviter notification; the loser sees "already used". Pinned in Task 3.
3. **Inviter account erased/anonymized** — public preview returns not-found and redeem says invalid; no display name leaks. Pinned in Task 5.
4. **Abandoned checkout** (`VOIDED` redemption) must not burn the phone's one invite discount; the person can retry. Pinned in Task 4.
5. **Window boundary** — redeem at `created_at + 7d - 1s` succeeds, at `+ 7d + 1s` fails, independent of the server timezone. Pinned in Task 2.

---

### Task 1: PUHU code format and normalization

**Files:**
- Modify: `packages/validation/src/economy.ts` (replace `redeemInviteSchema`)
- Create: `packages/validation/src/economy.spec.ts` (if the package has no spec runner, put the cases in `apps/api/src/modules/economy/application/invite.service.spec.ts`)
- Modify: `apps/api/src/modules/economy/application/invite.service.ts` (`genCode`)
- Create: custom migration `apps/api/drizzle/0128_invite_puhu_codes.sql` (`pnpm --filter @mentor/api exec drizzle-kit generate --custom --name invite_puhu_codes`)
- Modify: `apps/web/src/app/[locale]/(app)/profile/_components/economy-invite-card.tsx` (placeholder `PUHU-…`)

**Interfaces:**
- Produces: `normalizeInviteCode(raw: string): string` and `inviteCodeSchema` (zod, output normalized) in `@mentor/validation`; `redeemInviteSchema = z.object({ code: inviteCodeSchema })`; `generateInviteCode(): string` exported from `invite.service.ts`.

- [ ] **Step 1: Write failing tests**
  - `normalizeInviteCode(" puhu-7kx4m9qr ") === "PUHU-7KX4M9QR"`
  - `normalizeInviteCode("mentor-d650653f9bb6") === "PUHU-D650653F9BB6"`
  - `inviteCodeSchema.safeParse("PUHU-7KX4").success === false`; `inviteCodeSchema.safeParse("hello").success === false`
  - `generateInviteCode()` matches `/^PUHU-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/` over 200 calls.
- [ ] **Step 2: Run, expect FAIL** — `pnpm --filter @mentor/api exec vitest run invite.service`
- [ ] **Step 3: Implement** — schema `z.string().transform(normalizeInviteCode).pipe(z.string().regex(/^PUHU-[0-9A-Z]{8,12}$/))`; `generateInviteCode` uses `crypto.randomInt` over the alphabet; `getOrCreateCode` calls it (keeps its 5-try collision loop).
- [ ] **Step 4: Migration** — SQL: `update invites set code = 'PUHU-' || substr(code, 8) where code like 'MENTOR-%';` and the same for `invite_redemptions.code`. Run `pnpm --filter @mentor/api db:migrate`; verify `select count(*) from invites where code like 'MENTOR-%'` returns 0 on the dev DB.
- [ ] **Step 5: Run tests, expect PASS**; existing `economy-invite.e2e-spec.ts` still passes (`/^MENTOR-/` assertion there becomes `/^PUHU-/`; its `MENTOR-DEADBEEF` unknown code becomes `PUHU-DEADBEEF`).
- [ ] **Step 6: Commit** — `feat(economy): PUHU invite codes with case-insensitive input`

### Task 2: Redeem and conversion rules (window, paid check, coaches)

**Files:**
- Modify: `apps/api/src/modules/economy/application/invite.service.ts` (`redeem`, `onInvitedConverted`)
- Modify: `apps/api/src/modules/economy/presentation/economy.controller.ts` (`invite`, `redeem`: coach → 403)
- Modify: `apps/api/src/modules/payments/application/payment-evidence.service.ts`, `apps/api/src/modules/payments/infrastructure/payments.repositories.ts`
- Modify: `apps/api/src/common/errors/error-code.ts`, `apps/api/src/i18n/locales/{tr,en}/errors.json`
- Modify: `apps/api/src/common/config/config.catalog.ts` (+ `apps/admin/src/app/(general)/config/config-hints.ts`)
- Test: `apps/api/src/modules/economy/application/invite.service.spec.ts`, `apps/api/test/economy-invite.e2e-spec.ts`

**Interfaces:**
- Consumes: `UsersRepository.findByIdService(id)` (row has `createdAt`, `roles`, `displayName`, `status`).
- Produces: `PaymentEvidenceService.hasPaid(userId: string): Promise<boolean>` (any SUCCEEDED RENEWAL with `amount_minor > 0`, no advisory lock — new repo method `hasPositiveCharge(userId)`); error codes `INVITE_ALREADY_PAID` (replaces `INVITE_ALREADY_PREMIUM`, 409), `INVITE_WINDOW_CLOSED` (409, args `{ days }`), `INVITE_COACH_NOT_ALLOWED` (403); config key `economy.invite.redeem_window_days` (count, default 7, min 1, max 90); redemption outcome `COACH_SKIPPED`.

- [ ] **Step 1: Failing unit tests** (`invite.service.spec.ts`, mocks as the file already does):
  - trialing user with no positive charge → `redeem` returns `{ status: "PENDING" }` (was rejected as premium).
  - user with `hasPaid = true` → `INVITE_ALREADY_PAID`.
  - user created `7d + 1s` ago → `INVITE_WINDOW_CLOSED`; created `7d - 1s` ago → PENDING (use a fixed `now` injected or `vi.setSystemTime`).
  - invite owner has role COACH → `INVITE_CODE_INVALID`.
  - redeemer has role COACH → `INVITE_COACH_NOT_ALLOWED`.
  - `onInvitedConverted` when inviter or invited is COACH → `recordPayment(..., "COACH_SKIPPED")`, no grant.
- [ ] **Step 2: Run, expect FAIL** — `pnpm --filter @mentor/api exec vitest run invite.service`
- [ ] **Step 3: Implement** — order of checks in `redeem`: code exists and owner not coach/erased → not self → redeemer not coach → not already redeemed → window → `!hasPaid`. Drop the `EntitlementService` dependency from `InviteService` if nothing else uses it. Controller: `GET /economy/invite` returns 403 `INVITE_COACH_NOT_ALLOWED` for coaches (role from `RequestUser.roles`).
- [ ] **Step 4: Copy** — tr errors (companion): `INVITE_ALREADY_PAID`: "Zaten Premium'a geçmişsin, davet koduna gerek yok."; `INVITE_WINDOW_CLOSED`: "Davet kodu kayıttan sonraki ilk {days} günde kullanılabiliyor."; `INVITE_COACH_NOT_ALLOWED`: "Davet kodları öğrenciler için."; en equivalents in the same voice.
- [ ] **Step 5: Extend e2e** (`economy-invite.e2e-spec.ts`): trial checkout first, then redeem → 201; lowercase code → 201; coach redeem → 403.
- [ ] **Step 6: Run both specs, expect PASS** — `... vitest run invite.service` and `... vitest run economy-invite`
- [ ] **Step 7: Commit** — `feat(economy): invite redeem window, paid check and coach exclusion`

### Task 3: Redeem side effects — study buddy or mutual follow, inviter notification

**Files:**
- Modify: `apps/api/src/modules/identity/application/buddy.service.ts`, `follow.service.ts`
- Modify: `apps/api/src/modules/identity/domain/identity.events.ts` (`BuddyEvent.viaInvite?: boolean`)
- Modify: `apps/api/src/modules/economy/domain/economy.events.ts`, `apps/api/src/modules/economy/application/invite.service.ts`
- Create: `apps/api/src/modules/notifications/application/listeners/invite-events.listener.ts` (+ register in `notifications.module.ts`)
- Modify: `apps/api/src/modules/notifications/domain/notification-copy.ts`, `apps/api/src/i18n/locales/{tr,en}/notifications.json`, `identity-events.listener.ts`
- Test: `buddy.service.spec.ts`, `invite.service.spec.ts`, `invite-events.listener.spec.ts` (new), `economy-invite.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `BuddyService.requestFromInvite(requesterId: string, addresseeId: string): Promise<boolean>` — true when a PENDING request was inserted; false (no throw) when either side has an active pair or any pending request, or a row between them exists. Emits `BUDDY_REQUESTED` with `viaInvite: true`.
  - `FollowService.followEachOtherSilently(a: string, b: string): Promise<void>` — both directions, idempotent, emits no `USER_FOLLOWED`.
  - Economy event `EconomyEventTopic.INVITE_REDEEMED = "economy.invite.redeemed"`, payload `{ redemptionId, inviterUserId, invitedUserId, invitedDisplayName, buddyRequested: boolean }`.
  - Copy keys `INVITE_JOINED` (`inviteJoined`) and `BUDDY_REQUESTED_VIA_INVITE` (`buddyRequestedViaInvite`).

- [ ] **Step 1: Failing tests**
  - buddy: `requestFromInvite` returns false and inserts nothing when the addressee already has an active pair; returns true and emits `BUDDY_REQUESTED` with `viaInvite: true` otherwise.
  - invite service: after a successful redeem it calls `requestFromInvite(invited, inviter)`; when that returns false it calls `followEachOtherSilently`; it emits `INVITE_REDEEMED` once; a throw in either side effect still returns `{ status: "PENDING" }`.
  - listener: `INVITE_REDEEMED` with `buddyRequested: false` → one `createFromTemplate(inviter, "FORUM", INVITE_JOINED, "/settings", { args: { name }, dedupeKey: "invite-joined:<redemptionId>" })`; with `buddyRequested: true` → nothing (the buddy notification carries it).
  - identity listener: `BUDDY_REQUESTED` with `viaInvite` uses `BUDDY_REQUESTED_VIA_INVITE`.
  - e2e (Review Focus 2): two concurrent redeems by the same user → one 201, one 409; exactly one buddy row and one `inviteJoined`/`buddyRequestedViaInvite` notification for the inviter.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** — side effects run after the redemption insert, best-effort with `logger.warn` (same pattern as the quest grant). Event emitted only by the winning insert.
- [ ] **Step 4: Copy** (Puhu) — tr `inviteJoined`: title "{name} davetinle geldi!", body "Premium'a geçerse sana Coin düşer."; tr `buddyRequestedViaInvite`: title "{name} davetinle geldi!", body "Seninle çalışmak istiyor. İsteği seans ekranında bekliyor."; en in the same voice.
- [ ] **Step 5: Run specs, expect PASS** — `buddy.service`, `invite.service`, `invite-events.listener`, `identity-events.listener`, `economy-invite`
- [ ] **Step 6: Commit** — `feat(economy): invite links friends as study buddies and notifies the inviter`

### Task 4: Promotions `INVITED` rule with phone-once

**Files:**
- Modify: `packages/types/src/promotions.ts` (`PromotionRuleType.INVITED`, `PROMOTION_RULE_TYPES`, reasons `"PHONE_REQUIRED" | "PHONE_USED"`)
- Modify: `packages/validation/src/promotions.ts` (enum + `refinePromotion`: INVITED requires `{ withinDays }`)
- Modify: `apps/api/src/database/schema.ts` (`promotions_rule_type_check` adds `'INVITED'`; `promotion_redemptions.phone_fingerprint text` nullable) → `pnpm --filter @mentor/api db:generate` (0129)
- Modify: `apps/api/src/modules/promotions/domain/promotion-rule.ts`, `application/promotions.service.ts`, `infrastructure/promotion-redemption.repository.ts`
- Create: `apps/api/src/modules/payments/application/invite-signal.registry.ts` (provided + exported by `PaymentsModule`)
- Modify: `apps/api/src/modules/payments/application/subscriptions.service.ts` (`promotionContext`, checkout reserve call), `checkout.service.ts`
- Modify: `apps/api/src/modules/economy/application/invite.service.ts` (`onModuleInit` registers the resolver)
- Modify: `apps/admin/src/lib/types.ts`, `apps/admin/src/app/(general)/promotions/PromotionForm.tsx`, `page.tsx` (label "Davetle gelen", `withinDays` field shown for INVITED too)
- Test: `promotion-rule.spec.ts`, `promotions.service.spec.ts`, `apps/api/test/economy-invite.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `PromotionRuleContext` + `PromotionUserContext` gain `invitedAt: Date | null`, `hasPaid: boolean`, `phoneFingerprint: string | null`.
  - `evaluateRule(INVITED, { withinDays }, ctx)` = `invitedAt !== null && !hasPaid && phoneFingerprint !== null && now - invitedAt <= withinDays days`.
  - `InviteSignalRegistry` with `register(resolver: (userId: string) => Promise<Date | null>): void` and `invitedAt(userId: string): Promise<Date | null>` (returns null when nothing registered).
  - `PromotionRedemptionRepository.countActiveForPhone(promotionId: string, phoneFingerprint: string, tx?: DatabaseTx): Promise<number>` (status ≠ `VOIDED`).
  - `ResolvedOffer` gains `ruleType: PromotionRuleType | null`.
  - `promotions.reserve` params gain `phoneFingerprint: string | null`; it is stored on the row.

- [ ] **Step 1: Failing tests**
  - `evaluateRule` INVITED: true inside window; false when `hasPaid`, when `phoneFingerprint` null, when `invitedAt` null, when `withinDays` exceeded.
  - `disqualify` for INVITED: `countActiveForPhone > 0` → `"PHONE_USED"`.
  - `reserve` for an INVITED promotion: second reservation with the same fingerprint (first APPLIED) → `PROMOTION_NOT_ELIGIBLE` reason `PHONE_USED`; after the first is `VOIDED` it succeeds (Review Focus 4).
  - validation: INVITED without `withinDays` rejected.
  - e2e: admin creates INVITED 30% promotion; invited user (phone verified) redeems, then `POST /subscription/offers` shows the discount; non-invited user sees list price.
- [ ] **Step 2: Run, expect FAIL** — `... vitest run promotion-rule`, `... vitest run promotions.service`
- [ ] **Step 3: Implement** — payments builds the three signals in `promotionContext` (`InviteSignalRegistry.invitedAt`, `PaymentEvidenceService.hasPaid`, `UsersService.getVerifiedPhoneFingerprint`); the check in `reserve` runs under the existing promotion lock. `findWinBackOffer` passes `invitedAt: null, hasPaid: true, phoneFingerprint: null`.
- [ ] **Step 4: Migration + admin** — generate 0129, migrate dev DB, create an INVITED promotion from the admin form once to verify the select and the `withinDays` field.
- [ ] **Step 5: Run specs, expect PASS** (+ `economy-invite`)
- [ ] **Step 6: Commit** — `feat(promotions): INVITED rule, once per verified phone`

### Task 5: Invite views — own card view and public preview

**Files:**
- Modify: `packages/types/src/economy.ts`
- Modify: `apps/api/src/modules/economy/application/invite.service.ts`, `infrastructure/invite.repository.ts`, `presentation/economy.controller.ts`, `presentation/economy.dto.ts`
- Create: `apps/api/src/modules/economy/presentation/invite-preview.controller.ts` (`@Public()`, `@Throttle({ default: { limit: 20, ttl: 60_000 } })`; register in `economy.module.ts` `controllers`)
- Modify: `apps/api/src/modules/payments/application/subscriptions.service.ts`
- Regenerate: `pnpm --filter @mentor/api openapi:export` then `pnpm --filter @mentor/api-client generate`
- Test: `invite.service.spec.ts`, `economy-invite.e2e-spec.ts`

**Interfaces:**
- Produces (types):
  ```ts
  export interface InviteDiscountView { discountType: "PERCENT" | "FIXED"; discountValue: number; phoneRequired: boolean }
  export interface InviteCodeView {
    code: string;
    rewardCoin: number;
    joined: { displayName: string }[];      // newest first, max 20
    convertedCount: number;
    redeemed: { inviterDisplayName: string; discount: InviteDiscountView | null } | null;
    canRedeem: boolean;                      // false when redeemed, paid, window closed
  }
  export interface InvitePreviewView { inviterDisplayName: string; discount: Omit<InviteDiscountView, "phoneRequired"> | null }
  ```
- Produces (API): `GET /v1/economy/invite` → `InviteCodeView`; `GET /v1/economy/invite/preview/:code` → `InvitePreviewView` or 404 `INVITE_CODE_INVALID` (also when economy is disabled, owner is coach or erased); `SubscriptionsService.findInviteOffer(userId: string): Promise<PromotionOfferView | null>` (best offer with `ruleType === INVITED`, like `findWinBackOffer`) and `SubscriptionsService.previewInviteOffer(): Promise<PromotionSummary | null>` (a live INVITED promotion covering a web-sellable plan, no user context).
- `InviteRepository.listJoinedByInviter(inviterUserId, limit)` and `countConvertedByInviter(inviterUserId)` (excludes `REFUNDED`, `REVERSED`); display names via `UsersService.listDisplayIdentities`.

- [ ] **Step 1: Failing tests**
  - view: inviter with 2 redemptions (1 CONVERTED/GRANTED, 1 CONVERTED/REFUNDED) → `joined.length === 2`, `convertedCount === 1`.
  - view: invited user → `redeemed.inviterDisplayName` set, `canRedeem === false`; phone not verified + INVITED promotion live → `discount.phoneRequired === true`.
  - preview: unknown code, coach-owned code, anonymized owner (Review Focus 3) → 404; valid code → display name only (no username, no avatar in the payload); no INVITED promotion or web sales off → `discount: null`.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**; replace `summary()` with the view builder; keep `getGlobalStats`.
- [ ] **Step 4: Regenerate client**, `pnpm --filter @mentor/web typecheck` passes.
- [ ] **Step 5: Run specs, expect PASS**
- [ ] **Step 6: Commit** — `feat(economy): invite progress view and public invite preview`

### Task 6: Invite card redesign

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/profile/_components/economy-invite-card.tsx` (shell: overlay, hero, focus)
- Create: `.../profile/_components/invite-share-ticket.tsx` (code + share), `invite-progress.tsx`, `invite-redeem-panel.tsx` (form or redeemed state + disclosure)
- Modify: `.../profile/_components/economy-section.tsx` (pass the full `InviteCodeView`)
- Modify: `apps/web/src/lib/economy.ts` (types), `apps/web/messages/{tr,en}.json` (`economy.*`)
- Modify: `apps/web/src/i18n/routing.ts` — `"/invite/[code]": { tr: "/davet/[code]", en: "/invite/[code]" }` (the page itself comes in Task 7)
- Create: `apps/web/src/lib/invite-link.ts`
- Modify: `apps/web/e2e/profile.spec.ts` (+ fixture returning the new view)

**Interfaces:**
- Consumes: `InviteCodeView` (Task 5).
- Produces: route `/invite/[code]`; `buildInviteLink(code: string, locale: string): string` in `apps/web/src/lib/invite-link.ts` (absolute: `window.location.origin` + `getPathname({ href: { pathname: "/invite/[code]", params: { code } }, locale })`), reused by Task 8.

- [ ] **Step 1: Failing Playwright cases** in `profile.spec.ts` (mocked API):
  - card shows headline "Arkadaşını getir,\nbirlikte çalışın!" and, with a discount view, subtitle containing "%30".
  - "Paylaş" calls `navigator.share` with the link `/davet/PUHU-TEST2345`; without `share`, it copies and shows "Bağlantı kopyalandı".
  - progress line "2 arkadaşın katıldı · 1 kişi Premium'a geçti"; zero state "İlk arkadaşını bekliyoruz!".
  - redeemed view shows "Ayşe davetiyle geldin!" and no input; `canRedeem: false` without redemption shows no form.
  - disclosure line visible above the input.
  - on open, focus is inside the dialog; Tab cycles within it; Escape returns focus to the "Davet et" row.
- [ ] **Step 2: Run, expect FAIL** — `pnpm --filter @mentor/web exec playwright test e2e/profile.spec.ts`
- [ ] **Step 3: Copy** (tr; en mirrors it) — `invite_eyebrow` "Davet et"; `invite_headline` "Arkadaşını getir,\nbirlikte çalışın!"; `invite_subtitle_discount` "{discount} indirim arkadaşına, {coin} Coin sana. Üstelik birlikte çalışırsınız!"; `invite_subtitle_plain` "Arkadaşın Premium'a geçince sana {coin} Coin. Üstelik birlikte çalışırsınız!"; `invite_share` "Paylaş"; `invite_share_text` "PuhuKoç'ta birlikte çalışalım!"; `invite_link_copied` "Bağlantı kopyalandı"; `invite_progress` "{joined, plural, other {# arkadaşın katıldı}} · {converted, plural, other {# kişi Premium'a geçti}}"; `invite_progress_empty` "İlk arkadaşını bekliyoruz!"; `redeem_disclosure` / `redeem_disclosure_named` (Global Constraints); `redeemed_state` "{name} davetiyle geldin!"; `redeemed_discount` "İndirimin ödeme ekranında seni bekliyor."; `redeemed_phone` "İndirim için telefonunu doğrula."; `redeem_saved` "Kodun kaydedildi!". Remove `invite_subtitle`, `redeem_pending`, `invite_copy_short`. `{discount}` is `%30` for PERCENT or the formatted TL amount for FIXED.
- [ ] **Step 4: Implement** — shell keeps the existing motion/hero; focus: move to the close button on mount, trap Tab inside the dialog, restore to the opener on close (no new dependency). `redeemed_phone` links to `/settings` phone card anchor.
- [ ] **Step 5: Run, expect PASS**; `pnpm --filter @mentor/web test` (unit) still green.
- [ ] **Step 6: Commit** — `feat(web): honest invite card with sharing, progress and redeemed state`

### Task 7: Invite landing page and redeem after onboarding

**Files:**
- Create: `apps/web/src/app/[locale]/invite/[code]/page.tsx` (route from Task 6) (server; `robots` noindex; scoped messages), `_components/invite-landing-shell.tsx`, `_components/invite-landing-skeleton.tsx`
- Modify: `apps/web/src/i18n/route-message-scopes.json` (`"inviteLanding": ["invite_landing"]`)
- Create: `apps/web/src/lib/pending-referral.ts` (+ `pending-referral.spec.ts`)
- Modify: `apps/web/src/app/[locale]/(onboarding)/_components/steps/complete-step.tsx`
- Modify: `apps/web/messages/{tr,en}.json` (`invite_landing.*`)
- Create: `apps/web/e2e/invite-landing.spec.ts`

**Interfaces:**
- Consumes: `GET /economy/invite/preview/:code`, `redeemInviteCode`, `normalizeInviteCode`.
- Produces: `rememberPendingReferral(code: string): void` / `consumePendingReferral(): string | null` (sessionStorage key `mentor.pendingReferral`; value re-validated with `inviteCodeSchema` on read; try/catch like `pending-invite.ts`).

- [ ] **Step 1: Failing tests**
  - unit: `consumePendingReferral` returns null for a tampered value (`"<script>"`), returns the code once then null.
  - Playwright (mocked API): anonymous visit `/davet/puhu-test2345` shows "Ayşe seni davet etti!", the discount line when the preview has one, the code `PUHU-TEST2345` as visible text (Review Focus 1), and "Hemen başla" → `/kayit`; pending referral stored.
  - signed-in onboarded visit → "Daveti kabul et" button; no redeem request until clicked; click → success line.
  - onboarding complete with a pending referral → exactly one `POST /economy/invite/redeem`, then the normal destination; a 409 shows the API message as a toast and still navigates.
  - invalid code (preview 404) → "Bu davet bağlantısı çalışmıyor." + "Yine de başla".
- [ ] **Step 2: Run, expect FAIL** — `pnpm --filter @mentor/web exec playwright test e2e/invite-landing.spec.ts`, `pnpm --filter @mentor/web test`
- [ ] **Step 3: Copy** (tr, Puhu; en mirrors) — title "{name} seni davet etti!"; discount "Premium'da {discount} indirim seni bekliyor."; body "PuhuKoç'ta birlikte çalışalım mı?"; code label "Davet kodun"; CTA "Hemen başla"; secondary "Zaten hesabım var"; signed-in CTA "Daveti kabul et"; success "Harika, artık birliktesiniz!"; invalid "Bu davet bağlantısı çalışmıyor." + "Yine de başla"; disclosure line from Global Constraints (named).
- [ ] **Step 4: Implement** — page outside `(app)` like `join-room`; shell fetches the preview client-side with the skeleton while loading; coach users see the invalid state's CTA only (no redeem). Pilot gate untouched: CTAs go to the normal `/signup`.
- [ ] **Step 5: Run, expect PASS**
- [ ] **Step 6: Commit** — `feat(web): /davet landing that carries the code through signup`

### Task 8: "Tavsiye et" shares the personal link

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/profile/_components/application-support-card.tsx`
- Test: `apps/web/e2e/profile.spec.ts`

**Interfaces:**
- Consumes: `fetchInviteCode()`, `buildInviteLink()` (Task 6), `isEconomyDisabled()`.

- [ ] **Step 1: Failing Playwright cases** — student: share payload URL is `/davet/PUHU-TEST2345`; economy disabled (404 `ECONOMY_DISABLED`) or coach: payload URL is `links.shareUrl`.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** — fetch the code lazily on click (no extra request on page load); any failure falls back to `links.shareUrl`.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `feat(web): recommend shares the personal invite link`

### Task 9: Voice docs, feature docs, real-API pass

**Files:**
- Modify: `docs/copy/voice.md` (invite overlay + landing + invite notifications → Puhu; drop `invite_subtitle` / `redeem_pending` from the companion list; replace table rows 78–80 with the new lines)
- Modify: `docs/features/economy.md` (launch rules table: invitee discount, coach exclusion, window), `docs/features/promotions.md` (or the feature doc that covers promotions), timeline entries
- Modify: spec status line → "uygulandı"

- [ ] **Step 1: Docs** as above.
- [ ] **Step 2: Real-API pass** on the dev stack (api 3001, web 3000) with fresh `@example.test` accounts: link → signup → onboarding → auto-redeem; inviter sees the joined name and buddy request; INVITED 30% promotion created in admin shows on the invitee's paywall only after phone verification (needs `payments.web.enabled`); fake-provider payment → inviter +20 Coin and "1 kişi Premium'a geçti"; coach gets 403. Record results in the economy timeline entry.
- [ ] **Step 3: Full checks once** — `pnpm lint`, `pnpm typecheck`, `pnpm --filter @mentor/api test`, `pnpm --filter @mentor/web test`.
- [ ] **Step 4: Commit** — `docs: invite referral voice and feature notes`
