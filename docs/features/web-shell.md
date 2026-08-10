# Web shell & B2C UI

> The `apps/web` app shell: landing, app nav, layout, shared motion, cross-cutting UI polish.
> Workstream: cross-cutting (Sprint 1–3 polish series 0032–0042). The marketing surface + the
> authenticated shell every feature screen lives in.

## Overview

This is the `apps/web` shell — the marketing landing (`/`) and the authenticated app layout
(`(app)/layout` + `AppNav` tab bar/sidebar) that every feature screen (Panel, Plan, Seans, Analiz,
Bilgi, Koç, Profil, Abonelik, Hedef) composes into. It owns the shared motion utilities
(`stagger-motion.ts`), the prefix-safe active-nav matcher (`nav-active.ts`), the mobile tab-bar
offset helpers (`app-shell.ts`), and the B2C UI polish patterns (Nuton-token-faithful components,
framer-motion entrances, chip empty states, `useReducedMotion()` respect). It does **not** own
feature logic — each feature's UI is documented in its own feature doc.

## Architecture (key decisions)

- **Next.js App Router** — route groups `(app)` (authenticated) and `(auth)` (auth screens), plus
  public routes (`/`, `/bilgi/[slug]`). All under `src/app/[locale]/` after the i18n restructure
  (see [i18n.md](./i18n.md)).
- **DESIGN.md tokens, no magic numbers** — UI values come from `@mentor/ui` tokens (`Chip`, `Card`,
  `SectionHeading`, `Button`, `Field`, `SubmitButton`, `FormError`). Nuton thumb pastels for feature
  icons; active nav = `#111` not accent fill.
- **Shared motion** — `lib/stagger-motion.ts` (`staggerListVariants` / `staggerItemVariants`);
  `framer-motion` header fade + grid/section stagger; `AnimatePresence` for phase transitions and
  bubble/badge entrances. `useReducedMotion()` skips stagger/keyframes.
- **Prefix-safe active nav** — `lib/nav-active.ts` `isNavActive` fixes `/panel` falsely matching
  `/plan` prefix; `aria-current`, focus rings, 44px touch targets.
- **Link-as-CTA pattern** — `<Link>` styled as primary button (valid HTML — no `<button>` inside a
  link); used for `/seans`, `/panel`, success-funnel CTAs.
- **Mobile tab bar offset** — `lib/app-shell.ts` `MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS` (63px +
  safe-area); used by layout and the koç composer sticky bar (replaces hardcoded `bottom-16`).

## Tutorials / Guides

```bash
pnpm --filter @mentor/web dev

# Public:
http://localhost:3000/                    # pre-auth welcome slider (first visit)
http://localhost:3000/giris               # return visitors after welcome seen
http://localhost:3000/bilgi/[slug]        # public SEO article

# Authenticated (after /giris):
http://localhost:3000/panel               # daily ritual hub
# Nav: Panel · Plan · Analiz · Bilgi · Koç · Profil (6 tab items on mobile)
```

- **Add a new `(app)` screen:** create `src/app/[locale]/(app)/<route>/page.tsx` (+ `_components/`),
  call `setRequestLocale(locale)` if it's a server page (else it falls to dynamic `ƒ`), add it to
  `app-nav.tsx` if it belongs in the tab bar, and reuse `stagger-motion.ts` for entrance animation.
- **New marketing block:** compose from `@mentor/ui` primitives + shared motion; keep CTAs as
  Link-as-button; respect `useReducedMotion()`.

## UI surfaces

| Surface          | Route           | Notes                                                                                        |
| ---------------- | --------------- | -------------------------------------------------------------------------------------------- |
| Pre-auth welcome | `/`             | 3-slide Puhu carousel; first visit only → then `/giris`; auth users → panel/onboarding       |
| App nav          | `(app)/layout`  | DESIGN 63px tab bar + safe-area inset; sidebar on desktop; active top indicator (main color) |
| Auth shell       | `(auth)/layout` | shared `AuthShell` (Mentor branding, motion card, "Ana sayfaya dön")                         |

## Geliştirmeler (timeline)

