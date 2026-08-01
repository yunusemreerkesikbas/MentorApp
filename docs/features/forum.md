# Forum

> Community Q&A and discussion zones (curated staff creation, scoped membership, flat feed + Q&A +
> moderation + SEO). Module: `modules/forum`. Workstream: W7 (pulled from Phase 2 into MVP).
> Roadmap: MVP slice 1–6 complete; Phase 2 adds verification tiers, coin rewards, C-layer, mahalle, live rooms.

## Overview

The forum is the community surface — a Stack-Overflow-style Q&A zone plus chat/announcement zones,
scoped membership, human-driven moderation, and public SEO for discoverability. It was pulled from
Phase 2 into the MVP behind `forum.enabled` (default off). **No coin in forum** (§4 #3).

## Architecture (key decisions)

- **One `Zone` primitive, three behaviours:** `ANNOUNCEMENT` / `CHAT` / `QA`. Zone type determines
  which features are available (feed vs questions+answers). "Mahalle" is a future config of the same
  model, not a new domain.
- **Two-plane authz** (`forum.policy.ts`): platform role (global override) vs zone role (scoped to one
  zone). Curated zone creation (staff only); external community leaders become zone `OWNER`.
- **Join policies:** `OPEN` → ACTIVE instantly; `REQUEST` → PENDING + `forum.member.requested` event.
- **Flat feed** (`forum_threads`) + QA answers (`forum_posts`) — no nested replies in MVP.
- **XP on accepted answer only** — event `forum.answer.accepted` → `EconomyService.grant` (idempotent,
  uncapped). Forum has no runtime dependency on economy.
- **Full-text search:** Turkish `to_tsvector` expression GIN index on QA questions (title+body).
- **Public SEO:** `@Public` API + SSR QA pages + `QAPage` JSON-LD + sitemap + robots (TR-only index).
- **Moderation:** report → queue → hide/restore/dismiss (append-only audit). No Tier-1 auto-detect yet.

## Tutorials / Guides

```bash
# Enable the feature (admin, per-environment):
PATCH /v1/admin/config/forum.enabled { "value": true }

# Staff creates a curated zone:
POST /v1/forum/zones { "type": "QA", "title": "KPSS Genel", "joinPolicy": "OPEN" }

# User joins + posts + answers + accepts:
POST /v1/forum/zones/:id/join
POST /v1/forum/zones/:id/threads { "title": "...", "body": "..." }
POST /v1/forum/threads/:threadId/answers { "body": "..." }
POST /v1/forum/threads/:threadId/accept/:postId

# Moderation:
POST /v1/forum/reports { "targetType": "THREAD", "targetId": "<uuid>", "reason": "SPAM" }
GET  /v1/forum/zones/:id/reports?status=OPEN
POST /v1/forum/reports/:id/resolve { "action": "HIDE" }

# Run forum tests:
pnpm db:up && pnpm --filter @mentor/api db:migrate
pnpm --filter @mentor/api exec vitest run src/modules/forum test/forum.e2e-spec.ts
```

Web UI: `/topluluk` (zone index, grouped Duyuru/Sohbet/Soru-Cevap). `/topluluk/[slug]` (zone detail
with feed or QA). `/topluluk/[slug]/yonetim` (mod tools — pending members + report queue).
Public SEO: `/[locale]/forum/soru/[id]` (SSR, TR-indexed, JSON-LD).

## API

| Endpoint | Purpose |
|---|---|
| `GET /v1/forum/zones` | List zones (filter by type, examType) |
| `POST /v1/forum/zones` | Create zone (staff) |
| `POST /v1/forum/zones/:id/join` | Join zone (OPEN→ACTIVE, REQUEST→PENDING) |
| `POST /v1/forum/zones/:id/leave` | Self-leave / withdraw pending request (204; OWNER → 409) |
| `GET /v1/forum/zones/:id/members` | List members (owner/mod) |
| `POST /v1/forum/zones/:id/members/:userId/approve` | Approve pending member |
| `GET /v1/forum/zones/:id/members/search?q=` | @mention autocomplete — active-member username prefix search (APP-021) |
| `DELETE /v1/forum/zones/:id/members/:userId` | Reject pending or remove active member (owner/mod/staff; OWNER protected) |
| `POST /v1/forum/zones/:id/threads` | Post thread/ask question |
| `GET /v1/forum/zones/:id/threads` | Cursor feed (pinned first) |
| `POST /v1/forum/threads/:threadId/answers` | Post QA answer |
| `GET /v1/forum/threads/:threadId` | Question detail (q + answers) |
| `GET /v1/forum/threads/:threadId/detail` | CHAT/ANNOUNCEMENT thread + top-level comments |
| `POST /v1/forum/threads/:threadId/comments` | Comment on a CHAT/ANNOUNCEMENT thread |
| `GET/POST /v1/forum/posts/:postId[/replies]` | Comment detail / reply (nested) |
| `PUT/DELETE /v1/forum/posts/:postId/reactions` | Toggle like on a comment |
| `POST /v1/forum/threads/:threadId/accept/:postId` | Accept answer (asker, one-shot) |
| `PUT/DELETE /v1/forum/threads/:threadId/reactions` | Toggle emoji reaction |
| `POST /v1/forum/threads/:threadId/pin` | Pin/unpin thread |
| `POST /v1/forum/attachments/upload-url` | Presigned image upload URL (APP-018) |
| `PUT/DELETE /v1/forum/threads\|posts/:id/bookmark` | Toggle bookmark (APP-018) |
| `GET /v1/forum/bookmarks?before=` | Saved feed — threads + posts interleaved (APP-018) |
| `GET /v1/forum/users/:username/activity?before=` | A user's activity feed (profile, APP-018) |
| `GET /v1/forum/feed/following?before=` | Cross-zone "Akış" — threads by followed users (APP-022) |
| `GET /v1/forum/follow-suggestions` | "Kimi takip et" — active zone authors + cohort fallback (APP-023) |
| `PUT/DELETE /v1/users/:username/follow` | Follow / unfollow a user (identity; APP-022) |
| `GET /v1/users/:username/{followers,following}?before=` | Follower / following lists (identity; APP-022) |
| `POST /v1/internal/cron/cleanup-forum-attachments` | Orphan upload sweep (CronSecretGuard, APP-018) |
| `POST /v1/forum/reports` | Report content |
| `GET /v1/forum/zones/:id/reports` | Room moderation queue |
| `GET /v1/forum/reports` | Platform moderation queue |
| `POST /v1/forum/reports/:id/resolve` | Hide/dismiss report |
| `POST /v1/forum/threads/:threadId/restore` | Restore hidden thread |
| `GET /v1/forum/search?q=` | Full-text search (QA only) |
| `GET /v1/forum/hub` | Discovery hub: featured, continue/new blend, trend tags, supporters, room suggestions |
| `GET /v1/forum/feed?scope=&sort=&tag=&zoneType=&cursor=` | Global relevant/following feed with server ranking and opaque cursor |
| `GET /v1/forum/tags` | Locale-resolved active curated tags |
| `GET /v1/forum/zones/:slug/feed` | Zone metadata + first feed page + contributors + pinned threads in one request |
| `PATCH /v1/forum/threads/:id` · `PATCH /v1/forum/posts/:id` | Owner-only, time/interaction-locked editing |
| `PUT/DELETE /v1/forum/threads\|posts/:id/helpful-vote` | Positive-only QA helpful vote |
| `GET/POST/PATCH /v1/admin/forum/tags` | EDITOR curated tag management (audited) |
| `GET/PUT/DELETE /v1/admin/forum/featured-thread` | Time-bounded manual featured selection (audited) |
| `GET /v1/forum/public/questions/:id` | Public QA (SSR, @Public) |
| `GET /v1/forum/public/questions?limit=` | Public QA refs (sitemap) |

## Geliştirmeler (timeline)

- **Topluluk → AI Koç köprüsü pilotu (2026-07-31)** — CHAT/QA detayları, aktif bir
  `coach_intent` etiketinden deterministik olarak `PLAN > STUDY_METHOD > STRATEGY > NEXT_STEP`
  seçer ve `GET /v1/forum/threads/:id/coach-bridge` üzerinden yalnız oda/tür, kürasyonlu etiket,
  intent ve nullable başlık döndürür. Thread gövdesi, yazar ve yorumlar köprü sözleşmesine girmez.
  `forum.coach_bridge.enabled` varsayılan olarak kapalıdır; admin etiket formu nullable intent yönetir.
  Migration `0063` forward-only’dir. Silinmiş thread/arşivlenmiş oda uygulama politikasıyla da 404
  olur; bu kontrol ayrıcalıklı test DB rolünün RLS’i atlayabildiği durumda özellikle gereklidir.
  İlgili: `forum-coach-bridge.service.ts`, `forum-discovery.controller.ts`, `forum/page.tsx`,
  `0063_absurd_black_bolt.sql`, `packages/{types,validation}/src/forum.ts`.
- **Discovery V2 staging hazırlığı (2026-07-31)** — Featured admin sözleşmesine additive
  `ForumFeaturedAdminView.thread` özeti eklendi; admin UUID alanı yerine mevcut PII-safe
  `/forum/search` endpoint'ini kullanan min-2 karakter/250 ms gecikmeli tartışma seçicisi kullanır.
  Discovery kabulü cold-start, continue+new tamamlama, üç sıralama/filtre/cursor, pasif etiket,
  helpful idempotency/self-vote, edit süresi/etkileşim kilidi, staff yetkisi ve PII-safe arama olarak
  ayrıldı. Yorum, reaksiyon, helpful ve kabul sonrası `last_activity_at` doğrulandı; kabul güncellemesi
  activity alanını aynı thread transaction'ında ilerletir. RLS probe artık `forum_tags`,
  `forum_thread_tags`, `forum_helpful_votes` context/oy izolasyonu ve ADMIN/SERVICE yazımını da kapsar.
  `explain-forum-discovery.sql` rollback içinde 10 bin thread + 10 bin thread-tag ile recent,
  trending, top ve seçici etiket yolunu ölçer. Gotcha: `0061` değişmedi; production flag görsel/staging
  onayından önce açılmaz. İlgili: `forum-discovery.*`, `forum-thread.repository.ts`, admin `forum/page.tsx`,
  `test/{forum,rls-isolation}.e2e-spec.ts`, `scripts/explain-forum-discovery.sql`.
- **Enerjik kampüs UI durum dili (2026-07-31)** — Forum davranışı ve API sözleşmeleri değişmeden
  web yüzeylerindeki seçili/aktif durumlar ortak bir semantik renge bağlandı: CHAT/kapsam/birincil
  aksiyon Mentor mavisi, QA mercan, helpful/accepted yeşil. Answer listesi tekrarlı `Card` bileşenlerinden
  düz divider satırlarına indirildi; accepted cevap yalnız anlamlı yeşil yüzeyle ayrışır. Tekrarlı
  açıklama satırları semantik ikonlara dönüştürüldü ve hover sırasında kontrol büyütme kaldırıldı.
  Ayrıntı:
  [`community.md`](./community.md) ve energetic-campus tasarım kaydı.
- **Discovery V2 web görsel parity (2026-07-31)** — Backend sözleşmeleri değiştirilmeden hub, feed,
  global composer, oda ve detay ekranları beş ürün referansına göre yeniden düzenlendi. Topluluk kendi
  tam ekran shell’ini, arama header’ını ve gruplu oda menüsünü kullanır; feed kartlarındaki bookmark,
  paylaş, capability menüsü, reaksiyon/helpful vote ve attachment davranışı korunur. QA composer’ı
  cevap listesinin üstüne alınarak `içerik → tartışma ekle → cevaplar` sırası kuruldu. Route-scope
  görsel değerler `community-parity.css` içindedir; diğer Mentor ekranlarını etkilemez. Kullanım ve
  dosya haritası için [`community.md`](./community.md) kaydına bakın.
- **Topluluk / Forum Discovery V2 (2026-07-31)** — Çalışan Zone/üyelik/thread/post/moderasyon
  altyapısı korunarak keşif katmanı eklendi. Migration `0061`: kürasyonlu `forum_tags`,
  max-3 `forum_thread_tags`, pozitif-only `forum_helpful_votes`, `last_activity_at`, edit ve
  süreli featured alanları; RLS, indeksler, last-activity trigger'ları ve başlangıç TR/EN etiketleri.
  `ForumDiscoveryService/Repository` hub, relevant/following global feed, trending/recent/top
  sıralaması, v1 opaque cursor, public-safe arama, oda birleşik ilk yüklemesi ve admin featured/tag
  akışını N+1'siz üretir. Skor/edit pencereleri config registry'dedir; frontend skor hesaplamaz.
  Edit yalnız içerik sahibine 30 dk içinde ve etkileşim yokken açıktır; bookmark kilitlemez,
  moderatör metni değiştiremez. QA helpful vote kendi içeriğine verilemez ve idempotenttir.
  Eski endpoint'ler additive korunur; `forum.enabled=false` 404 davranışı değişmez.
  Kullanım: önce migration/API, sonra staging query smoke, en son web/admin flag rollout.
  Gotcha: migration forward-only; geri alma flag ile. Yüksek hacim kontrolü
  `apps/api/scripts/explain-forum-discovery.sql` (10k geçici satır, transaction rollback) ile
  discovery activity indeksini doğrular. İlgili: `forum-discovery.*`, `forum.dto.ts`,
  `0061_lovely_retro_girl.sql`, `packages/{types,validation}/src/forum.ts`,
  `test/forum.e2e-spec.ts`.
- **KVKK silme: forum redaksiyonu (WP-K, 2026-07-22)** — Hesap silmede kullanıcının thread'leri
  (title+body) ve postları (body) `"[silinmiş içerik]"` sabitiyle **yerinde redakte** edilir (satır
  durur — başkalarının sohbeti ve kabul edilmiş cevap işareti bozulmaz); reaksiyon, bookmark, zone
  üyeliği, rapor (reporter) ve ekler hard delete (storage objeleri best-effort, tx sonrası).
  `ForumErasureRepository` tek SERVICE-ctx tx; `ForumErasureService` `AccountErasureService`
  zincirinde. Gotcha: sabit i18n DEĞİL — ham DB değeri; görüntü katmanı zaten "Silinmiş Kullanıcı"
  gösteriyor. Related: `forum-erasure.repository.ts`, `forum-erasure.service.ts`,
  `test/account-erasure.e2e-spec.ts`.
- **Flip blocker'ları + QA public paylaşım (WP-J, 2026-07-20)** — Forum'un `forum.enabled` flip'ini
  bekleyen iki operasyonel boşluk kapandı, biri de büyüme dilimi:
  (1) **Zone seed** — `ForumZoneSeedService` boot'ta `zones.seed.json`'daki iki launch odasını
  (`genel-sohbet` CHAT + `soru-cevap` QA, OPEN) sabit slug + `onConflictDoNothing` ile idempotent
  ekler, `createdBy: null` (kolon nullable → boot'ta staff user aranmaz). Flag'den bağımsız yazılır;
  böylece `/topluluk` (ilk CHAT zone'una redirect eden yönlendirici) flip gününde çıkmaz sokak olmaz.
  `nest-cli.json` assets'e `modules/forum/seed/**/*` eklendi (JSON'un dist'e kopyalanması için).
  (2) **Orphan sweep kendi koşuyor** — `ForumMaintenanceService` 6 saatlik in-process timer
  (JobRunner emsali, `unref`, reentrancy guard, flag guard, hata yutma). Repo'da IaC yok; artık
  "Render Cron'a kaydetmeyi unutma" hata sınıfı ortadan kalktı, HTTP endpoint manuel override kaldı.
  (3) **QA public paylaşım** — `SendButton` opsiyonel `publicUrl`; `question-shell` cevaplı sorularda
  `questionUrl(id)` geçer (soru kartı + cevap öğeleri), cevapsızda in-app link kalır
  (`ForumPublicService` ≥1 cevap şartı; erken paylaşım 404 verirdi). Dosyalar:
  `forum-zone-seed.service.ts`, `forum-maintenance.service.ts`, `forum-zone.repository.ts`,
  `send-button.tsx`, `question-shell.tsx`, `answer-item.tsx`.
- **Gönüllü ayrılma + üyelik yönetimi uzlaşısı (2026-07-20)** — Üyelik durum makinesindeki son
  boşluk kapandı: `POST /v1/forum/zones/:id/leave` (self-scoped, 204) — ACTIVE üye ayrılır, PENDING
  istek sahibi isteğini geri çeker (aynı delete); üyelik yoksa no-op (idempotent, `join` emsali);
  OWNER → 409 `FORUM_OWNER_CANNOT_LEAVE` (oda sahipsiz kalamaz; devir backlog). Policy:
  `canLeaveZone` (`forum.policy.ts`). Web: zone header'daki `JoinButton` artık katıl/ayrıl/geri-çek
  toggle'ı — ACTIVE'de "Ayrıl" (REQUEST zone'larda `useDialog().confirm` onayı, OPEN'da doğrudan),
  PENDING'de bekleme notu + "İsteği geri çek", OWNER'da gizli. e2e kapsamı genişledi: reject
  (`{approve:false}`), kick (staff DELETE, self-DELETE 403 kalır) ve leave akışları artık test
  ediliyor (27/27). Bayat backlog notları düzeltildi: reject/kick zaten APP-017 (backend) +
  APP-026 (web) ile shipped'dı; OpenAPI şemasızlığı bilinçli erteleme olarak dokümante edildi.
- **Localized forum/community links (2026-07-19)** — Public question source routes now use
  `forum/question/[id]` while Turkish stays `/forum/soru/[id]`; community dynamic links use typed
  `pathname/params/query` objects. Share URLs are localized through `getPathname`. Untranslated
  English public questions stay `noindex,follow` with a prefixes-free Turkish canonical. Related:
  public question page, `forum-public.ts`, community `send-button.tsx`, `routing.spec.ts`.
- **Self-accept XP farm kapatıldı (2026-07-18)** — `canAcceptAnswer(actor, questionAuthorId,
  answerAuthorId)`: soran kişi KENDİ cevabını kabul edemez (thread başına 25 XP self-farm vektörü).
  `accept()` post'u önce fetch edip policy'ye cevap yazarını da geçirir; web soru ekranı kendi
  cevabında kabul butonunu göstermez. Dış davranış değişikliği: soran-olmayan probé artık 403 yerine
  404 alabilir (post fetch öne alındı — bilgi sızıntısı açısından daha iyi).
- **Dosya ekleri — PDF + Office (APP-027)** — Forum ekleri artık **görsel + dosya** taşıyor (görsel altyapısı
  genelleştirildi). Türler: `application/pdf` + modern OOXML (docx/xlsx/pptx; legacy .doc/.xls/.ppt hariç),
  **10MB/dosya**, mevcut **birleşik 4-ek limiti** (görsel 5MB / dosya 10MB, sunucu-uygulamalı). Migration
  `0043`: `forum_attachments.file_name` (nullable, yalnız `kind='file'`). `Attachment` tipine `fileName` +
  `sizeBytes` + `AttachmentKind.FILE`; `attachment.constants` `FORUM_FILE_MIME`/`FORUM_FILE_MAX_BYTES`/
  `extensionForForumFileMime` + key regex dosya uzantılarını kapsar; validation `attachmentUploadUrlSchema`/
  `attachmentInputSchema` mime allowlist'i `FORUM_ATTACHMENT_MIMES`'e genişledi + `fileName`. **`resolveForumAttachments`
  genelleştirildi:** mime'a göre `kind` (image/file) + doğru per-kind boyut cap + fileName. `createAttachmentUploadUrl`
  görsel VEYA dosya content-type'ı doğru uzantıyla mint eder. Fake storage controller + main.ts express.raw dosya
  mime'larını + 10MB'ı kabul eder (asıl per-kind cap `resolveForumAttachments`'ta). **Güvenlik:** content-type
  presigned upload'ta allowlist'e sabit (inline-HTML riski yok) + key own-prefix regex; dosya indirilir, yürütülmez.
  Web: birleşik picker (`useForumImagePicker` görsel+dosya, tek liste + birleşik limit, `uploadForumFile`),
  paylaşılan `AttachmentPreviewStrip` (thumb + dosya-chip; ThreadComposer + ForumImagePicker ortak), gallery
  dosyaları **indirme chip'i** (ikon + `fileName` + boyut + güvenli dış link) olarak ayırır. i18n: `attach`/
  `attach_file`/`attach_file_too_large` + genelleşen mesajlar. Testler: forum e2e +1 (PDF upload→post→detay
  `kind=file`+fileName+sizeBytes; izin-dışı tür 400), qa-spec spoof-mime `application/zip`'e güncellendi;
  forum unit 78, e2e 25/25. **Kapsam dışı**: legacy Office, inline PDF/Office önizleme, magic-byte sniff, video. *(APP-027)*
- **Toparlama & CI yeşili + zone "X mesaj" sayacı (APP-026)** — Stabilizasyon slice'ı. (1) **APP-025 kapatma:**
  `reaction-bar` palet butonlarından geçersiz `aria-pressed` (role=menuitem) kaldırıldı; full forum e2e
  regresyonsuz. (2) **CI yeşili:** `apps/web` lint 7 error → 0 (`"lint": "eslint"`, `--max-warnings` yok →
  yalnız error bloklar). 7 error yeni katı react-hooks kurallarından (`set-state-in-effect` ×6 + `immutability`
  ×1), `analiz/panel/plan`'da (başka iş kalemlerinin WIP'i). **Hedefli yaklaşım:** `plan-shell` `readError`
  modül seviyesine taşındı (before-declare fix) + 6 `set-state-in-effect` **gerekçeli `eslint-disable`** ile
  bastırıldı (bilinçli prop→state senkronu / SSR-güvenli localStorage / fetch tetikleyici — davranış
  değişmedi, mantık yeniden yazılmadı). (3) **Loose-end — zone "X mesaj" sayacı:** `ZoneView.threadCount`
  (types) + `ForumZoneRepository.threadCountsByZone` (`memberCountsByZone` deseni: non-deleted COUNT, GROUP BY
  zone, service-context, N+1 yok) + `ForumService.listZones`/`getZone`/`createZone` assembly + web
  `zone-sidebar` "X üye · Y mesaj" (i18n `messages_count`). Testler: forum unit 78, e2e zone-list'e threadCount
  assertion (24/24). **QA-public Send ertelendi** (indexability sinyali gerektirir — backlog). Orphan-cron
  kaydı hâlâ ops (Gotchas'ta belgeli). *(APP-026)*
- **Zengin emoji reaksiyon paleti — thread + yorum (APP-025)** — Like tek kalpten (APP-017'de daraltılmıştı)
  **pozitif/destek emoji paletine** çevrildi (`FORUM_REACTION_EMOJIS = ["❤️","👍","💪","🎉","🙏"]`; §4
  anti-shaming — negatif emoji yok; tunable sabit, runtime flag yok). Kullanıcı başına **çoklu reaksiyon**
  (her emoji bağımsız toggle). **Migration yok** (`forum_reactions` + `forum_post_reactions` zaten emoji
  tutuyor). Thread altyapısı zaten çoklu-emoji'ydi; **yorumlar tek-like'tan (`likeCount`/`myLiked`) palete
  taşındı**: `CommentView` → `reactionCounts`/`myReactions` (ThreadView ile aynı); `ForumPostRepository`
  `likeCountsByPost`/`myLikedPosts` → **`reactionCountsByPost`/`myReactionsByPost`** (thread aggregate desenini
  aynalar); `postRowToCommentView` + `decorateComments` reaksiyon lookup'larına geçti; servis
  `likePost/unlikePost` → **`reactPost/unreactPost(emoji)`**; `PUT/DELETE /posts/:id/reactions` artık emoji
  body alır (`ReactionDto`, thread'le aynı; allowlist `z.enum` → izin-dışı emoji 400). Web: paylaşılan
  **`ReactionBar`** (picker popover — Esc/click-dışı kapanır + ilk öğeye focus — + gruplu emoji-chip'leri;
  `stopPropagation` ile satır navigasyonunu kırmaz) hem `ThreadItem` hem `CommentRow`/`FocusedComment`'te.
  Optimistic toggle tek yere (`lib/forum-reactions.ts` `toggleReaction<T>` — ThreadView & CommentView aynı
  şekil) çıkarıldı; 6 shell'in tekrarlı yerel `applyReaction`/`applyCommentLike` kopyaları silindi. i18n:
  `reaction_add`. Testler: `forum-thread.service.spec` (yorum react/unreact emoji), forum e2e (thread'e 2
  emoji + gruplu sayım + yoruma emoji + izin-dışı 400). **Kapsam dışı**: QA cevabına reaksiyon, "kimler tepki
  verdi" listesi, reaksiyon bildirimi. *(APP-025)*
- **Follow discovery — "Kimi takip et" + follow-back (APP-023)** — Takip grafını dolduran discovery
  (APP-022'nin eksik yarısı: yeni kullanıcı kimseyi takip etmiyor → Akış boştu). **Öneri kaynağı = üyesi
  olunan zone'larda aktif kişiler** (forum-native, bağlamsal — Akış'ta zaten göreceğin insanlar), soğuk
  başlangıçta **cohort fallback** (aynı sınav tipi). Yeni `ForumThreadRepository.suggestAuthorsInMemberZones`
  (`recentCommentersByThread` deseni: SERVICE-context + `selectDistinctOn(authorId)`; `forum_threads` →
  `forum_zone_members` INNER JOIN [`userId=viewer`, `status=ACTIVE`] → `users`; `deletedAt IS NULL`,
  `username IS NOT NULL`, `notInArray(authorId, excludeIds)`; JS'te recency sort + slice — viewer'ın kendi
  zone'larına scope'lu, sızma yok) + `UsersRepository.suggestCohortPeers` (identity: recent ACTIVE +
  username + examType cohort, excludeIds hariç) + `UsersService.suggestCohortPeers` (viewer examType'ını
  çözer). `ForumThreadService.getFollowSuggestions(viewerId, limit=10)`: `excludeIds=[self,
  ...getFolloweeIds]` → primary → eksikse fallback (primary id'leri de excludeIds'e) → `FollowUserRef[]`
  (`isFollowing:false`, avatar storage URL). **Mimari:** endpoint forum'da (zone üyeliği + thread yazarları
  forum'un; forum zaten FollowService + UsersService import ediyor → forward-dep, döngüsüz). Endpoint:
  `GET /v1/forum/follow-suggestions` → `FollowUserRef[]` (bare array). Web: paylaşılan **`FollowButton`**
  (optimistic, failure-safe toggle — `topluluk/_components/`), **`FollowSuggestions`** (Akış'ta feed üstünde;
  boşsa kendini gizler; takip → `onFollowed` ile feed refetch — kart yerinde kalır, server sonraki ziyarette
  düşürür), **follow-back butonu** takipçi/takip listelerine (`FollowListPanel` satırı yeniden yapılandırıldı:
  `<Link>` yalnız avatar+ad'ı sarar, buton **kardeş** — anchor-içinde-button geçersizliğini önler; kendi
  satırında gizli). lib: `follow.getFollowSuggestions`. i18n: `suggestions_title`. Testler: `getFollowSuggestions`
  unit +2 (primary+fallback merge/exclude; fallback-atlama), forum e2e +1 (öneriler zone yazarlarını verir,
  self hariç; takip sonrası düşer). **Kapsam dışı** (backlog): profil kartı sayaçları (düşük ROI — getMe hot
  path), gelişmiş skorlama (ortak-zone/karşılıklılık), öneri kartı kapatma. *(APP-023)*
- **Takip (follow) + kişiselleştirilmiş "Akış" feed'i (APP-022)** — Profil sayfaları artık read-only
  değil: tek yönlü, herkese açık, anında **takip sistemi** + zone-üstü **Akış** feed'i. **Takip grafı
  `identity`'de** (`user_follows`, `forum_bookmarks` desenini aynalar — `0041`; SERVICE-context + WHERE
  scope, ayrı RLS yok). **Mimari kısıt:** graf community'de olamazdı (community→forum importu var → Akış
  için forum→community = döngü); `identity` kimseye bağlı değil, forum/community tüketici. `FollowService`
  (self-follow reddi `SOCIAL_CANNOT_FOLLOW_SELF` 400, banlı/olmayan hedef 404, follow→`identity.user.followed`
  event; unfollow sessiz) + `FollowRepository` (idempotent toggle, sayaçlar okuma-anında COUNT,
  `getFolloweeIds`, takipçi/takip listeleri users INNER JOIN + viewer'ın `isFollowing`'i tek sorguda EXISTS,
  banlı hariç). Endpoint'ler identity'de: `PUT/DELETE /v1/users/:username/follow`, `GET
  /v1/users/:username/{followers,following}?before=` (cursor). `community.getPublicProfile` artık `viewerId`
  alıp `followerCount`/`followingCount`/`isFollowing`'i FollowService'ten okur (self → false). **Akış feed'i
  (yalnız thread'ler):** `ForumThreadRepository.listByAuthorIds` (`listByAuthor`'ın `inArray` genellemesi;
  `withUserContext` RLS viewer'ın göremeyeceği zone/silinmiş thread'leri eler → gizlilik ücretsiz),
  `ForumThreadService.getFollowingFeed` (followee ids boşsa erken `[]`; `buildThreadViews` batched lookup'ları
  reuse), `GET /v1/forum/feed/following?before=`. **Bildirim:** yeni `IdentityEventsListener` (notifications)
  `@OnEvent("identity.user.followed")` → "Yeni takipçi · <ad> seni takip etti" in-app (kategori **FORUM**
  reuse, link takipçi profiline; handle yoksa linksiz; best-effort). Web: profil header'a **Takip Et/Bırak**
  (optimistic, kendi profilinde gizli) + tıklanabilir **takipçi/takip sayaçları** → header altında `FollowListPanel`
  (geri-butonlu liste, cursor); yeni **`/topluluk/akis`** sayfası (`AkisShell` — ThreadItem reuse, optimistic
  like/bookmark, davetkâr boş durum) + sol sidebar'da zone gruplarının **üstünde** "Akış" girişi (`Rss`). lib:
  `follow.ts` + `forum.getFollowingFeed`. Tipler: `PublicProfile` + `followerCount/followingCount/isFollowing`,
  yeni `FollowUserRef`/`FollowList`. i18n: `follow`/`following_state`/`followers_label`/`following_label`/
  `followers_title`/`following_title`/`follow_list_empty`/`feed_nav`/`following_feed_empty`. Testler: FollowService
  unit +7 (follow/event, self-follow 400, 404, unfollow no-op, liste map/drop/404), IdentityEventsListener +3
  (link/linksiz/best-effort), forum e2e +1 (A→B takip → profil isFollowing+sayaç → Akış B'yi gösterir C'yi
  göstermez → bildirim → self-follow 400 → unfollow → feed düşer). **Kapsam dışı** (backlog): "kimi takip et"
  önerileri, feed satırında inline takip butonu, thread+yorum merge'li akış, karşılıklı/engelleme/private,
  takip için web push, denormalize sayaç. *(APP-022)*
- **@Mention composer autocomplete (APP-021)** — Composer'da `@` + ≥1 karakter yazınca **o zone'un
  AKTİF üyelerinden** username-prefix eşleşenleri dropdown'da önerir (APP-018'in kapsam-dışı bıraktığı
  parça; mention hikâyesi kapandı). **Kaynak = zone üyeleri** (privacy: yalnız üyesi olunan zone'un
  üyeleri listelenir; mention *çözümü* backend'de global kalır). Backend: `GET /zones/:id/members/search?q=`
  (`memberSearchQuerySchema` — q 1–24, handle-charset → LIKE escape gerekmez), yeni policy
  `canSearchMembers` (**üyelik bazlı**, post değil — ANNOUNCEMENT üyesi de mention edebilir; ACTIVE üye
  veya mod/staff), `ForumZoneRepository.searchActiveMembers` (members×users INNER JOIN, `username IS NOT
  NULL`, prefix LIKE, LIMIT 8, username ASC), `ForumService.searchMembers` (zone 404 → policy 403 →
  `MentionSuggestion[]`; StoragePort ile avatar URL — ForumService'e ilk kez inject edildi).
  **`CommentDetail.zoneId` eklendi** — `requirePost` zaten parent thread'i yüklüyordu, ekstra sorgu yok
  (yanıt composer'ının zone bağlamı). Web: saf `getActiveMentionToken` (caret-anchored token; `email@x`
  tetiklemez), `useMentionAutocomplete` hook'u (200ms debounce, prefix→sonuç cache — **state'te stable
  Map + version tick**, ref-during-render/set-state-in-effect lint'lerine takılmaz; stale-guard; hata/boş
  → sessiz kapanış), `MentionSuggestions` listbox (textarea altında, caret-anchored DEĞİL — ponytail;
  ↑↓/Enter/Tab/Esc, ARIA combobox + `aria-activedescendant`, mousedown-select ile focus korunur).
  Entegrasyon 5 yüzey: `ThreadComposer` (**opsiyonel** `zoneId` prop — zone-shell/message-shell/
  comment-shell geçirir), `AskComposer`, QA `AnswerComposer` (`question.zoneId` prop'a eklendi).
  Ctrl/Cmd+Enter gönderimi dropdown açıkken de çalışır (yalnız düz Enter öneri seçer). i18n:
  `mention_suggestions_label`. Testler: policy +2, servis +4 (403/404/avatar-map/staff), e2e +1
  (üye arar-bulur, üye-olmayan 403) — forum unit 76, e2e 22/22. **Kapsam dışı**: fuzzy/displayName
  arama, boş-@ önerisi, caret-anchored popup. *(APP-021)*
- **Profil/topluluk UX loose-ends + profil rotası yeniden adlandırıldı (APP-020)** — yedi rötuş:
  (1) Sağ kolon `ProfileCard` artık kendi topluluk profiline **tıklanabilir** link (username yoksa düz).
  (2) **Kaydedilenler** sol sidebar'dan çıkarıldı; kendi profilinde **sekme** oldu (`[Gönderiler |
  Kaydedilenler]`, saved sekmesi yalnız kendi profilinde). `SavedShell` `embedded` prop'u aldı → profil
  sekmesinde `<main>`/başlık olmadan yeniden kullanılıyor (bookmark mantığı tek yerde). (3) `/profil`
  (hesap sayfası) → `/topluluk/uye/[me]` **çapraz link** ("Topluluk profilim"); iki sayfa ayrı amaç,
  üçüncü profil yok. (4) Profil feed'inde bir **yanıta** tıklayınca artık kendi izole detayına değil,
  **ebeveyn post'a** gidiliyor ve yanıt `?highlight=` ile vurgulanıp scroll'lanıyor (`CommentRow`
  `rowHref`+`highlighted` prop'ları; `message-shell`/`comment-shell` `useSearchParams` ile highlight
  okuyor). (5) Post detayında **kompozer** her zaman postun hemen altında (yanıtlardan önce). (6) Boş
  durumdaki "Henüz yorum/yanıt yok" blokları kaldırıldı (altta kompozer zaten CTA). (7) Profil rotası
  `/topluluk/u/[username]` → **`/topluluk/uye/[username]`** (anlamlı TR segment; `topluluk` prefix'i
  korundu — profil topluluk 3-kolon shell'inde render oluyor). `AuthorLink`/`MentionText`/`HideCompanion`
  + dizin taşındı. Kaldırılan i18n: `comments_empty*`/`replies_empty*`; eklenen: `profile_tab_posts`,
  `profile.community_profile_link`. *(APP-020)*
- **Kullanıcı forum profili + tıklanabilir yazar/@mention (APP-018)** — `/topluluk/uye/[username]`:
  public-safe profil başlığı (kimlik + oyunlaştırma) + kişinin **karışık aktivite feed'i** (thread +
  yorum/cevap). **İki endpoint** (community→forum cycle'ından kaçınmak için): `GET /community/profile/
  :username` (`CommunityService.getPublicProfile` — `getSummary`'nin özü, leaderboard hariç + public
  kimlik; **email/PII YOK**; banlı/olmayan → 404) ve `GET /forum/users/:username/activity?before=`
  (`ForumThreadService.getUserActivity` — repo `listByAuthor` thread+post, merge+createdAt-desc+cursor;
  viewer state ile → profilden beğeni/kaydet yapılabilir). Username çözümü identity'de
  (`UsersService.findByUsername`). Tipler: `PublicProfile` (community), `ForumActivityFeed` (forum,
  `SavedFeedItem` reuse). **Tıklanabilirlik**: `MentionText` @handle artık `Link`
  (`/topluluk/uye/{handle}`); yeni `AuthorLink` (username yoksa düz metin, feed satırında
  `stopPropagation`) yazar isim+avatarını sarıyor (`thread-item`/`comment-row`/`comment-shell`).
  Frontend: `profile-shell` (saved-shell deseni; bookmark listeden düşürmez, patch'ler) + `profile-header`
  (`StatSnapshot`+`BadgeStrip` reuse). i18n: `profile_not_found`/`profile_activity_empty`. Testler:
  `getUserActivity` (merge/sort/cursor + 404), e2e (aktivite feed + profil email'siz + 404). **Kapsam
  dışı**: takip/bio, profil düzenleme, replier-cluster linkleri, SEO-public. *(APP-018)*
- **Profil UI rötuş — impeccable/product register (APP-018)** — (1) Profil başlığı büyük **hero-metric
  stat kartlarından** (PRODUCT.md'nin yasakladığı desen; sağ efor-panosuyla yinelenme) **kompakt satır-içi
  stat rayı**na çevrildi (avatar 72, ince seviye çubuğu, geri-link). (2) `HideOnRanking` → `HideCompanion`:
  sağ efor-panosu artık `/topluluk/uye/*` profillerinde de gizlenir (kendi profilinde kimlik iki kez
  belirmesin). (3) Aktivite feed'inde **zone bağlamı**: `listByAuthor` (thread + post, post 2-hop join)
  `zoneTitle`/`zoneSlug` taşır → yeni `ForumActivityItem` (`SavedFeedItem & { zone }`); her öğe üstünde
  linkli zone etiketi (subreddit-adı deseni). *(APP-018)*
- **@Mention — kullanıcı etiketleme + bildirim (APP-018)** — Post/yorum/cevap gövdesinde `@kullanıcı`
  etiketlenince o kişiye in-app bildirim gider ve @handle gövdede vurgulanır. **Tablosuz** — mention'lar
  gövdedeki @token'lardan türetilir (migration yok). `forum/domain/mention.ts` `extractMentions`
  (`@[a-z0-9_]{3,24}`, kelime-içine gömülü değil, uniq, cap **10**). Yeni `ForumMentionService` (create'te
  `dispatch(body, actor, link, exclude[])` → `UsersService.findIdsByUsernames` ile çözer → çözülen her
  gerçek kullanıcıya `USER_MENTIONED` emit; **best-effort** try/catch+log, `void` ile fire-and-forget,
  post'u asla kırmaz). Mimari: username→id çözümü **identity'de** (`UsersService.findIdsByUsernames`,
  `IdentityModule` forum'a import edildi) — forum `users` tablosunu doğrudan sorgulamıyor. Emit noktaları:
  `postThread`/`comment`/`replyToComment`/`answer`; her biri **exclude** ile parent-yazarını atlar
  (yorum/yanıt bildirimini zaten alan kişiye çift bildirim yok) + öz-mention listener'da atlanır.
  `ForumEventsListener.onUserMentioned` → "Sizden bahsedildi" FORUM bildirimi (link yüzeye göre payload'da).
  Web: `MentionText` (lookbehind'sız, cross-browser regex; @handle'ı accent renkte vurgular, **link değil**
  — profil sayfası backlog) tüm gövde render'larında (thread-item/comment-row/answer-item/question/comment
  shell). **Kapsam dışı**: composer autocomplete, tıklanabilir profil linki, `forum_mentions` tablosu.
  Testler: `extractMentions` + `ForumMentionService` (resolve/exclude/hata-yutma) + listener + servis
  wiring assertion'ı + e2e (@mention → bildirim). *(APP-018)*
- **Forum bildirimleri (in-app, APP-018)** — Forum etkileşimleri artık kişiye özel gerçek-zamanlı
  in-app bildirim üretiyor (mevcut SSE zil + `/bildirimler` gelen kutusu). 5 tetikleyici: soruna cevap
  (`question.answered` — soran), thread'e yorum (`thread.commented` — yazar), yoruma yanıt
  (`comment.replied` — yorum yazarı), cevap kabul (`answer.accepted` — cevaplayan), zone'a katılım isteği
  (`member.requested` — owner/mod). **Migration yok** (`user_notifications.category` text; enum'a `FORUM`
  eklendi). Forum yeni event'leri emit ediyor (recipient + link alanları **domain'de çözülüyor** →
  notifications forum'a coupling'siz); yeni `ForumEventsListener` (notifications) `@OnEvent` × 5 →
  `createInApp(recipientId, "FORUM", …)`, best-effort, **öz-bildirim atlanır** (actor===recipient).
  `member.requested` owner/mod'lara fan-out (`ForumZoneRepository.listOwnerAndMods`, payload'da
  `moderatorIds`+`slug`). Reply/cevap **event-başına** (coaching'deki günlük dedup YOK). Web:
  `notification-drawer-shell` kategori map'lerine `FORUM` (MessageCircle ikon, fallback `/topluluk`).
  Jenerik metin (aktör adı yok → ekstra sorgu yok). Testler: `forum-events.listener.spec` (6: her
  handler + öz-bildirim + fan-out), servis emit assertion'ları, e2e (join-request → owner bildirilir;
  throttle-güvenli, thread POST'suz). **Kapsam dışı**: @mention, web push fan-out, gruplama,
  kişiselleştirilmiş isim. Detay: [`notifications.md`](./notifications.md). *(APP-018)*
- **Send (paylaş) + Bookmark (kaydet) — Twitter/Threads (APP-018)** — Aksiyon satırına iki yeni ikon:
  **Send** postu paylaşılabilir bağlantı olarak paylaşır (`navigator.share` native sheet, yoksa panoya
  kopyala + toast; backend yok — link uygulama-içi detay rotası), **Bookmark** postu kişiye özel kaydeder.
  **Bookmark polimorfik** (thread + post): yeni `forum_bookmarks` (`0037`, unique `user_id+target`,
  `myReactionsByThread` desenli batch `myBookmarkedTargets`). `ThreadView`/`CommentView`/`AnswerView`'a
  `myBookmarked` (feed/detay/QA/search'e 6. batched lookup — N+1 yok). Toggle uçları reaction desenini
  aynalar: `PUT/DELETE /threads|posts/:id/bookmark`. Kaydedilenler: `GET /forum/bookmarks` (thread+post
  karışık, kaydetme sırası, cursor) → `SavedFeed` discriminated union; servis `findManyByIds` (yeni,
  RLS-görünür çoğul fetch) ile çözer, silinmiş/gizli hedef sessizce düşer. Web: paylaşılan `SendButton`
  (locale-aware URL — `as-needed` prefix) + `BookmarkButton` (optimistic) 5 yüzeyde (feed thread-item,
  message/comment/question detay, answer-item); sol sidebar + mobil drawer'a "Kaydedilenler" girişi;
  `/topluluk/kayitli` sayfası (`SavedShell` — unsave'de listeden düşer). Yeni i18n: `send`/`share_copied`/
  `bookmark`/`saved_*`. Testler: unit +2 (bookmark toggle + getMyBookmarks sıra/drop), e2e +1
  (thread+post kaydet → saved feed → unsave). *(APP-018)*
- **Ek orphan-cleanup + lightbox carousel (Faz 2, APP-018)** — İki bağımsız iyileştirme.
  **Orphan-cleanup**: presigned upload objeyi post oluşmadan **önce** storage'a yazdığından, create hiç
  gelmezse (client vazgeçer / upload sonrası create reddi) obje öksüz kalıyordu. Storage'da LIST yok;
  bu yüzden yeni **`forum_pending_attachments`** ledger tablosu (`0036`) — mint edilen her key kaydedilir,
  `insertMany` ek'e bağlanınca aynı tx'te siler; grace (24s) geçmiş satırları bir cron süpürür
  (`storage.deleteObject` + satır silme, tur başına 500 cap). Endpoint:
  `POST /internal/cron/cleanup-forum-attachments` (yeni `ForumInternalController`, `CronSecretGuard`).
  Guard `notifications/presentation`'dan **`common/auth/`**'a taşındı (cross-cutting; notifications + forum
  paylaşıyor). **Carousel**: `AttachmentGallery` lightbox'ı tek görselden **çoklu-görsel gezinmeye**
  çevrildi — prev/next ok + klavye (←/→/Esc) + swipe + nokta göstergesi (`prefers`... yok, saf state).
  Yeni i18n: `attach_prev`/`attach_next`. Testler: `forum-thread.service.spec` +2 (markPending-on-upload
  + sweep), toplam unit 61. E2E dokunulmadı (mevcut attachment e2e insertMany'nin yeni delete-pending
  SQL'ini gerçek DB'de zaten çalıştırıyor → 16/16). Video + dosya hâlâ ertelenmiş. *(APP-018)*
- **QA ekleri — görsel (Faz 2, APP-018)** — Görsel eklerini **QA soru + cevaplarına** genişletti
  (Faz 1 yalnızca CHAT/ANNOUNCEMENT'a açmıştı). **Şema/migration yok** — mevcut `forum_attachments`
  (polimorfik THREAD|POST) yeniden kullanıldı. QA, CHAT'ten ayrı servis/tip/composer kullandığı için
  yol baştan sona kablolandı: `ForumThreadService`'in QA-soru guard'ı kaldırıldı (`postThread` artık
  QA sorusuna da ek yazıyor); `ForumQaService`'e `ForumAttachmentRepository` inject edildi, `answer()`
  ek çözüp yazıyor, `getQuestion()` soru+cevap eklerini **batched** (N+1 yok) yüklüyor;
  `AnswerView` tipine + `postRowToAnswerView`'e `attachments` eklendi. Ortak `resolveAttachments`
  mantığı iki serviste tekrar etmemek için `application/attachment.resolve.ts`'e çıkarıldı; aynı yerde
  **güvenlik sıkılaştırması**: saklanan `mime_type` artık `FORUM_IMAGE_MIME` allowlist'ine karşı
  doğrulanıyor (önceden yalnızca key regex uzantıyı sınırlıyordu; tüm ek yollarını kapsar). Web:
  picker mantığı `useForumImagePicker` hook'una + sunum `ForumImagePicker` bileşenine çıkarıldı
  (ThreadComposer/AskComposer/AnswerComposer paylaşıyor); soru+cevap detayına `AttachmentGallery`
  eklendi. Limitler Faz 1 ile birebir (max 4, ≤5MB, JPEG/PNG/WebP). Yeni i18n anahtarı yok. Testler:
  `forum-qa.service.spec` +3 (geçerli ek yazılıyor / yabancı key / spoof mime reddi), `forum.e2e`
  +1 (QA soru+cevap upload → detay eklerle döner). Video + dosya hâlâ ertelenmiş. *(APP-018)*
- **Post ekleri — görsel (Faz 1, APP-018)** — CHAT/ANNOUNCEMENT thread'leri ve yorum/yanıtları artık
  **çoklu görsel** (max 4, JPEG/PNG/WebP ≤5MB) taşıyabilir. Yeni polimorfik `forum_attachments` tablosu
  (`forum_reports` deseni: `target_type THREAD|POST + target_id`; `kind` ile video/file Faz 2'ye hazır;
  client-verilen width/height → CLS'siz galeri). Akış avatar/foto presigned desenini birebir kullanır:
  `POST /v1/forum/attachments/upload-url` → client dosyayı PUT eder → thread/comment create'e `attachments[]`
  (key) gönderir; servis her key'i **sahiplik regex'i + `storage.readObject` boyut/varlık** ile doğrular
  (`isValidForumAttachmentKey`, `FORUM_IMAGE_*`), sonra satırları yazar. Okuma batched (N+1 yok), URL'ler
  `storage.getPublicUrl` ile çözülür. Frontend: `ThreadComposer` görsel-picker + önizleme + yükleme,
  `AttachmentGallery` (1→oran korur, 2–4 grid, lightbox). Guardrail: image-only allowlist + boyut + per-user
  key; moderasyonla gizlenen/silinen post ekleri otomatik gizlenir (ayrı yüzey yok). Testler: forum e2e
  (upload→post→feed + foreign-key/>4 red) 15/15. QA + video + dosya + orphan-cleanup ertelendi. *(APP-018)*
- **Username author fallback** — forum thread/answer author seçimi `users.username ?? displayName`
  oldu; username seçmemiş eski hesaplarda ad soyad görünmeye devam eder. Related:
  `forum-thread.repository.ts`, `forum-post.repository.ts`. *(Profile username.)*
- **Author avatar propagation** — forum author view'ları `users.avatar_storage_key` alanını user join'i
  üzerinden taşır ve `StoragePort.getPublicUrl` ile `authorAvatarUrl` döner. Web `AuthorAvatar`
  resmi gösterir; `null` ise eski deterministic initials fallback aynen kalır. Related:
  `forum-thread.repository.ts`, `forum-post.repository.ts`, `forum.mappers.ts`, `author-avatar.tsx`.
  *(Profile avatar V1.)*
- **Slice 1 — Zones + membership** — one Zone primitive (ANNOUNCE/CHAT/QA), two-plane authz,
  scoped membership, `forum.enabled` flag. *(0052.)*
- **Slice 2 — Flat feed + reactions + pin** — `forum_threads` + `forum_reactions`, cursor feed,
  CHAT/ANNOUNCEMENT surface. *(0053.)*
- **Slice 3 — Q&A + XP + search** — `forum_posts`, question/answer, accepted-answer XP,
  Turkish full-text search, one-shot accept. *(0054.)*
- **Slice 5 — Moderation** — `forum_reports` + `forum_moderation_actions` (append-only audit),
  hide/restore/dismiss, room + platform queues. *(0056.)*
- **Web A — Core participation UI** — `/topluluk/**` (zone list, feed, QA, join, report),
  panel card, sidebar-only nav. *(0057.)*
- **Web B — Mod tools + search** — `/topluluk/[slug]/yonetim` (pending members, report queue),
  inline pin/delete, QA search. *(0058.)*
- **Slice 6 — SEO** — `@Public` QA reads, SSR page, `QAPage` JSON-LD, sitemap, robots (TR-only index). *(0059.)*
- **Admin UI — Zone yönetimi** — Admin panele "Topluluk" menüsü eklendi (`SUPER_ADMIN`/`ADMIN`). `/forum` zone listesi, `/forum/new` zone oluşturma formu. Backend'e dokunulmadı — mevcut `POST /v1/forum/zones` staff authz'u kullanılıyor. *(APP-016)*
- **Unified Layout + Author Display (APP-016)** — Discord benzeri zone sidebar (in-flow, masaüstü) + CSS transform mobile drawer; `ThreadView`/`AnswerView`'e `authorName: string` eklendi (LEFT JOIN users); `ZoneView`'e `emoji` alanı eklendi (DB migration + admin form); zone detail sayfasına sağ panel (zone bilgisi + pinned gönderiler); `AuthorAvatar` (deterministik pastel, initials); `relativeTime` helper (`Intl.RelativeTimeFormat`); `zone-shell-skeleton`. *(APP-016)*
- **Member reject & removal (APP-017)** — `DELETE /v1/forum/zones/:id/members/:userId` endpoint eklendi (aktif üye çıkarma + pending reddetme). `approveMember(false)` artık satırı PENDING'de bırakmak yerine siliyor. Policy'e `canRemoveMember` (OWNER çıkarılamaz). Repo'ya `findMembershipPrivileged` eklendi (`withServiceContext` — servis bağlamında güvenli role lookup). Web `/yonetim` sayfası iki tab'a genişledi: Bekleyenler (onayla/reddet) + Aktif Üyeler (kaldır); tab butonlarına `aria-pressed` eklendi. DB migration yok. Unit test: 37 → 45 (policy × 4 + service × 4). *(APP-017)*
- **Sağ kolon "Emek Panosu" (APP-017)** — `/topluluk` sağ kolonu yeni `community` modülüyle canlı bir efor panosuna çevrildi (streak + XP + haftalık sınav-tipi leaderboard + pozitif rozetler). Ayrıntı ve mimari: [`community.md`](./community.md). *(APP-017)*
- **"Trending Topics → Sohbet odaları" redesign (APP-017)** — Figma [Threads App Clone — Community](https://www.figma.com/design/9ekuZcod4ToI27D8LcKocZ/Threads-App-Clone--Community-?node-id=1-261) node'larından (`get_design_context` ile çekilen gerçek referans kod: 1:262/1:270/1:281/1:339) uygulanan **yapısal web redesign**, iki geçişte (backend/şema/tip değişikliği yok). `zone-sidebar.tsx`: zone satırları Trending-Topics kart diline (ikon karosu + kalın başlık + `t("members", {count})` ikincil satır) çevrildi. `layout.tsx`: içerik alanı arkaplanı `#f7f8fa` → beyaz (Figma'nın tam-beyaz canvas'ı). `zone-shell.tsx`: kutulu/gölgeli panel **tamamen kaldırıldı** — composer + thread'ler artık sayfa üzerinde `border-b`/`divide-y` ile ayrılmış gerçek flat liste (Figma 1:270/1:281 birebir); feed sütunu `max-w-2xl` ile Figma'nın ~640px dar sütununa yaklaştırıldı. `thread-item.tsx`/`thread-composer.tsx`: padding/tipografi Figma'nın px değerleriyle hizalandı (13-14px gövde, 12px meta, `pl-3/pr-4/py-4`); `reactionCounts` toplamından türetilen "`X beğeni`" satırı eklendi (Figma'nın "7 respostas · 59 curtidas" karşılığı). `reaction-bar.tsx`: renkli pill arkaplanları kaldırıldı, opaklık-bazlı minimal ikon satırına çevrildi — **bilinçli sınır**: Figma'nın monokrom heart/comment/repost/send SVG ikonlarının birebir karşılığı yok, çünkü ürün kararı gereği forum'da "pozitif emoji reaksiyonu" seti var (yorum/repost/paylaş özelliği MVP'de yok); emoji'nin renkli glyph doğası nedeniyle %100 monokrom görünüm mümkün değil. `right-panel.tsx`/`zone-card.tsx`/`question-list-item.tsx`: ağır gölgeler ince border'a çevrildi (beyaz canvas üzerinde gölge görünmüyordu). Görsel/attachment paylaşımı bilinçli olarak **kapsam dışı bırakıldı** (Figma'daki carousel'in karşılığı `forum_threads`'te yok) — Phase 2 backlog adayı. Üçüncü geçişte (aynı APP-017): zone-type rozeti (`Chip` — dolu lavanta buton görünümlü) Figma'nın düz/gri/uppercase eyebrow etiketine çevrildi (`zone-shell.tsx` header + `zone-card.tsx`) — artık tıklanabilir bir CTA gibi durmuyor. **Figma'daki üst icon-nav (home/search/heart/filter/bookmark) bilinçli olarak eklenmedi** — bu ikonlar Threads'te uygulama-geneli gezinme; bizde karşılığı zaten global app nav'da var, işlevsiz kopya ikon eklemek sahte affordance olurdu. *(APP-017)*

- **Feed item Threads detayları (APP-017)** — Figma 1:281/1:288 feed item yapısına yaklaştırma: thread başlığına **⋯ overflow menüsü** eklendi (`thread-menu.tsx` — report + pin/delete tek dropdown'da; eski hover "Şikayet et" + alttaki "Sabitle/Sil" metin aksiyonları kaldırıldı), avatar kolonuna **dikey bağlantı çizgisi** eklendi (Figma 1:282 rail; son item hariç `showConnector`), gövde tipografisi 13px/19px. `zone-shell` artık `ThreadItem`'a `actions` prop'u geçmiyor. *(APP-017)*
- **3 kolonlu Threads layout restructure (APP-017)** — Figma node 1:261/1:323/1:339 birebir yapı uygulandı (backend/şema/tip değişikliği yok). **Topluluk anasayfası (zone listesi) kaldırıldı**: `/topluluk` artık `GeneralFeed` ile ilk CHAT (yoksa ilk) zone'a `router.replace` edip doğrudan thread feed'ine düşürüyor. `layout.tsx` 3 kolona çevrildi: **sol** = sohbet odaları (Figma "Trending Topics" component'i 1:1 — flat liste, her satır eyebrow kategori 12px uppercase tracking-1px + başlık 14px medium + "X üye" 12px #616161), **orta** = thread feed (`ZoneShell`, artık tek beyaz sütun, `max-w-2xl`), **sağ** = `ProfileCard` (current-user, `useAuth().user`; Figma profil kartı 1:323 spec'i — avatar 64px, isim 20px bold, @username + examType rozeti, email, üye-tarihi). `ZoneShell`'den sağ `RightPanel` aside kaldırıldı (profil kartı layout'a taşındı); `AuthorAvatar` font'u boyutla orantılı (64px→24px). Silinen dead code: `topluluk-shell.tsx`, `zone-card.tsx`, `right-panel.tsx`. *(APP-017)*

- **Like + Comment (APP-017, MVP'ye alındı)** — Threads-style beğeni + yorum. **DB migration YOK** (mevcut `forum_reactions` + `forum_posts` yeniden kullanıldı). **Like**: reaksiyon seti tek kalbe (`FORUM_LIKE_EMOJI = "❤️"`, `FORUM_REACTION_EMOJIS = ["❤️"]`) daraltıldı; mevcut `PUT/DELETE /threads/:id/reactions` endpoint'leri aynen kullanılıyor; feed/thread action row'da dolu/boş kalp + sayaç. **Comment**: `forum_posts` (QA cevap tablosu) CHAT/ANNOUNCEMENT thread'lerine de açıldı. Yeni: `canCommentInZone` policy (CHAT+ANNOUNCEMENT için aktif üye/mod/staff — duyuruya üye yorumu açık, broadcast mod-only kalır), `ForumThreadService.comment()`/`getThreadDetail()`, `ForumThreadRepository.commentCountsByThread()` (read-time GROUP BY, reaction sayımıyla aynı desen), `ThreadView.commentCount`, `ThreadDetail { thread, comments: AnswerView[] }`. Endpoint'ler: `POST /threads/:id/comments`, `GET /threads/:id/detail` (yorum silme mevcut zone-bağımsız `DELETE /answers/:postId` ile). Web: `/topluluk/mesaj/[threadId]` detay sayfası (`MessageShell` — ana thread + yorum listesi + yorum composer, `ThreadComposer` yeniden kullanıldı). Unit: policy `canCommentInZone` (2 case) + service comment happy/forbidden/QA-reject (4 case); `forum.e2e` reaksiyon testi tek like emoji'sine güncellendi (`FORUM_LIKE_EMOJI`). **Repost/harici paylaşım kapsam dışı** (ürün kararı). *(APP-017)*

- **Feed parity turu (APP-017)** — Figma feed item'ıyla birebir hizalama: aksiyon ikonlarından inline sayılar kaldırıldı (Figma'da yok; sayılar sadece "yorum · beğeni" özet satırında), özet sırası Figma'ya göre (yorum→beğeni), ikon rengi koyulaştırıldı (`--color-main`). **Twitter-tarzı tıklanabilir post**: feed satırı tümüyle detay sayfasına götürüyor (`clickable` prop, `role="link"` + klavye); like/yorum/⋯ menü `stopPropagation` ile ayrık. **Yanıtlayan mini-avatarları** (Figma 1:285): `ThreadView.commenterNames` eklendi (feed'de son 3 farklı yorumcu — `recentCommentersByThread` DISTINCT ON, service-context); avatar kolonunda bağlantı çizgisi + overlapping mini-avatar kümesi. Boş yorum durumu ikon+başlık+açıklama ile davetkâr hale getirildi. *(APP-017)*

- **Hacim geliştirmeleri (APP-017)** — Bol seed verisiyle ortaya çıkan iyileştirmeler. **Sidebar tipe göre gruplandı**: her satırda tekrar eden kategori eyebrow yerine tek grup başlığı (Sohbet Odaları / Duyurular / Soru-Cevap) — hacim arttıkça ölçeklenir. **Feed sıralama**: "En yeni" (cursor) / "En popüler" (beğeni+yorum skoruna göre top-N, tek sayfa) toggle'ı; backend `feedQuerySchema.sort` + `ForumThreadRepository.listPopular` (korele alt-sorgu skoru, pinned önce). **Mikro-etkileşimler**: beğeni kalbine tek-atımlı pop animasyonu (`forum-like-pop`, toggle'da remount), like/comment ikonlarına hover-scale — hepsi `prefers-reduced-motion` korumalı. **Seed script**: `apps/api/scripts/seed-forum.ts` (`pnpm --filter @mentor/api seed:forum`) — dev-only, 15 hayalet kullanıcı + 5 zone + ~90 thread + yorum/beğeni; prod'da reddeder, yeniden çalıştırınca sadece seed-yazarı içeriği tazeler. *(APP-017)*

- **Recursive thread — yorum beğeni + nested yanıt (APP-017)** — Twitter/Threads modeli: her post VE yorum beğenilebilir + yanıtlanabilir, her düğümün kendi detay sayfası var (navigasyonla sınırsız derinlik). Tasarım: [docs/plans/2026-07-03-recursive-thread-design.md](../plans/2026-07-03-recursive-thread-design.md). **Migration** (`0029`): `forum_posts.parent_post_id` (self-FK) + `forum_post_reactions` tablosu (RLS `forum_reactions`'ı aynalar). **Types**: `CommentView` (like/reply/parent alanları), `CommentDetail`; `ThreadDetail.comments` → üst-seviye `CommentView[]`. **Backend**: `ForumPostRepository` (createReply/listTopLevel/listReplies/likeCounts/myLiked/replyCounts/add-removePostReaction); `ForumThreadService` (getThreadDetail→CommentView, `getCommentDetail`, `replyToComment`, `likePost/unlikePost`); endpoint'ler `GET/POST /posts/:id[/replies]`, `PUT|DELETE /posts/:id/reactions`. Yetki mevcut `canCommentInZone` ile (QA hariç). **Web**: paylaşımlı `CommentRow` (tıklanabilir + beğeni + yanıt sayısı), `/topluluk/yorum/[postId]` + `CommentShell` (odaklı yorum + yanıt composer + yanıtlar → daha derine), `MessageShell` CommentRow kullanıyor; `forum-icons.tsx` paylaşımlı. Optimistic like + pop animasyonu her düğümde. Unit: reply(auth) + like toggle + getCommentDetail (69 test). **Kapsam dışı** (kararla): QA cevapları, yanıt bildirimi (backlog). Seed script nested yanıt + yorum beğenisi üretiyor. *(APP-017)*

- **Mobil responsive geliştirme (APP-017)** — Web Interface Guidelines denetimiyle: yorum/thread başlıkları dar ekranda kırılıyordu (isim 2 satır, "14 saat önce" 2 satır, "Şikayet et" metni sıkıştırıyordu). Düzeltme: **tek satır başlık** (isim `min-w-0 truncate` · zaman `whitespace-nowrap flex-shrink-0` · ⋯ menü `ml-auto`); yorumlarda "Şikayet et" metni feed'deki gibi kompakt **⋯ menüsüne** çevrildi (`ThreadMenu` genelleştirildi: `targetId` + `targetType` THREAD/POST, feed + yorum ortak kullanıyor); gövde metinlerine `break-words` (uzun kelime/URL taşması); tıklanabilir satırlara `touch-manipulation` (çift-dokunma gecikmesi yok). **Kanallar drawer bug'ı**: `ZoneDrawer` `layout.tsx`'te flex satırının ilk çocuğuydu → mobilde tam-genişlik çubuk yerine dar sol kolona çöküyordu; drawer flex satırının dışına (üstüne tam-genişlik blok) taşındı. *(APP-017)*

- **İsim + @username gösterimi (APP-017)** — Post/yorum başlığında görünen ad artık `coalesce(username, displayName)` değil; **ayrı iki alan**: `authorName` = displayName (insan adı), `authorUsername` = @handle (nullable). `ThreadView`/`AnswerView`/`CommentView` + repo satır tipleri + tüm `coalesce` select'leri + mapper'lar güncellendi. Web: thread-item / comment-row / FocusedComment başlıklarında "İsim @handle · zaman" (handle yoksa gizli, ikisi de truncate — mobil-güvenli). Seed hayalet kullanıcılarına geçerli @handle verildi (`^[a-z0-9_]{3,24}$`, tire→alt çizgi). *(APP-017)*

### Figma fidelity backlog (backend gerektirir)

- ~~**Görsel/attachment + carousel**~~ — **Yapıldı** (Faz 1 CHAT/ANNOUNCEMENT · Faz 2 QA soru+cevap + lightbox carousel + orphan-cleanup, APP-018). ~~Dosya ekleri~~ **Yapıldı** (PDF + Office, APP-027). Kalan: **video** ekleri.
- **Nested yorumlar (yoruma yorum) + yorumlara like** — MVP düz yorum; nesting ve comment-level reaksiyon `forum_reactions`'ı `postId`'ye açmayı gerektirir.
- ~~**Zengin emoji reaksiyon paleti (👍💪🎉😮)**~~ — **Yapıldı** (thread + yorum, `❤️👍💪🎉🙏` pozitif set, APP-025).
- **Repost** — hâlâ kapsam dışı (ürün kararı; karşılık gelen entity yok). *Harici paylaşım (Send) yapıldı — APP-018; cevaplı QA sorularında artık public SEO linki paylaşılıyor (WP-J).*
- ~~**Zone başına agregat "X mesaj" sayacı**~~ — **Yapıldı** (`ZoneView.threadCount` + `threadCountsByZone` batched aggregate; sidebar "X üye · Y mesaj", APP-026).
- **Profil kartı sosyal alanları** — ~~takipçi sayısı~~ **Yapıldı** (takip grafı + takipçi/takip sayaç & listeleri, APP-022). Kalan: **bio + web sitesi** (`AuthUser`/`users`'da yok; şema + endpoint gerekir).

## Gotchas / Known issues

- **`forum.enabled` default off** — flip per-environment to go live.
- **Silinen kullanıcının içeriği redakte edilir, silinmez** — thread/post satırları
  `"[silinmiş içerik]"` gövdesiyle durur (KVKK silme, WP-K). Kullanıcı bir zone OWNER'ıysa üyeliği
  silinir ve zone **sahipsiz kalabilir** — MVP kabulü; ownership transferi backlog'la çözülür.
- **Paylaşım linki: QA cevaplandıysa public, aksi halde uygulama-içi** — Send, **cevabı olan** QA
  sorularında anonim SEO sayfasının mutlak URL'ini (`/forum/question/[id]`) paylaşır; böylece linki
  alan kişi üye olmadan açabilir. Cevapsız soru ve tüm CHAT/yorum postları uygulama-içi linkte kalır
  (`ForumPublicService` ≥1 silinmemiş cevap şartı arar — erken paylaşım 404 verirdi).
- **Orphan-cleanup kendi kendine koşar** — `ForumMaintenanceService` her API instance'ında 6 saatlik
  in-process timer'la sweep eder (JobRunner emsali; `forum.enabled` kapalıysa atlar, hata yutulur ve
  timer yaşar). **Render Cron girdisi GEREKMEZ.** `POST /internal/cron/cleanup-forum-attachments`
  (`CronSecretGuard`) manuel/ops override olarak durur. Çoklu instance'ta tekrarlı sweep zararsızdır
  (idempotent + batch-bounded 500; grace 24s).
- **Launch zone'ları boot'ta seed'lenir** — `ForumZoneSeedService` `zones.seed.json`'daki iki odayı
  (`genel-sohbet` CHAT + `soru-cevap` QA, ikisi de OPEN) sabit slug'la idempotent ekler
  (`onConflictDoNothing`, `createdBy: null`). `forum.enabled` kapalıyken de yazılır → flip anında
  `/topluluk` dolu. **Not:** seed `slugify()` KULLANMAZ (o `Date.now()` eki koyar, idempotent değil).
  Yeni oda eklemek için JSON'a stabil slug ile satır ekle veya admin panelinden (`/forum/new`) oluştur.
- **Slug is server-derived** from title + `Date.now()` base-36 suffix (curated, low volume).
- **Accept is one-shot/final** — no un-accept/switch (anti-farm). 409 on re-accept.
- **`accepted_post_id` has no FK** — avoids circular threads↔posts constraint; app-enforced.
- **Author identity** — `ThreadView`/`AnswerView`/`CommentView` include `authorName`,
  `authorUsername`, and nullable `authorAvatarUrl` via LEFT JOIN `users`. UI shows
  `t("unknown_author")` / initials fallback when empty.
- **Member removal: OWNER çıkarılamaz** — `canRemoveMember` OWNER rolünü bloklar; OWNER devri ayrı feature (backlog).
- **Restore lives in the queue** — hidden content isn't visible in the member feed; the only
  reachable restore is the RESOLVED tab of the report queue.
- **Forum endpoints intentionally have no OpenAPI response schema** — web consumes `http<T>()` +
  `@mentor/types` end-to-end; api-client regen is a no-op for forum. Adding `@ApiOkResponse`/CLI-plugin
  schemas is an API-wide convention change, deliberately deferred to its own round (not forum work).
- **OWNER cannot leave a zone** — `POST /zones/:id/leave` returns 409 `FORUM_OWNER_CANNOT_LEAVE`;
  ownership transfer is a separate backlog feature. Everyone else self-leaves (ACTIVE) or withdraws
  their pending request with the same endpoint (idempotent; no-membership is a 204 no-op).
- **Migration not auto-applied in some setups** — run `pnpm db:up && pnpm db:migrate` once.
- **Tests need the DB** — vitest `globalSetup` migrates real Postgres before any spec.
- **Unit tests: 76 green** (forum module spec'leri — policy + zone + thread + QA + mention + moderation). E2E testler ayrı çalışır (`pnpm db:up && pnpm db:migrate` sonrası).

## Related

- Design doc: [`plans/2026-06-22-forum-community-design.md`](../plans/2026-06-22-forum-community-design.md)
- Slice-1 plan: [`plans/2026-06-22-forum-community-slice1-plan.md`](../plans/2026-06-22-forum-community-slice1-plan.md)
- Seam: [economy.md](./economy.md) (XP on accepted answer), [i18n.md](./i18n.md) (topluluk namespace)
- Status: [core/mvp-status.md](../core/mvp-status.md) (W7 breakdown)
