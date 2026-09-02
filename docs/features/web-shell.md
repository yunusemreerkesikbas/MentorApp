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

- **APP-059 güvenli dev ve bloklayıcı performans kapıları (2026-09-01)** — Varsayılan web `dev`
  komutu artık cache silmeden başlar; yalnız kapalı bir sunucuda istisnai kurtarma gerektiğinde
  `dev:clean` kullanılır. Production build sonrasında `check:budgets`, client-reference ve build/font
  manifestlerini okuyup chunk'ları benzersizleştirir; route-attributable JS ile ortak runtime dahil
  toplam JS'yi ayrı ölçer. Kapılar: makale 704/985 KiB, dashboard 715/1287 KiB, makale font preload
  2, root/welcome/article mesajları 1024/2048/6144 byte. Sonuç
  `.next/web-performance-budget-report.json` ve GitHub step summary'ye yazılır; manifest/chunk
  eksikliği veya tek byte aşım CI'ı düşürür. Route scope'ları tek
  `i18n/route-message-scopes.json` sözleşmesinden okunur. Kullanım: production build'den sonra
  `pnpm --filter @mentor/web check:budgets`. Gotcha: script yalnız production `.next` artefaktını
  ölçer; dev çıktısı bütçe kanıtı değildir. İlgili: `scripts/web-performance-budgets*.mjs`,
  `scripts/check-web-performance-budgets.mjs`, `package.json`, `.github/workflows/ci.yml`.

- **Görülmüş-id yardımcısı ortaklaştı (2026-09-01)** — TopBanner'ın item bazlı kapatması ile
  kampanya modalının "kampanya başına bir kez"i aynı şeyi yapıyor: Web Storage'da bir id kümesi
  tutmak. Ayrıştırma/serileştirme `lib/seen-ids.ts`'e taşındı (`parseIdSet`, `serializeIdSet`,
  `readIdSet`, `writeIdSet`); `top-banner-state.ts` yalnız rotasyonu tutuyor.
  Kullanım: yeni bir "bir kez göster" yüzeyi için `readIdSet`/`writeIdSet` kullan, kendi try/catch'ini
  yazma. Gotcha: storage güvenilmez girdi — bozuk JSON, elle düzenleme, gizli pencerede erişimin
  kendisinin throw etmesi. Hepsi "hiçbir şey görülmemiş"e düşüyor; yüzeyin tekrar çıkması zararsız,
  panelin boot'ta patlaması değil. İlgili: `seen-ids.ts`, `top-banner.tsx`, `promotion-dialog.tsx`.

- **TopBanner kapatması item bazlı oldu (2026-08-31)** — Kapatma anahtarı tek bir boolean'dı
  (`dismissed.v1` = `"1"`), yani görev duyurusunu kapatan kullanıcı promosyon şeridini de
  susturuyordu. Artık `dismissed.v2` kapatılan **item id'lerinin** JSON dizisi; kapatma butonu
  yalnız ekranda duran duyuruyu kaldırır, kalanlar yerinde durur. Ayrıştırma
  `parseDismissedIds()` içinde saf fonksiyon ve testli — sessionStorage güvenilmez girdi (bozuk
  JSON, elle düzenleme, eski v1 değeri) ve hiçbiri panelde exception'a dönmemeli.
  Kullanım: yeni duyuru eklerken `TopBannerItem.id`'yi kalıcı ve anlamlı seç; kapatma o id'ye
  yazılıyor. Gotcha: v1 → v2 geçişi anahtar adı bump'ı ile yapıldı, migration yok — eski değer
  sekmeyle birlikte ölüyor. Bir diğeri: rotasyon (5 sn) artık gerçekten iki item'la çalışıyor,
  kapatma sonrası indeks 0'a alınıyor ki sıradaki duyuru atlanmasın.
  İlgili: `top-banner.tsx`, `lib/top-banner-state.ts`, `e2e/promotion-banner.spec.ts`.