- **Chrome typography → Plus Jakarta Sans (2026-08-10)** — App chrome heading/body family
  switched from Nunito Sans to **Plus Jakarta Sans** (`latin` + `latin-ext`, weights
  400–700). Load site: `apps/web` `[locale]/layout.tsx` → `--font-body` (globals alias
  `--font-heading`). Shared tokens: `packages/ui` `theme.css` + `tokens.ts`. Vision-board
  specialty fonts unchanged; only the `body` picker/export stack label follows chrome.
  Temporary `/dev/font-compare` lab removed. Usage: hard refresh after deploy so the new
  Google font CSS applies. Gotcha: admin (Duralux) untouched. Related: `layout.tsx`,
  `DESIGN.md` §3, `board-item-view.tsx`, `board-export.ts`.

- **Yasal sayfa altyapısı (APP-032, 2026-07-31)** — Web'in **hiç yasal sayfası yoktu** ve bu iki
  somut kusur üretiyordu: kayıt formu *"KVKK aydınlatma metnini okudum"* dedirtip **var olmayan ve
  linklenmemiş** bir metne rıza topluyordu; abonelik onayı otomatik tahsilatı anlatıp mesafeli satış
  sözleşmesine link vermiyordu. Linkleyecek bir footer bile yoktu.
  **Kurulan:** 6 belge (`kvkk-aydinlatma` · `gizlilik-politikasi` · `kullanim-kosullari` ·
  `mesafeli-satis-sozlesmesi` · `on-bilgilendirme-formu` · `iade-ve-cayma-hakki`) tek bir registry'de
  (`lib/legal.ts`), tek dinamik route (`/yasal/[slug]` · `/legal/[slug]`), mevcut `ArticleMarkdown`
  ile render, `PublicChrome` + yeni `PublicFooter`.
  **Metinler kasten yazılmadı** — gövdeler yalnız bölüm başlıkları; hukuki metin hukukçu/mali
  müşavir çıktısıdır. Doldurulacak yerler `{{…}}` ile işaretli.
  **Taslak koruması (asıl mühendislik):** `status: DRAFT` → görünür TASLAK bandi + `robots noindex`
  + sitemap dışı; `FINAL` → ikisi de otomatik kalkar. `assertPublishable` bir belge `FINAL` olup
  gövdesinde `{{` bırakılmışsa **build'i düşürür** — ve bu bir test değil bilinçli olarak build-time
  kontrolüdür: `apps/web`'de test runner yok (`lib/*.spec.ts` dosyaları hiç koşmuyor), atlanamayan
  bir kapı gerekiyordu. Prova edildi: geçici `FINAL` + yer tutucu → prerender hatası.
  **Rıza yüzeyleri:** kayıt KVKK metni artık `t.rich` ile gerçek linke dönüşüyor; abonelik onayının
  altında mesafeli satış + ön bilgilendirme linkleri. İkisi de `<label>` içinde olduğundan
  `LegalLink` tıklamayı durdurur — yoksa sözleşmeyi okumak onay kutusunu toggle ederdi.
  **EN:** sayfalar var ama `noindex` + "bağlayıcı metin Türkçesidir" notu taşıyor.
  Yan etki: `PublicArticleChrome` → `@/components/public-chrome` taşındı (legal sayfaları başka
  route'un `_components`'ine uzanmasın). Dosyalar: `lib/legal.ts`, `legal/[slug]/page.tsx`,
  `legal-notices.tsx`, `public-chrome.tsx`, `public-footer.tsx`, `legal-link.tsx`, `routing.ts`,
  `sitemap.ts`, `signup/page.tsx`, `subscription-shell.tsx`, `account-links-card.tsx`.

- **Profile hub density pass (2026-07-31)** — Removed desktop “Profil” title/subtitle.
  Modal-backed list rows (earn + exam) no longer show grey subtitles (values live in
  sheets). `ListRow` tightened to ~56px Nuton height; TR/EN stays on profile for mobile
  (sidebar toggle is desktop-only). Notification toggle descriptions and “Katılım” date
  kept. Related: `profile-shell.tsx`, `account-links-card.tsx`, `economy-section.tsx`,
  `application-support-card.tsx`.

- **Welcome slide 1 full-bleed hero (2026-07-19)** — Pre-auth `/` first slide uses
  `/img/welcome-hero.png` full-screen (`object-cover`); slogan only in art; UI keeps skip,
  pagination, and CTA over a soft white bottom fade. Slides 2–3 keep compact Puhu + copy.
  Related: `welcome-slide-layout.tsx`, `welcome-carousel.tsx`.
- **English internal route source names (2026-07-19)** — Auth, onboarding, dashboard, profile,
  subscription, and cookie-preference App Router folders and source hrefs now use English canonical
  names; users still see localized Turkish paths such as `/giris`, `/panel`, and `/profil`.
  Google OAuth and notification destinations follow the same contract. Related: `i18n/routing.ts`,
  `post-auth-destination.ts`, `google-auth-button.tsx`, `notification-drawer-shell.tsx`.
