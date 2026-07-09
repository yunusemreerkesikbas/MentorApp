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
| `GET /v1/forum/zones/:id/members` | List members (owner/mod) |
| `POST /v1/forum/zones/:id/members/:userId/approve` | Approve pending member |
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
| `POST /v1/internal/cron/cleanup-forum-attachments` | Orphan upload sweep (CronSecretGuard, APP-018) |
| `POST /v1/forum/reports` | Report content |
| `GET /v1/forum/zones/:id/reports` | Room moderation queue |
| `GET /v1/forum/reports` | Platform moderation queue |
| `POST /v1/forum/reports/:id/resolve` | Hide/dismiss report |
| `POST /v1/forum/threads/:threadId/restore` | Restore hidden thread |
| `GET /v1/forum/search?q=` | Full-text search (QA only) |
| `GET /v1/forum/public/questions/:id` | Public QA (SSR, @Public) |
| `GET /v1/forum/public/questions?limit=` | Public QA refs (sitemap) |

## Geliştirmeler (timeline)

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

- ~~**Görsel/attachment + carousel**~~ — **Yapıldı** (Faz 1 CHAT/ANNOUNCEMENT · Faz 2 QA soru+cevap + lightbox carousel + orphan-cleanup, APP-018). Kalan: video + dosya ekleri.
- **Nested yorumlar (yoruma yorum) + yorumlara like** — MVP düz yorum; nesting ve comment-level reaksiyon `forum_reactions`'ı `postId`'ye açmayı gerektirir.
- **Zengin emoji reaksiyon paleti (👍💪🎉😮)** — like tek kalbe indirildi; palet dönerse config arkasına alınabilir.
- **Repost** — hâlâ kapsam dışı (ürün kararı; karşılık gelen entity yok). *Harici paylaşım (Send) yapıldı — APP-018.*
- **Zone başına agregat "X mesaj" sayacı** (Trending Topics'teki "123.9k threads" karşılığı) — şu an `memberCount` ile yaklaşıklanıyor; gerçek sayım için zone'a thread-count aggregate eklenmesi gerekir (küçük, isteğe bağlı iyileştirme).
- **Profil kartı sosyal alanları** — Figma profil kartında bio, takipçi sayısı, web sitesi var; `AuthUser`'da yok. Şu an displayName + @username + examType + email + üye-tarihi ile yaklaşıklanıyor. Bio/website/followers için şema + endpoint gerekir.

## Gotchas / Known issues

- **`forum.enabled` default off** — flip per-environment to go live.
- **Paylaşım linki (Send) uygulama-içi + üye-gerektirir** — `/topluluk/mesaj|yorum|soru/...`; CHAT postları
  public değil, giriş yapmamış/üye olmayan kullanıcı auth'a düşer. QA'nın public SEO sayfası
  (`/forum/soru/[id]`) var ama Send tüm postlar için uygulama-içi linki kullanıyor (QA-public link backlog).
- **Orphan-cleanup cron manuel kayıt ister** — `POST /internal/cron/cleanup-forum-attachments`
  (`CronSecretGuard`, `x-cron-secret`) kendi kendine çalışmaz; Render Cron'a eklenmeli (grace 24s,
  günde bir yeterli). Kayıt edilmezse öksüz upload'lar birikir (işlevsel hata değil, storage sızıntısı).
- **Zone olmadan B2C boş görünür** — `forum.enabled = true` olsa bile `forum_zones` tablosu boşsa `/topluluk` "Henüz bir alan yok" gösterir. Üretime çıkmadan önce admin panelinden (`/forum/new`) en az bir zone oluştur.
- **Slug is server-derived** from title + `Date.now()` base-36 suffix (curated, low volume).
- **Accept is one-shot/final** — no un-accept/switch (anti-farm). 409 on re-accept.
- **`accepted_post_id` has no FK** — avoids circular threads↔posts constraint; app-enforced.
- **Author identity** — `ThreadView`/`AnswerView`/`CommentView` include `authorName`,
  `authorUsername`, and nullable `authorAvatarUrl` via LEFT JOIN `users`. UI shows
  `t("unknown_author")` / initials fallback when empty.
- **Member removal: OWNER çıkarılamaz** — `canRemoveMember` OWNER rolünü bloklar; OWNER devri ayrı feature (backlog).
- **Restore lives in the queue** — hidden content isn't visible in the member feed; the only
  reachable restore is the RESOLVED tab of the report queue.
- **Forum endpoints have no OpenAPI response schema** — web uses raw `fetch` + `@mentor/types`.
- **Migration not auto-applied in some setups** — run `pnpm db:up && pnpm db:migrate` once.
- **Tests need the DB** — vitest `globalSetup` migrates real Postgres before any spec.
- **Unit tests: 45 green** (forum module spec'leri — policy + zone + thread + QA + moderation). E2E testler ayrı çalışır (`pnpm db:up && pnpm db:migrate` sonrası).

## Related

- Design doc: [`plans/2026-06-22-forum-community-design.md`](../plans/2026-06-22-forum-community-design.md)
- Slice-1 plan: [`plans/2026-06-22-forum-community-slice1-plan.md`](../plans/2026-06-22-forum-community-slice1-plan.md)
- Seam: [economy.md](./economy.md) (XP on accepted answer), [i18n.md](./i18n.md) (topluluk namespace)
- Status: [core/mvp-status.md](../core/mvp-status.md) (W7 breakdown)