- **TopBanner promosyon item'ı + rotasyon canlıya çıktı (2026-08-31)** — Şerit bugüne dek hep 0
  veya 1 item veriyordu; promosyon item'ı ile **çoklu item rotasyonu ilk kez** çalışıyor (5 sn,
  hover/focus'ta duruyor, `AnimatePresence mode="wait"`). Sıra promosyon → görev. Item yalnız
  ücretsiz kullanıcıda ve gerçek indirim varken çıkar; CTA paywall'ı açar. Ayrıca tek planlı
  katalogda paywall ve `/abonelik` plan ızgaraları tam genişliğe geçti.
  Kullanım: `panel-shell.tsx` içinde `promotionBannerItems` + `questBannerItems` birleştiriliyor.
  Gotcha: kapatma anahtarı ortak — bir item'ı kapatmak hepsini gizler. İlgili: `top-banner.tsx`,
  `panel-shell.tsx`, `e2e/promotion-banner.spec.ts`, [promotions.md](./promotions.md).

- **Paywall indirim yüzeyi + hoş geldin hediyesi (2026-08-30)** — Paywall modalinde üstü çizili
  eski fiyat, indirimli fiyat, promosyon rozeti ve katlanabilir kupon alanı. Panelde
  `WelcomeGiftDialog` (mevcut `promo()` preseti, `PremiumCampaignBanner`'ın yanında, yalnız
  ücretsiz kullanıcıda) hak edilen kuponu bir kez duyuruyor. Kupon kodu **veriden** geliyor —
  hiçbir kampanya adı istemcide sabit değil. Kullanım: kural ve kod admin `/promotions`'tan.
  Gotcha: `PremiumCampaignBanner` hâlâ indirim göstermiyor; DESIGN.md §8.4'teki "no fake discount"
  satırı o bileşen için aynen geçerli. Modalın üstü çizili fiyatı **gerçek** liste fiyatıdır —
  uydurma değil (bkz. [payments.md](./payments.md) paywall kuralı). İlgili:
  `premium-paywall-modal.tsx`, `welcome-gift-dialog.tsx`, `panel-shell.tsx`,
  `e2e/promotions.spec.ts`.

- **2026-08-29 — Limited GPT altyapısı** — Backend placement kararı sonrası yüklenen singleton GPT
  loader, contextual slot ve gönüllü rewarded Coin kartı eklendi. Reklam hazır olmadan CTA aktif
  olmaz; kapatma/no-fill Coin vermez; tamamlamada ekonomi pill'leri yenilenir.