- **Global typography smoothing** — B2C shell switched from League Spartan/Lato to one Nunito Sans
  latin-ext family for heading/body tokens. Usage: all screens continue using `--font-heading` and
  `--font-body`; no component API changes. Gotcha: visual QA should check dense pages like
  `/topluluk` because text metrics changed slightly. Related: `DESIGN.md`, `[locale]/layout.tsx`,
  `globals.css`, `@mentor/ui` typography tokens. _(2026-07-05.)_
- **Onboarding profil adımı polish** — username/avatar formundaki nested-card hissi azaltıldı:
  avatar satırı gölgesiz hafif field row'a döndü, avatar preview küçültüldü ve form aralıkları
  sıkılaştırıldı. Usage: `/onboarding` profil adımı aynı davranışı korur; sadece görsel hiyerarşi
  daha sakin. Related: `profile-step.tsx`. _(2026-07-04.)_
- **Onboarding profil adımı** — `/onboarding` akışı 5 adıma çıktı: welcome → zorunlu username +
  opsiyonel avatar → sınav → hedef → tamam. Usage: email/Google signup sonrası username seçmeden
  `(app)` shell'e geçilmez; avatar aynı profil upload helper'larını kullanır ve atlanabilir. Gotcha:
  username availability pre-check yok; duplicate mesajı backend `AUTH_USERNAME_IN_USE` cevabından
  gösterilir. Related: `onboarding-wizard.tsx`, `profile-step.tsx`,
  `post-auth-destination.ts`. _(2026-07-03.)_
- **Profil avatar render fix + edit sheet** — profil avatarı fake/R2 public object URL'ini doğrudan
  `<img>` ile render eder; dev fake-object URL'inde kırık `next/image` alt metni görünmez. Profil
  düzenleme akışı generic dialog yerine mevcut bottom sheet primitive'ine taşındı: mobilde sheet,
  desktopta aynı içerik kompakt panel olarak açılır. Related: `profile-header.tsx`. _(2026-07-03.)_
- **Profil avatar V1 UI** — `/profil` header avatarı `ProfileAvatar` parçasına ayrıldı: `avatarUrl`
  varsa yuvarlak fotoğraf, yoksa mevcut ad-soyad baş harfleri render edilir. Profil düzenleme
  modalına JPEG/PNG dosya seçimi, lokal preview ve "Kaldır" aksiyonu eklendi; save sırasında önce
  avatar upload URL alınır, dosya PUT edilir, ardından `PATCH /v1/users/me` çalışır. Gotcha: crop,
  hazır avatar seti ve image transform bu sürümde yok; fake storage'ın relatif upload/public URL'leri
  `resolveApiUrl()` ile API host'una çözümlenir. Related: `profile-header.tsx`,
  `apps/web/src/lib/{avatar,api-base}.ts`, `messages/{tr,en}.json`. _(2026-07-03.)_
- **Profil ayar akışı sadeleştirme** — `/profil` hero daha kompakt hale getirildi; boş username
  metni ve ikinci durum chip'i kaldırıldı, hedef sınav seçimi inline kart gridinden mevcut
  bottom-sheet aksiyonuna taşındı. Mobilde bildirim satırı açıklamaları gizlenerek ilk ekranın
  metin yükü azaltıldı. Related: `profile-header.tsx`, `profil-shell.tsx`,
  `notification-settings.tsx`, `application-support-card.tsx`.
- **Profil username edit** — `/profil` düzenleme modalı kalıcı `username` alanını gösterir ve
  `usersControllerUpdateMe` ile kaydeder; hero `@username` gösterir, boşsa kullanıcı adı eklenmedi
  mesajı kalır. Username forum author alanında kullanılır. Related:
  `profile-header.tsx`, `packages/validation/src/auth.ts`.
- **Profil V1 destek hub** — `/profil` hesap merkezi profil adı düzenleme (mevcut
  `usersControllerUpdateMe`), locale tabanlı dil seçimi, tavsiye paylaşımı, yardım merkezi linki,
  opsiyonel geri bildirim linki ve uygulama sosyal hesapları ile genişletildi. Backend/migration yok;
  dış linkler `profile-links.ts` + `NEXT_PUBLIC_*` config değerlerinden gelir, boş URL'ler render
  edilmez. Related: `apps/web/src/app/[locale]/(app)/profil/_components/*`,
  `apps/web/src/lib/profile-links.ts`, `apps/web/messages/{tr,en}.json`.
- **Profil premium hesap merkezi** — `/profil` panel overview tekrarından arındırıldı; desktopta
  ana hesap ayarları + sağ yan hesap/hak rayı, mobilde referanslardaki compact profil ayar akışı.
  `ProfilShell` yalnız `GET /v1/users/me` yükler, sayfa-özel skeleton gösterir; cover'lı profil hero,
  kompakt sınav seçimi, custom notification toggles ve ikonlu hesap satırları render eder.
  Backend/migration yok; economy flag kapalıysa kazanılmış hak bölümü gizli kalır. Related:
  `apps/web/src/app/[locale]/(app)/profil/_components/*`, `apps/web/messages/{tr,en}.json`.
- **Lucide icon standard** — `apps/web` + web-facing `@mentor/ui` general icons now use
  `lucide-react` with direct `dist/esm/icons/*.mjs` imports (nav, back/add/play/send/chevron,
  notification, toast, form, button, streak/countdown glyphs). Admin `react-icons` remains out of
  scope; special SVGs like the circular timer stay custom. Related: `apps/web/src/lucide-icons.d.ts`,
  `packages/ui/src/lucide-icons.d.ts`. _(0067.)_
- **Profil UI** — `/profil` rebuilt as functional account hub: `ProfilShell` loads `GET /v1/users/me`
  - syncs `AuthProvider` via `setUserFromServer`; `ExamSettingsCard` (KPSS/YKS/LGS radiogroup,
    optimistic + rollback); `ProfileHeader` (Nuton thumb disc); `AccountLinksCard`; NotificationSettings
    refactor. `framer-motion` + `--color-accent` token added. _(0032.)_
- **Pre-auth welcome slider** — `/` 3-slide intro (companionship → AI coach → community); onboarding visual parity; `mentor_welcome_seen` localStorage. Marketing landing removed — future route TBD. _(0062.)_
- **App shell + nav polish** — `isNavActive` (prefix-safe); `AppNav` DESIGN 63px tab bar + safe-area
  inset + active top indicator + `aria-current`/focus rings/44px touch; `(app)/layout` min-h-screen
  shell bg + content padding clears tab bar. _(0041.)_
- **B2C UI polish cross-cutting sweep** — full verify (typecheck/lint/build green); `lib/app-shell.ts`
  shared mobile tab-bar offset classes; dead-code removal (`components/coming-soon.tsx` — all routes
  now have real screens); nav regression fix. Polish series index 0032–0041 consolidated. _(0042.)_
- **Stitch core overlay prompt set** — `.stitch/` Google Stitch project bundle: DESIGN.md subset,
  README workflow, 14 prompt files (00–13), asset guide, review checklist. Puhu mascot variant map +
  missing P0 variants (Thinking, Gentle-Error). Reserved `apps/web/public/mascot/puhu/`. Overlay
  primitives only — do not regenerate feature pages in Stitch. _(0055.)_
- **Stitch page design prompt plan** — extended Stitch scope from overlays-only to **full page
  content inside the existing shell**. Page inventory from live routes + roadmap tier markers
  (🆓/🔵/⭐); priority waves P0–P5 (daily loop → premium → content/account → abonelik → public funnel
  → topluluk); per-page widget specs + state matrix (happy/skeleton/empty/gate). 28 prompt files
  (mobile/desktop pairs). Shell is fixed — prompts must not redraw tab bar/sidebar. _(0060.)_
- **Post-login onboarding wizard** — `/onboarding` route group (no AppNav), 4-step wizard (welcome →
  exam required → goal skippable → complete); gate = `users.examType` (`postAuthDestination()` on
  login/signup + `(app)` layout); Puhu mascots; `onboarding.*` i18n namespace. Users with `examType`
  set go straight to `/panel`. Profil exam picker unchanged. _(0061.)_
- **Pre-auth welcome slider** — replaced `/` marketing landing with a 3-slide pre-auth welcome
  carousel (intro → AI coach → forum/community; Puhu + dash progress). First visit only
  (`localStorage mentor_welcome_seen`); return visitors → `/giris`; authenticated →
  `postAuthDestination()`. Removed `_components/landing/*` + `landing.*` i18n; shared `PuhuImage` +
  `DashProgress`. Separate from post-login onboarding. _(0062.)_