- **Toast: Puhu yerine durum ikonu (2026-08-29)** — Toast'ların leading'i maskottan **durum
  ikonuna** geçti. Puhu çıktı çünkü toast, ekranda ne varsa onun üzerine biniyor: Puhu'lu bir empty
  state veya Koç FAB'ı varken ikinci maskot çıkıyordu ve `TOAST_MAX_STACK = 3` olduğu için aynı anda
  üç maskot mümkündü — DESIGN.md §8.3 "at most one banner-class visual per page viewport". Ayrıca
  `error` zaten ikondu (`CircleAlert`), yani aynı bileşende iki görsel dil vardı. Maskot empty
  state / dialog / Koç hub'ında kalıyor.
  - **Tip seti `success | error | warning | info`.** Ölü `coach` varyantı silindi (sıfır çağrı
    yeri). Yeni `warning`, vision-board'daki dört "limit doldu / dosya desteklenmiyor / dosya çok
    büyük" toast'ını `error` kırmızısından çıkardı — bunlar başarısızlık değil sınır uyarısı, ve
    kırmızı §0 anti-shaming tonuna aykırıydı.
  - **Asset sözleşmesi:** `/visuals/toast-{success,error,warning,info}.svg`, 40px kutu (Puhu `sm`
    ile aynı ayak izi → layout kaymaz). Final art tasarımdan gelir (DESIGN.md §8.1); dosya yokken
    `ToastIcon` token renkli lucide glifine düşer, yani kırık görsel değil çalışan bir yedek görünür.
  - **Kontrast:** DESIGN.md'de `--color-warning` yok. Ham `--color-star` kendi well'i üzerinde
    ~1.5:1, ham `--color-progress` ~2.2:1 — ikisi de WCAG 1.4.11 metin-dışı 3:1 eşiğinin altındaydı.
    İkisi de `--color-main`'e karıştırıldı (tema-uyumlu: light'ta koyulaşır, dark'ta açılır).
    Ölçülen: light 3.54–5.09, dark 5.96–8.59.
  - `puhuVariant` toast seçeneği ve `getPuhuToastLeading` kaldırıldı (toast'ta hiç çağrılmıyordu);
    `leading` tam override'ı duruyor. `mentor-dialog`'un `puhuVariant`'ı etkilenmedi.
  İlgili: `toast-lead.tsx`, `mentor-toast.ts`, `packages/ui/src/components/toast/*`,
  `board-editor-shell.tsx`.

- **Yoldaşlık sesi Dalga 10 — seri kurtarma (2026-08-29)** — Teklif/yetersiz hak companion (“Günü dondur”, FOMO yok); başarı overlay Puhu (“Serin yerinde.”, 🔥 kalktı). `error_*` D5’te kaldı. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: hint+confirm tek dialog gövdesi, aynı ağız. İlgili: `apps/web/messages/{tr,en}.json`, `panel-shell.tsx`, `streak-rescue-success.tsx`.

- **Yoldaşlık sesi Dalga 9 — görev toast (2026-08-29)** — Panel/seans `quest_reward_*` Puhu: “Bu da tamam” / `{reward} seninle.` Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: seri kurtarma FOMO duruyor; miktar formatı `+N XP` aynı. İlgili: `apps/web/messages/{tr,en}.json`, `panel-shell.tsx`, `session-done-state.tsx`.

- **Yoldaşlık sesi Dalga 5 — panel toast (2026-08-29)** — `streak_rescue_error_message` / `task_update_error_message` companion: `Lütfen` kalktı, D3 ağız. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: seri kurtarma FOMO metni bu dalgada değil. İlgili: `apps/web/messages/{tr,en}.json`.

- **Premium kampanya banner (2026-08-23)** — Paylaşılan `PremiumCampaignBanner`: sol hediye
  (`upgrade-premium-2.svg`), sağda 7 gün deneme + koç vurgusu, cyan→charcoal linear wash
  (`.premium-campaign-banner`, tema takip etmez). Tıklayınca paywall açılır. Yalnız
  `!isPremium` kullanıcıda görünür; fetch hata/premium ise gizlenir. Panelde sağ sütunda,
  geri sayımın altında yatay kart: solda `campaign.png` (şeffaf zemin), sağda deneme + başlık.
  Sahte indirim yok. Kullanım: başka sayfaya da aynı bileşeni koy. Gotcha: çizim beyaz olduğu
  için zemin kenardan flood-fill ile alındı; orijinal `campaign.jpg` duruyor. xl altı aside
  alta düşer. Hover: kart etrafında cyan hale yok; cam yansıması (`mentor-campaign-sheen`)
  arka arkaya iki geçiş, döngü yok. `prefers-reduced-motion` süpürmeyi kapatır.
  İlgili: `premium-campaign-banner.tsx`, `panel-shell.tsx`, `theme.css`.

- **Achievement kutlama katmanı (2026-08-18)** — Uygulama kabuğu açılışta ve SSE sonrasında unseen
  başarıları yakalar; canlı başarıları sırayla, backfill'i tek özet olarak gösterir. Kapatma başarılı
  acknowledge sonrasında ilerler; hata halinde yeniden denenebilir. `prefers-reduced-motion` yalnız
  fade kullanır. Final görseller gelene kadar Puhu fallback vardır; yayın öncesi
  `pnpm --filter @mentor/web assets:check:achievements` 12 adet 1024×1024 alfa WebP'yi doğrular.
  İlgili: `notification-drawer-shell.tsx`, `components/achievements/**`.

- **Notification drawer redesign (2026-08-28)** — Çıplak kategori ikonu (daire/dolgu yok),
  okunmadı = kalın başlık + sağda nokta, başlık 2 satır / gövde 1 satır, `Tümü / Okunmamış`
  sekmeleri ve `Bugün / Bu hafta / Daha eski` sticky grupları. Zil, SSE ve swipe aksiyonları
  değişmedi. Detay + gotcha: `docs/features/notifications.md` timeline.

- **Notification drawer + toast token pass (2026-08-18)** — Drawer panel, unread
  rows, and toast cards follow `--color-surface` / `--color-border`. Related:
  `docs/features/notifications.md`.

- **Collapsible desktop sidebar (2026-08-15)** — Desktop AppNav (`lg+`) now
  collapses to a 52px icon rail (analysis history rail width). Expanded stays
  the current 240px labeled sidebar. Top-right `PanelLeft` collapses; the same
  icon at the top of the strip expands. Collapsed chrome: nav icons + theme
  toggle; wordmark, identity, economy, notifications, and language stay in the
  expanded rail. Hover/focus on a rail icon shows the link name. Preference
  persists in the `mentor-sidebar` cookie with a pre-paint bootstrap so reload
  does not flash the wide rail. `/hedef/pano` and community keep the collapsed
  rail (do not hide AppNav); leaving restores the cookie. Usage: any `(app)`
  screen that shows AppNav. Gotcha: content padding is
  `var(--app-sidebar-width)` via `.mentor-app-shell`, not `lg:pl-60`.
  Related: `app-nav.tsx`, `app-sidebar.ts`, `use-app-sidebar.ts`,
  `(app)/layout.tsx`, `[locale]/layout.tsx`, `globals.css`.

- **Mobile AppNav token pass (2026-08-15)** — Mobile top header, floating tab pill,
  active Koç bubble, avatar badge, and economy chips use `--color-surface` /
  `--color-btn` / `--color-btn-label`. Theme toggle sits in the mobile header
  (desktop sidebar already had one). Usage: any `(app)` screen under `lg`.
  Related: `app-nav.tsx`.

- **Knowledge token pass (2026-08-15)** — `/bilgi` hub CTA and article coach/trust
  chrome follow `--color-btn-label` / `--color-surface`. Related:
  `docs/features/content.md`.

- **Onboarding token pass (2026-08-15)** — Wizard card, avatar well, and exam pills
  follow `--color-surface` / `--color-btn-label`. Theme toggle is in the step
  header. Related: `docs/features/identity.md`.

- **Study-session token pass (2026-08-15)** — `/seans` history, buddy field, and
  circular controls follow `--color-surface` / `--color-border`. Related:
  `docs/features/coaching.md`.

- **Hedef panosu keeps collapsed AppNav (2026-08-15)** — `/hedef/pano` no longer
  hides the desktop sidebar. The 52px icon rail stays visible (locked collapsed,
  cookie unchanged) so leaving the editor restores the previous width. Community
  uses the same collapsed-on-entry rail but still allows expand. Mobile
  editor chrome stays full-bleed (no tab bar / header / coach FAB). Usage: open
  the collage editor from `/hedef`. Related: `layout.tsx`, `app-nav.tsx`,
  `app-sidebar.ts`.

- **Notebook keeps mobile app chrome (2026-08-26)** — `/yanlis-defteri` is not
  `hidesMobileAppChrome`; header + tab bar stay. Collage editor and community
  still replace them. Pen FAB stays at the top with due/save under it; pager
  uses the gap above the tab bar. Related: `app-nav.tsx`, `app-sidebar.ts`,
  `layout.tsx`, `notebook-shell.tsx`.

- **Vision-board token pass (2026-08-15)** — `/hedef` map chrome + `/hedef/pano` editor
  chrome follow `--color-surface` / `--color-btn-label`. Canvas stays collage-native.
  Related: `docs/features/coaching.md`.

- **Auth token pass (2026-08-15)** — Auth card, Google well, and soft back-link follow
  `--color-surface` / `--color-border`. Theme toggle is in the card header (no AppNav).
  Related: `docs/features/identity.md`.

- **Analysis token pass (2026-08-15)** — `/analiz` cards, history, and CTAs follow
  `--color-surface` / `--color-btn-label`. Weekly-recap story stays recap-native.
  Related: `docs/features/coaching.md`.

- **Settings token pass (2026-08-15)** — `/ayarlar` hub rows, toggles, and edit surfaces
  follow `--color-surface` / `--color-btn-label`. Appearance pills live in the App card
  (mobile can switch theme here). Related: `docs/features/identity.md`.

- **Coach token pass (2026-08-15)** — `/koc` chat chrome, composer, history, and Puhu
  bubbles follow `--color-surface` / `--color-btn-label`; backdrop uses `--blob-*`.
  Related: `docs/features/coaching.md`.

- **Community leftover chrome tokens (2026-08-18)** — Inner community chips, hovers,
  dividers, and hardcoded light hex now follow `--color-surface` / `--color-soft`.
  Lightbox overlays stay white-on-dark. Related: `docs/features/community.md`.

- **Community token pass (2026-08-15)** — Community workspace stopped re-locking light
  `--color-*` hex. Feed/zone/profile/question surfaces + header/sidebar use theme tokens.
  Theme and notifications live on AppNav. Related:
  `docs/features/community.md`.

- **Plan token pass (2026-08-15)** — Plan calendar/timeline + shared dialog/field primitives
  follow `--color-surface` / `--color-btn-label`. Related: `docs/features/coaching.md`.

- **Panel token pass (2026-08-15)** — First feature surface on the theme tokens: panel cards
  and `@mentor/ui` `Card` use `--color-surface` / `--color-border` so dark charcoal + light
  ink stay paired. Related: `card.tsx`, `panel-shell.tsx`, `docs/features/coaching.md`.

- **Light/dark theme infrastructure (2026-08-15)** — Class-based theme (`html.dark`), cookie
  `mentor-theme=light|dark` (default **light**, no system follow), blocking bootstrap script in
  `[locale]/layout.tsx` so the first paint matches the cookie. Sidebar footer toggle (Sun/Moon)
  next to the language switch; rail uses surface/border tokens and a 200ms color transition
  (`motion-reduce` instant). Usage: desktop sidebar → moon/sun; reload keeps the choice. Gotcha:
  community keeps collapsed `AppNav` (theme lamp stays on the rail); mobile
  `(app)` header now has the same moon/sun; `/ayarlar` has appearance pills.
  Auth and onboarding headers no longer toggle theme. Related:
  `apps/web/src/lib/theme.ts`, `use-theme.ts`, `app-nav.tsx`,
  `packages/ui/src/theme.css`, `DESIGN.md` §2.5.

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
    `const { success, error, warning, info } = useMentorToast();` then
    `success({ title: "…", message: "…", duration: 3000 })`. Leading is the variant status icon
    (override with `leading`); Puhu no longer appears in toasts — see the 2026-08-29 entry above.
    Viewport portals to `document.body`; z-index `100`; mobile 335px top-center, desktop 380px
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

- **Tema lambası — sidebar toggle'ı sahneye dönüştü (2026-08-18)** — Masaüstü sidebar'ın iki
  footer slotundaki sade ikon düğmesi, footer çizgisinden sarkan bir sarkıt lamba ile değişti;
  altında Puhu, ucu toplu çekme ipine uzanıyor. **Koyu tema = yanık durum** (`isLit`): sıcak koni
  ve abajur ağzındaki parıltı yalnız `html.dark` iken boyanır, açık temada abajur mat kalır.
  Sahne iki ip çizer — tavandan abajura giden asma ipi ve tıklamada aşağı düşüp yayla geri
  toparlanan çekme ipi. Puhu dört şeyle tepki verir: imleç sahnenin yakınına gelince ona doğru
  birkaç px yaslanır ve kafasını eğer, bakışını o yöne kırpmanın
  arkasında kaydırır, düğmeye gelince/odaklanınca kanadını ipe uzatır, tıklamadan sonra ışığa
  göre bir an büzülür (koyuya geçiş) veya kabarır (açığa geçiş).
  Bakış alanı boyalı sahne değil: açık panelde `ThemeLampFooter` tüm footer satırını (TR|EN
  dahil) ve üstündeki boş sütunu izler — dil düğmesinin tıklanması çalınmaz, pointer olayları
  kabarcıklanır. Dar rail kendi `trackPadding` halkasını kullanır. Halka padding + negatif
  margin olduğu için layout büyümez; `mt-auto` ayrı bir sarmalayıcıda kalmak zorunda, yoksa
  inline `marginTop` flex'teki alta yapışmayı ezer ve lamba sütunda yukarı kaçar. Merkez
  Puhu'nun kutusudur (`sceneRef`), dock'un değil.
  Boşta 4–7 sn'de bir kırpar; kırpmanın bir kısmı rastgele sağa/sola bakış taşır. Sekme gizliyken
  kırpma yeniden kuyruğa alınır, hiçbir şey ekran dışında oynamaz. **Kullanım:** `<ThemeLamp variant="rail" />` (52px dar sidebar, yalnız lamba)
  ve `<ThemeLampFooter>` (açık panel, Puhu + bakış alanı tüm footer); sade `ThemeToggle`
  auth/onboarding’den kalktı — tema Ayarlar → Görünüm ve sidebar/mobil lambada. Mobil `(app)` başlığı `MobileThemeLamp`
  kullanır: in-flow slot `size-11` (eski güneş/ay ile aynı), sahne header'ın üst kenarına
  hizalanır — abajur 64px barın içinde, Puhu (~48px) alt kenardan içeri sarkar. Dokunma
  hover yerine geçer: basılı tutunca kanat kalkar, bırakınca ip çekilir. Idle kırpma/bakış
  çalışır. Tema `toggleTheme()` ile
  koreografiden **önce** ve koşulsuz çevrilir — animasyon hiçbir zaman sonucu geciktirmez;
  reduced-motion'da tüm hareket sıfırlanır, düğme aynen çalışır. Renkler `--lamp-*` token
  ailesinden gelir (`globals.css`, `.mentor-theme-lamp` scope'u).
  **Gotcha 1:** Puhu beş **tam gövde sprite**'ı (`rest`/`reach`/`blink`/`gazeLeft`/`gazeRight`)
  ile çalışır, kesilmiş katmanlarla değil — görsel üreteci çalıştırmalar arası ortak canvas
  tutamadığı için kanat döndürülmez, göz bebekleri kaydırılmaz, sprite'lar crossfade edilir. Bu
  dosyalar ortak 320px canvas'ı paylaşır ve **tek tek trim edilmemeli**; trim her birini farklı
  kırpar ve geçişte zıplama olur. `reach` kutusu `rest` ile aynıdır, sadece sağda 18px kalkık kanat
  fazlası vardır — bu yüzden `OWL_ART` **duran gövdeyi** ölçer. Bakış değişimi bir kırpmanın
  arkasında yapılır (`setGaze` gözler kapalıyken); aksi halde iki bebek konumu birbirinin içinden
  erir. İmleç sahneye yaklaşınca `gazeFromLean` (histerezis: `GAZE_ENTER`/`GAZE_EXIT`) o yöne
  bakmasını ister; boştayken kırpma ritminin %40'ı rastgele bir bakış taşır ve her bakıştan sonra
  merkeze döner. Gövde ayrıca imlece yaslanır — ±2px kayma **artı ±3° baş eğme** (`computeLean`).
  Eğmenin ekseni `OWL_PIVOT` ile Puhu'nun **ayaklarına** sabitli.
  **Gotcha 2:** Layout *görünür* sanat px'iyle konuşur; `fitArt` görsel kutusunu `OWL_ART` /
  `SHADE_ART` tanımına göre ölçekleyip kaydırır (`owlArtBox` gövdeyi sahne tabanına bastırır,
  `shadeArtBox` abajuru asma ipine hizalar). Sanat yenilenirse **tek yapılacak iş** bu iki sabiti
  `inspect-png.mjs` çıktısından tazelemek — bileşende değişiklik gerekmez.
  **Gotcha 3:** Üretilen görseller magenta (`#FF00FF`) zeminde isteniyor ve `key-alpha.mjs` ile
  şeffaflaştırılıyor; magenta Puhu'nun paletinde yok, siyah zemin denendiğinde göz bebekleri de
  silinmişti.   Boru hattının tamamı ve komutlar `public/mascot/puhu/README.md`'de. `--max=320`
  üç baykuşta da aynı olmalı, yoksa hizalama bozulur. Bir asset **aynı isimle** yenilenirse
  `next/image` önbelleği URL'e göre anahtarlandığı için eskisini servis etmeye devam eder —
  `apps/web/.next/cache/images` silinip sayfa hard refresh edilmeli. Abajurun arkasında açık gri
  bir kare görünmesi tam olarak bu: eski export'un boyalı damalı zemini 44px'e inince düz kareye
  bulanıyordu.
  **Gotcha 4:** Puhu'ya düşen sıcak ışık, `rest` sprite'ıyla `mask-image` üzerinden maskeleniyor;
  maskesiz `soft-light` sidebar zemininde dikdörtgen boyar. Maske hep `rest`'tir — kalkık kanat
  ışığı da beraberinde sürüklemesin diye. İlgili dosyalar:
  `components/theme-lamp/{theme-lamp,lamp-cord}.tsx`,
  `{lamp-choreography,use-lamp-choreography}.ts`, `components/app-nav.tsx`, `app/globals.css`,
  `public/mascot/puhu/lamp/`, `scripts/{key-alpha,inspect-png,to-png}.*`, `e2e/theme.spec.ts`.

- **Achievement Puhu varlıkları tamamlandı (2026-08-20)** — Tasarım kaynakları
  `public/img/achievements/mentor-*-badge.png` altında korunuyor; runtime için 12 sabit achievement
  ID'sine karşılık gelen 1024×1024, alpha kanallı WebP dosyaları
  `public/achievements/puhu/<achievement-id>.webp` altında üretildi. Dönüşüm WebP quality 95 ve
  alpha quality 100 ile yapıldı; `next/image` bu final dosyaları servis ediyor. **Kullanım:** yeni
  görsel aynı ID ile değiştirildiğinde final WebP yeniden üretilmeli ve
  `pnpm --filter @mentor/web assets:check:achievements` çalıştırılmalı. Kontrol 12 dosyanın adını,
  WebP yapısını, 1024×1024 ölçüsünü ve alpha kanalını doğrular. Kaynak PNG'ler palet tabanlı
  şeffaflık (`P` mode + transparency table) taşıdığı için dönüştürmeden önce RGBA'ya açılmalıdır;
  yalnız kanal adına bakmak yanlış biçimde "alpha yok" sonucu verir. İlgili dosyalar:
  `public/img/achievements/`, `public/achievements/puhu/`,
  `scripts/validate-achievement-assets.mjs`, `components/achievements/achievement-art.tsx`.

- **Achievement badge alpha kenarları temizlendi (2026-08-20)** — Kaynak PNG export'larında dış
  çerçevenin altında opak/yarı opak kalmış açık renkli dama pikselleri koyu modal zemininde beyaz
  bir şerit gibi görünüyordu. Runtime'daki 12 WebP, ortak badge silüetini izleyen yumuşak bir alt
  alpha sınırıyla kayıpsız olarak yeniden üretildi; badge içeriği ve krem dış çerçeve korundu.
  **Gotcha:** WebP kalite değerini artırmak bu kusuru çözmez; sorun sıkıştırma değil kaynak alpha
  maskesidir. Yeni export'lar koyu ve açık zemin üzerinde gerçek görüntüleme boyutunda kontrol
  edilmeli, ardından `pnpm --filter @mentor/web assets:check:achievements` çalıştırılmalıdır.
  İlgili dosyalar: `public/img/achievements/`, `public/achievements/puhu/`.

- **Achievement kutlama efekti badge silüetine uyarlandı (2026-08-21)** — Açılıştaki glow ve iki
  aşamalı ışık geçişi kare görsel alanına yayılmak yerine beşgen badge maskesi içinde çalışıyor.
  İlk güçlü geçiş, gecikmeli hafif ikinci geçiş ve reduced-motion davranışı korunuyor. İlgili
  dosyalar: `components/achievements/achievement-celebration.tsx`,
  `lib/achievement-celebration-sequence.ts`.

- **Achievement kutlamasına Puhu ses imzası eklendi (2026-08-21)** — Badge görünürken en fazla bir
  kez çalan, yaklaşık bir saniyelik üç notalı yumuşak Web Audio tınısı eklendi. Modal içi ses
  kontrolü kaldırıldı; tını tarayıcı izin verdiğinde otomatik çalıyor ve sistem/tarayıcı ses
  seviyesiyle birlikte çalışıyor. Çıkış kazancı duyulabilir seviyeye yükseltildi ve üst üste binen
  notaların sertleşmesini önlemek için dinamik sıkıştırıcı eklendi. Tarayıcının autoplay engeli
  veya Web Audio eksikliği görsel kutlamayı etkilemez. Autoplay denemesi engellenirse başarısız
  deneme oynatılmış sayılmaz; kutlama açıkken ilk pointer/klavye etkileşimi AudioContext'i açar ve
  badge görünür durumdaysa tınıyı yeniden dener.
  İlgili dosyalar: `components/achievements/achievement-celebration.tsx`,
  `lib/achievement-sound.ts`, `messages/{tr,en}.json`.

### 2026-08-31 — SEO, route budgets and consent-gated measurement foundation

- Production now requires `NEXT_PUBLIC_SITE_URL` to be a valid HTTPS origin; an absent or invalid
  value fails the build instead of emitting localhost canonicals. Root metadata includes
  `metadataBase`, site identity, Open Graph/Twitter defaults and the existing Puhu asset as the
  fallback share image. Welcome is `noindex, follow`; auth, onboarding, app, room join and cookie
  preferences are `noindex, nofollow`. `robots.txt` allows crawling so route-level directives are
  visible, and advertises the sitemap.
- Root loads only Plus Jakarta Sans. The ten vision-board families moved to the board layout, so
  ordinary public routes preload two font files (48.9 KiB) while the board keeps its intentional 26.
  Client translation payloads are route-scoped: root consent 0.7 KiB, welcome 0.7 KiB, article
  3.6–3.9 KiB; the authenticated app intentionally keeps the full catalog. Dashboard referenced JS
  is 1,236.1 KiB versus the ~1,225 KiB baseline (under 1% change, below the 5% guardrail).
- GA4 continues to load only after local explicit consent; rejection causes no Google script or
  cookieless ping. The typed product map adds email `login`/`sign_up`, tutorial begin/complete,
  plan-valued `begin_checkout` and LCP/INP/CLS/FCP/TTFB `web_vital`. Enhanced Measurement owns SPA
  page views; do not add a second manual `page_view`. Vitals observed before a first acceptance stay
  in memory only and flush after GA initialization; rejection clears them. Checkout values use the
  selected plan's resolved automatic promotion offer. Post-release, verify one page view per route in
  DebugView and register Web Vital parameters as GA4 custom dimensions/metrics.
- Gotcha: run `dev:clean` only after stopping the active dev server; the default `dev` never removes
  another process's manifests. Production build plus the blocking budget script is the artifact gate;
  next-intl Turbopack and middleware deprecation warnings were removed by APP-059.
  Related: `[locale]/layout.tsx`, `(app)/{layout,app-shell}.tsx`,
  `i18n/scoped-messages.ts`, `lib/analytics.ts`, `lib/analytics-consent.tsx`,
  `components/web-vitals-reporter.tsx`, `e2e/{routing,analytics-consent}.spec.ts`.

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
- **Web test sözleşmesi iki katmanlıdır.** `src/**/*.spec.ts` Vitest ile, script sözleşmeleri ise
  Node test runner ile `pnpm --filter @mentor/web test` altında çalışır. Route/browser davranışı
  Playwright E2E'ye aittir; performans eşikleri ayrıca production build sonrası bloklayıcıdır.
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
### 2026-08-20 — Achievement celebration experience

- The celebration blurs the app, plays `/lottie/confetti.lottie` once across the full viewport,
  and reveals the achievement badge at 3.5 seconds while the final ~1.5 seconds of confetti keep
  playing above it. The badge receives a strong glow/light sweep followed by a shorter, lower-
  opacity finishing glint and subtle second glow pulse; neither effect loops. The player is
  lazy-loaded and advances on `complete`; player errors use a bounded fallback so the user is never
  trapped. Reduced-motion users skip confetti and receive a short badge crossfade.
- Related files: `components/achievements/achievement-celebration.tsx`,
  `lib/achievement-celebration-sequence.ts`.

### 2026-08-21 — Achievement celebration companion copy

- Live celebration modals now use achievement-specific TR/EN eyebrow and body copy in Mentor's
  calm companion voice; profile descriptions remain factual so earning conditions stay clear.
- The shared action now reads “Yoluma devam et” / “Continue my journey”. Backfill summary copy is
  unchanged.
- Related files: `components/achievements/achievement-celebration.tsx`, `messages/{tr,en}.json`.

### 2026-08-21 — Achievement mock preview removed

- The dashboard-only achievement preview trigger and its synthetic data were removed. Celebration
  modals are now opened only by the real unseen-achievement API and live SSE flow.
- Related files: `dashboard/_components/panel-shell.tsx`, `lib/notification-drawer-shell.tsx`.

### 2026-08-30 — Public header session consistency

- `PublicChrome` now waits for the silent refresh result instead of briefly presenting an anonymous
  action. Authenticated visitors see a localized dashboard link; anonymous visitors keep the login
  link. This applies to knowledge and legal pages that share the public chrome.
- Related files: `components/public-chrome.tsx`, `knowledge/[slug]/page.tsx`, `legal/[slug]/page.tsx`,
  `messages/{tr,en}.json`, `e2e/knowledge.spec.ts`.

### 2026-09-02 — Puhu-led welcome and route transition

- The first-visit welcome is now a four-scene, manually advanced journey covering Puhu, the coach,
  today's small step, and community. Skip opens the final account choice instead of leaving the
  journey. The intro choreography can be completed immediately and respects reduced motion.
- Desktop auth now uses a Puhu narrative + existing-form split; mobile retains the bottom sheet and
  hanging Puhu. Successful auth sends the sheet upward before navigation. A locale-level cloud
  provider keeps the onboarding completion cover alive across the dashboard or pending-invite route.
- Custom 3D scenes and motion frames are opt-in through `lib/onboarding-assets.ts`; existing Puhu and
  CSS clouds remain safe fallbacks until the complete asset set is delivered. Related:
  `_components/welcome/*`, `(auth)/_components/auth-shell.tsx`, `lib/cloud-transition.tsx`,
  `public/visuals/onboarding/README.md`, `messages/{tr,en}.json`.