- **Toast notification stack** — Stitch "Mentor Puhu Design System" toast implemented in `@mentor/ui`
  - root `ToastProviderShell`. Usage in client components:
    `const { success, error, coach } = useMentorToast();` then
    `success({ title: "…", message: "…", duration: 3000, puhuVariant: "happy" })`. Puhu variants per
    toast type (overridable via `puhuVariant` / `leading`); error uses SVG icon (gentle-error PNG not yet
    designed). Viewport portals to `document.body`; z-index `100`; mobile 335px top-center, desktop 380px
    top-right. _(0063.)_
- **Dialog / modal** — Stitch Prompt 02 variants as one generic system in `@mentor/ui` +
  `DialogProviderShell` (inside toast shell). Usage:
  `const { confirm, info, promo } = useMentorDialog();`
  | Preset | Stitch use | Returns |
  |---|---|---|
  | `confirm({ title, message, confirmLabel, cancelLabel })` | Abonelik iptali | `Promise<boolean>` |
  | `info({ title, message, okLabel })` | Plan güncellendi | `Promise<void>` |
  | `promo({ title, message, badge?, primaryLabel, linkLabel?, puhuVariant? })` | Premium gate | `Promise<"primary" \| "link" \| "dismiss">` |
  Scroll lock: `html { scrollbar-gutter: stable }` + `html.mentor-dialog-open { overflow: hidden }`.
  _(0064.)_
- **Dialog MVP wiring** — `/abonelik` cancel: `confirm()` then success `info()` (`subscription.*`
  i18n); API errors → `FormError` with backend message. `/hedef` vision save: success `info()`
  (`vision.saved_info_*`); errors → `ApiClientError.body.message`. Panel overlay test strip removed.
  _(0065.)_
- **Toast MVP wiring** — daily loop surfaces: panel task DONE → `success()` after `GET /today`
  refresh with streak count (`panel.task_done_*` i18n); toggle/mood/seans card errors → `error()`
  toast (`common.error_title` + API message). Profil exam type save → `success()` (`profile.exam_settings.saved_toast_*`);
  inline `savedHint` removed. Mood encouragement stays inline in card (backend `message`). Seans
  complete uses `SessionDoneState` only (no success toast). **Overlay choice:** success/transient
  errors → toast; blocking confirmations / save ack → dialog; auth/form pages → `FormError`.
  _(0066.)_
- **Bottom sheet MVP wiring** — `@mentor/ui` action/filter layouts + `BottomSheetProviderShell`.
  Usage: `const { actionSheet, filterSheet } = useMentorBottomSheet();` then
  `await actionSheet({ title, actions, cancelLabel? })` → action id or `"cancel"`. Mobile: bottom
  slide-up (`animate-sheet-*`); desktop: centered max 480px card (no handle, `animate-dialog-*`
  scale/fade — no bottom slide). `/plan` task overflow (⋮) → action sheet
  (toggle done/pending + delete) → delete chains to `confirm()` dialog; action errors → toast.
  Filter layout built but not wired (`/analiz` backlog). **Overlay matrix:** transient success/error →
  toast; destructive confirm / save ack → dialog; contextual multi-action menu → bottom sheet.
  _(0067.)_
- **Global skeleton primitives** — `@mentor/ui` exports **animation-only** helpers:
  `MENTOR_SKELETON_SHIMMER_CLASS` (`.mentor-skeleton-shimmer`), `MENTOR_SKELETON_ENTER_CLASS`
  (`.mentor-skeleton-enter`), thin `<Skeleton className="…" />` wrapper, `<SkeletonGroup label={…}>`
  for a11y + enter fade. **Layout/shape is page-owned** — compose per screen in
  `*-content-skeleton.tsx` (e.g. `plan-content-skeleton.tsx`, `koc-content-skeleton.tsx`). Animations
  live in `theme.css`; `prefers-reduced-motion` respected. _(0068.)_
- **Skeleton shimmer tone** — `.mentor-skeleton-shimmer` uses `--color-surface-container` (#f0edec,
  same warm gray as passive tab rail) instead of `--color-progress-track` blue. Token added to
  `packages/ui/src/theme.css`. _(plan/koç loading states.)_
- **Topluluk inner layout (Discord-like)** — `apps/web/src/app/[locale]/(app)/topluluk/layout.tsx` adds a second sidebar layer **inside** the existing `(app)` `lg:pl-60` content area. Desktop: in-flow `w-60` zone sidebar (`lg:flex`) + `min-w-0 flex-1` content. Mobile: CSS transform slide-in drawer (`ZoneDrawer`, `z-30`) triggered by hamburger bar (`sticky top-14 z-10`), closes on Escape or backdrop click. Zone detail adds a third column (`xl:w-72` right panel) inside `zone-shell.tsx`. Pattern: nested flex layouts all use `min-w-0` to prevent overflow; no fixed positioning inside content area. _(APP-016)_
- **Profil mobile overflow hardening** — `/profil` account hub keeps the premium card stack but fixes narrow viewport drift: profile hero stacks identity content on mobile, card columns/rows use `min-w-0`, list chevrons/toggles stay fixed, and economy quest/invite rows wrap or truncate instead of widening the page. Usage: 375px profile should remain one-column with no horizontal scroll. Related files: `profil-shell.tsx`, `profile-header.tsx`, notification/support/account/economy profile cards. _(2026-07-01.)_
- **Profil mobile settings hub** — `/profil` now reads as a minimal mobile settings surface:
  centered identity header first, then grouped preferences/app/earned-rights/account rows.
  Economy balance, quests, and invite details move behind the existing bottom sheet so the main
  page stays short; desktop keeps the same overlay in a modal-like panel. Usage: mobile users scan
  rows first; tap earned-rights rows for detail. Gotcha: details reuse existing cards; no new routes
  yet. Related files: `profil-shell.tsx`, `profile-header.tsx`,
  `account-links-card.tsx`, `notification-settings.tsx`, `application-support-card.tsx`,
  `economy-section.tsx`, `messages/{tr,en}.json`. _(2026-07-03.)_
- **Profil bilgi modalı polish** — profil düzenleme formundaki yardımcı metinler azaltıldı,
  e-posta alanı kilit ikonlu bilgi satırı olarak gösterildi ve aksiyonlar mobilde dengeli iki kolon
  oldu. Dialog focus sırası inputları da kapsar, bu yüzden form açılınca ilk düzenlenebilir alan odağı
  alır. Related files: `profile-header.tsx`, `dialog-provider.tsx`,
  `messages/{tr,en}.json`. _(2026-07-03.)_
- **Profil e-posta durum badge'i** — profil header'daki doğrulama chip'i kaldırıldı; doğrulanmış
  kullanıcıda avatar sağ-altında pasif `BadgeCheck`, doğrulanmamış kullanıcıda aynı noktada
  tıklanabilir mail-warning badge'i gösterilir ve mevcut doğrulama e-postası resend akışını çalıştırır.
  Related: `profile-header.tsx`. _(2026-07-03.)_
- **Panel emotional alignment (impeccable critique P0)** — `/panel` home de-scored for companionship tone:
  removed fake `/100` rhythm hero-metric + blue gradient card; white Nuton card with effort summary
  (`rhythm_summary`) instead. Mood check-in card removed from panel body — trigger lives on hero
  **Ruh hali** metric tile (`useMoodCheckin` hook). **Soft auto-prompt:** at most once per
  calendar day when backend mood unset (`localStorage mentor_mood_prompt_deferred_date`);
  cleared storage / new day re-triggers; hero tile always opens manually. Optional
  `MOOD_PROMPT_MODE = "mandatory"` in `mood-checkin.tsx` blocks dismiss until pick.
  Welcome toast once per calendar day (`sessionStorage mentor_panel_welcome_date`). Streak row uses
  calm progress flame (no orange). Related: `panel-shell.tsx`, `mood-checkin.tsx`,
  `messages/{tr,en}.json`. _(2026-07-05.)_
- **Panel quest banner mobile overflow** — `/panel` quest row (`PanelQuestBanner`) flexed
  icon + title + count + chevron without a `min-w-0` shrink chain; long quest titles pushed the
  page into horizontal scroll on narrow viewports. Fix: `min-w-0` on grid/`section`/`aside`/
  article/button, `overflow-hidden` + `truncate` on the text column. Usage: no API change —
  reload `/panel` on ~375px. Gotcha: same pattern as community layout — flex/grid children
  default `min-width: auto`. Related: `panel-shell.tsx`. _(2026-07-23.)_
- **App chrome redesign (header + floating tab)** — Mobile top bar is now avatar (premium gem
  or verified badge) + time-of-day greeting + `displayName`, with XP/coin pills left of the
  notification bell. Bottom nav is a floating pill; active item uses a soft surface capsule;
  **Koç** is centered and elevated (progress-ring FAB, bubble icon kept). Profile moved off the
  mobile tab (avatar → `/profil`); desktop sidebar still lists Profil + Topluluk and elevates
  Koç as a ringed CTA. `PanelTopBar` removed from `/panel` to avoid double greeting; economy
  pills refresh via `mentor:economy-changed`. Padding: `pt-16` / `pb-[88px+safe]`. Related:
  `app-nav.tsx`, `app-shell.ts`, `economy.ts`, `panel-shell.tsx`, `messages/{tr,en}.json`.
  _(2026-07-23.)_
- **Tab active polish + premium badge** — Mobile tab dropped the muddy gray capsule; active =
  top hairline + bold `#111` (Nuton). Hover only on `@media (hover:hover)` with soft progress
  tint. Koç FAB fills black when active. Premium avatar badge switched from `Gem` (same as coin
  pill) to `Crown` so premium ≠ economy diamond. Related: `app-nav.tsx`. _(2026-07-23.)_
- **Mobile tab Koç idle + motion** — Koç FAB idle = white + dark icon; active (`/koç`) = black
  fill. Framer Motion: pill entrance, sliding active dot (`layoutId`), color morph, whileTap
  scale; `useReducedMotion` zeros durations. Related: `app-nav.tsx`. _(2026-07-23.)_
- **Panel PromoSoft cards (slice 1)** — `/panel` Community, quest banner, and Today's ritual
  restyled as pastel PromoSoft surfaces (DESIGN §8.4): soft blob atmosphere, white pill CTAs,
  Puhu on Community only. Quest = thumb-violet wash; ritual = periwinkle; community =
  progress-track. No top slider. Usage: open `/panel`. Gotcha: forum-off still hides Community.
  Related: `community-card.tsx`, `panel-shell.tsx`, `messages/{tr,en}.json`. _(2026-07-23.)_
- **Streak week → Bugünkü ritim** — 7-day flame icons on `DailyRhythmCard`; standalone quest
  promo merged into `TodayFocusCard` as `RitualQuestStrip`. Related: `panel-shell.tsx`.
  _(2026-07-23.)_
- **Haftanın Hikâyesi tam ekran recap (2026-07-26)** — `/analysis/recap` internal rotası
  TR `/analiz/haftanin-hikayesi`, EN `/analysis/weekly-story` olarak eklendi. READY veriyle
  kapak → ritim → varsa plan/deneme → Puhu notu → final akışı; PARTIAL yalnız mevcut kanıtlardan
  2–4 ekran; EMPTY ise görev/seans aksiyonlu sakin state gösterir. Hikâye otomatik ilerlemez:
  buton, swipe, ok tuşları ve Escape desteklidir; reduced-motion crossfade kullanır. `/analiz`
  teaser'ı kalıcıdır; `/panel` teaser'ı `GET /coaching/today.weeklyRecapPeriod` ile waterfall
  oluşturmadan gelir ve `mentor.weekly-recap.opened.v2:<startDate>` anahtarıyla cihazda haftada
  bir görünür. Final paylaşımı yalnız efor sayaçlarını kullanır; plan CTA'sı sadece
  `/plan?add=1` ön-doldurur. Gotcha: görüntülenme sunucuya sync edilmez, başka cihazda tekrar
  görülebilir; AI yüklenmesi hikâyeyi bloklamaz. İlgili dosyalar:
  `analysis/recap/_components/weekly-recap-shell.tsx`, `weekly-recap-teaser.tsx`,
  `lib/weekly-recap.ts`, `panel-shell.tsx`, `messages/{tr,en}.json`.

- **Mentor Wrapped adaptif hikâye (2026-07-27)** — READY recap; kapak, ritim, varsa ders ve
  deneme, haftanın enleri, haftalık unvan, Puhu kapanışı ve final sırasıyla veriye göre 6–8
  ekrana dönüşür. PARTIAL hafta yalnız en güçlü gerçek kanıtı “Haftanın kıvılcımı” olarak
  gösterir; EMPTY akışı değişmedi. Veri ekranları büyük tipografi ve DESIGN pastel yüzeylerini,
  Puhu ise yalnız kapak/unvan/kapanışı kullanır. Paylaşım metnine güvenli unvan eklenir; ders,
  net, mood, görev başlığı ve tarih eklenmez. Mevcut swipe/klavye/reduced-motion, panelin
  haftada-bir görünmesi ve AI/coin davranışları korunur. İlgili dosyalar:
  `weekly-recap-shell.tsx`, `lib/weekly-recap.ts`, `messages/{tr,en}.json`,
  `e2e/weekly-recap.spec.ts`, `e2e/fixtures/analysis.fixture.ts`.

## Gotchas / Known issues

- **Yasal belgeler `DRAFT` — canlıya çıkmadan önce metin şart.** 6 belgenin gövdesi bölüm
  başlığından ibaret; hukukçu metni gelmeden `status`'ü `FINAL` yapmayın. Yapılırsa build düşer
  (`assertPublishable`), ki kasıt bu. `FINAL` olan belge otomatik indekslenir ve sitemap'e girer.
- **Lokalde `pnpm typecheck`'i `next build`'den SONRA koşturmayın.** Web tsconfig'i
  `.next/types/**/*.ts`'i `include` ediyor; bu klasör yalnız build sonrası oluşur ve içindeki
  üretilmiş `validator.ts` ikinci bir `@types/react` çözümü sürükler → hiç dokunulmamış dosyalarda
  (`subject-picker.tsx` vb.) hayalet `Property 'value' does not exist` hataları. CI bunu hiç görmez
  (sıra `lint → typecheck → build`, checkout temiz). Lokalde takılırsanız:
  `rm -rf apps/web/.next/types` ya da typecheck'i build'den önce koşturun.
- **`apps/web`'de test runner yok.** `src/lib/*.spec.ts` dosyaları (weekly-recap, analytics,
  plan-calendar-layout…) **hiç koşmuyor** — pakette vitest bağımlılığı ve `test` script'i yok.
  Web tarafına gerçek bir invariant koyacaksanız build-time kontrolü tercih edin (yasal registry
  böyle yapıyor) ya da önce vitest'i kurun. _(Backlog: bu orphan spec'leri ya çalıştır ya sil.)_
- **Public footer yüzey bazlı mount edilir**, ortak locale layout'una değil — authenticated app'te
  alt navigasyon var, footer onunla çakışır. Yeni bir public sayfa eklerken `PublicFooter`'ı
  elle koymak gerekir.
- **Secondary routes** (`/seans`, `/abonelik`, `/hedef`) — not in the tab bar; no item highlighted
  (by design). 6 tab items on mobile — dense but matches product nav; labels truncate on narrow screens.
- **Koç remains in nav** (product choice; Figma template shows 4 items).
- **Koç composer** docks in the chat shell flex column (main height already clears the tab bar);
  do not re-apply `MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS` there or it double-offsets upward.
- **Secondary hero CTA → `/giris`** (not `/bilgi` — app bilgi hub is auth-gated). Public SEO articles
  remain at `/bilgi/[slug]`. (Note: the marketing landing at `/` was later replaced by the pre-auth
  welcome slider — 0062; a future acquisition page will be a new route, e.g. `/tanitim`.)
- **Root `layout.tsx` was removed** — `<html>`/`<body>` + fonts + `globals.css` now live in
  `[locale]/layout.tsx` (awaited `params`, no dynamic read) so static render stays on (see [i18n.md](./i18n.md)).
- **Stitch frames:** mobile and desktop must be **separate Stitch screens** (01–06 mobile only;
  desktop is a separate run). One change per prompt — Stitch works best with incremental iteration.
- **Puhu PNGs** — runtime assets in `apps/web/public/mascot/puhu/` (incl. `puhu-surprised.png` for
  info toast). `gentle-error` variant still missing — error toast uses inline SVG. Remaining overlay
  primitives (`bottom-sheet`, `drawer`, etc.) follow same Stitch → `@mentor/ui` pattern as toast/dialog.
- **Economy/invite UI was backlog** at this sweep — now covered in [economy.md](./economy.md).
- **Koç nested routes** — tab nav `href="/koc"` returns to the chat landing via `/koc` → `/koc/sohbet` redirect (`isNavActive` still matches nested paths). Panel coach shortcut → `/koc/sohbet?seed=…`. See [ai.md](./ai.md) new-chat landing. _(2026-07-24; was hub 2026-06-30.)_

## Related

- Depends on: [i18n.md](./i18n.md) (locale routing, `[locale]` layout), [core/design-system.md](../core/design-system.md)
  (`@mentor/ui` tokens)
- Composes: every feature doc's "Web:" section
- Status: [core/mvp-status.md](../core/mvp-status.md) (cross-cutting)
