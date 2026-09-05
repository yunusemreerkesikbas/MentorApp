# MVP Status Report

> One-page snapshot of what's built vs pending for the MVP (Phase 1). Detail per item → linked
> feature doc. Track ownership/sequencing → [`workstreams.md`](./workstreams.md). Product scope → roadmap.
> Status: ✅ done · 🟡 partial · ⏳ pending (MVP) · ⛔ Phase 2.

## Done / In progress by workstream

| Track | Status | Shipped | Pending (MVP) |
|---|---|---|---|
| **Base infra** | ✅ | db (pg Pool) · errors · i18n · logging · health · OpenAPI · tests ([base-infrastructure](./base-infrastructure.md)) | — |
| **Object storage (R2)** | ✅ | StoragePort + R2/fake adapters, five upload consumers, single-source key prefixes, orphan sweeps, `storage:check` verification script. Cloudflare-side setup done (2026-08-07): `mentor-public`/`mentor-private` buckets (default jurisdiction — matches `R2_JURISDICTION=auto`), r2.dev public URL enabled on the public bucket, CORS applied via wrangler on both, account-scoped Object Read & Write API token. `storage:check` full sweep green — **34/34** across all five prefixes (presign, CORS preflight, PUT, public GET + CORS header, server-side `readObject`, `deleteObject`, and the private-bucket public-URL rejection). Vision-board image upload verified live through the browser too ([storage-r2](./storage-r2.md)) | Production bucket pair (EU jurisdiction, `-J eu`) not yet created — today's setup is dev-only |
| **W0 Identity** | ✅ | JWT + refresh rotation, RLS policies, guards, web auth screens, auth UI polish ([identity](../features/identity.md)) | — |
| **W1 Content** | 🟡 | exam calendar · knowledge center · bilgi UI polish · subjects/exam-subjects · topics/exam-topics · exam-calendar admin editor · pgvector RAG embeddings ([content](../features/content.md)) | — (HNSW index at scale = backlog) |
| **W2 Coaching** | 🟡 | daily loop · panel · plan/seans UI polish · mock-exam **analiz** UI polish + topic-level wrong map · **web profil** (exam-type picker, account hub) · **mood: struggle-note + premium AI-adaptive reflection** · **ghost (geçmiş-ben) comparison + premium AI narration** · **hayal/hedef panosu + premium AI notu** · **yanlış defteri** (spiralli defter canvas + hata tipi + 2/7/21g tekrar merdiveni + tekrar hatırlatması + analiz hata-tipi dağılımı) ([coaching](../features/coaching.md)) | — (MVP feature set complete) |
| **W3 AI** | 🟡 | premium AI coach chat + persisted conversations · **SSE streaming** · **RAG grounding + source links** · **coin→AI chat spend** · **photo→subject/topic pre-labelling for the mistake notebook** (the standalone categorize card was retired 2026-08-14 — it told students what they already knew) · mood/ghost AI narration · **Responses API migration + eval run (2026-07-20: live 4/4, eval 9/9 hard-clean)** ([ai](../features/ai.md)) | opsiyonel: model karşılaştırması (örn. gpt-4.1-mini) |
| **W4 Payments** | ✅ | PaymentsPort fake/iyzico, trial state machine, entitlement + PremiumGuard, idempotent webhook, INCOMPLETE verification gate + wired refund (WP-I), /abonelik, abonelik UI polish ([payments](../features/payments.md)) | iyzico prod keys + e-archive + real iyzico adapter impl (Phase-0 ops) |
| **W5 Notifications** | ✅ | JobQueuePort + cron runner, Postmark email, web push, daily reminders; in-app inbox + SSE real-time bell; notification tap navigation (linkUrl); contextual motivational notifications (streak milestone / low mood / first session / plan completed — event-driven, template, deduped) ([notifications](../features/notifications.md)) | Phase 2: AI frekans ayarı |
| **W6 Admin + Economy** | ✅ | see breakdown below — all MVP slices shipped incl. weekly quests + refund reversal + deep-analysis sink (APP-025) ([admin](../features/admin.md) · [economy](../features/economy.md)) | Phase 2: forum coin, Redis leaderboard |
| **W7 Forum / Community** | ✅ | Phase-2 feature **pulled into MVP** (design [`plans/2026-06-22`](../plans/2026-06-22-forum-community-design.md)) — see breakdown below. Backend (zones · Discovery V2 feed/hub · QA+XP+search · moderation · public SEO) + web/admin. Release-hardening coverage: **115 forum unit · 35 forum E2E · 25 RLS probe**. Behind `forum.enabled`; production flip awaits staging + visual approval ([forum](../features/forum.md)) | Phase 2: verification tiers · coin rewards · C-layer (AI ingest) · mahalle/live rooms · Tier-1 auto-moderation |
| **W8 Mentorship (koç)** | 🟡 | **Phase-2 pull-forward** ([workstreams](./workstreams.md)). Human coach↔student link (rotating invite code + double opt-in), risk-sorted roster with a rule-based cohort band + seat counter + coach-side data-scope mirror, single-student report, weekly assignment composer with topic + coach note, program feedback loop (deleted/completed assignments travel back), append-only dropped-assignment log, one standing note per link, daily risk digest cron. Coverage: **121 API unit+e2e · 24 browser (2 viewports)**. Behind `mentorship.enabled` (default off) and `mentorship.risk_digest.enabled` (default off); neither has been flipped in production ([mentorship](../features/mentorship.md)) | Phase 2/3: AI smart brief · seat billing · coach vetting queue · in-app chat · `apps/panel` move |

## W6 breakdown (this stream's focus)
| Slice | Status | Feature doc |
|---|---|---|
| Admin module foundation: STAFF assignment + append-only audit log (table + interceptor) | ✅ | [admin](../features/admin.md) |
| Admin UI shell: Duralux app → `apps/admin`, pnpm-integrated, hybrid TS, auth guard/login/logout, branding | ✅ | [admin](../features/admin.md) |
| User management: search/detail, graduated status (suspend/ban), KVKK export + anonymize | ✅ | [admin](../features/admin.md) |
| Config registry + feature flags (typed catalog + DB overrides + cache, admin `/config`) | ✅ | [notifications](../features/notifications.md) |
| Light economy substrate: append-only XP/Coin ledger, capped reward engine, admin manual adjust | ✅ | [economy](../features/economy.md) |
| Light economy: invite → conversion → coin (idempotent, capped) | ✅ | [economy](../features/economy.md) |
| Content editor: knowledge-center article CRUD + publish/unpublish (ADMIN/EDITOR, trust metadata) | ✅ | [admin](../features/admin.md) |
| Exam-calendar editor: exam upsert + calendar events upsert/delete (ADMIN/EDITOR, trust metadata) | ✅ | [admin](../features/admin.md) |
| Refund + subscription admin view (record-only refund + cancel, ADMIN, audited) | ✅ | [admin](../features/admin.md) |
| Metrics dashboard (users + subscriptions/revenue + economy KPI snapshot, ADMIN) | ✅ | [admin](../features/admin.md) |
| Economy: onboarding quests (auto-grant, capped, idempotent; habit/milestone backlog) | ✅ | [economy](../features/economy.md) |
| Economy: coin spend → AI chat (`EconomyService.spend`; integrated by W3) | ✅ | [economy](../features/economy.md) |
| Fine admin sub-roles (SUPPORT/FINANCE/SUPER_ADMIN gating + assignment; MODERATOR reserved) | ✅ | [admin](../features/admin.md) |
| Moderation queue (forum/community content) | ✅ | shipped with forum (W7) — [forum](../features/forum.md) |

## W7 breakdown — Forum / Community (Phase-2 → MVP, behind `forum.enabled`)
| Slice | Status | Feature doc |
|---|---|---|
| Slice 1 — Zones + scoped membership (curated staff creation, external OWNER, OPEN/REQUEST join, two-plane authz) | ✅ | [forum](../features/forum.md) |
| Slice 2 — Flat feed (threads) + reactions + pin (CHAT/ANNOUNCEMENT) | ✅ | [forum](../features/forum.md) |
| Slice 3 — Q&A: questions/answers + asker one-shot accept → XP (event→economy) + full-text search | ✅ | [forum](../features/forum.md) |
| Slice 5 — Reports → moderation queue (room owner/mod + platform override, hide/restore/dismiss, append-only audit) | ✅ | [forum](../features/forum.md) |
| Web A — Core participation UI (`/topluluk`: zone list · feed · QA · join · report) | ✅ | [forum](../features/forum.md) |
| Web B — Moderation tools + approvals + search (`/topluluk/[slug]/yonetim`, inline pin/delete, index search) | ✅ | [forum](../features/forum.md) |
| Slice 6 — SEO: public QA pages (SSR + `QAPage` JSON-LD) + sitemap + robots (TR-index) | ✅ | [forum](../features/forum.md) |
| APP-016 — Unified layout + author display: zone sidebar (in-flow desktop) + CSS transform mobile drawer; `authorName` LEFT JOIN (`ThreadView`/`AnswerView`); `emoji` on zones; right panel; `AuthorAvatar`; `relativeTime`; admin emoji field | ✅ | [forum](../features/forum.md) |

## Cross-cutting / known issues
- **B2C web welcome** (`/`) — pre-auth 3-slide Puhu intro; first visit → then `/giris` ([web-shell](../features/web-shell.md)). Marketing landing removed (future route TBD).
- **B2C web onboarding** — post-login 4-step wizard (`/onboarding`: welcome → exam required → goal → complete); gate = `users.examType` ([web-shell](../features/web-shell.md)).
- **B2C web auth** (`/giris`, `/kayit`, …) — Nuton shell + motion polish ([identity](../features/identity.md)); last slide CTAs → kayıt/giriş.
- **B2C app shell** — tab bar / sidebar nav polish + `/panel` vs `/plan` active fix ([web-shell](../features/web-shell.md)).
- **B2C web UI polish** — series complete; cross-cutting sweep ([web-shell](../features/web-shell.md)).
- **B2C web i18n (TR/EN)** — URL-based next-intl; tüm FE static copy `useTranslations`/`getTranslations`, statik
  render + public ISR ([i18n](../features/i18n.md)). Yeni FE işleri localize yapılır (frontend.md §i18n).
- **B2C web economy/invite UI** (`apps/web`) — earn hub on `/profil` (balance, quests, invite) ([economy](../features/economy.md)); ledger history UI = slice 2 backlog. Requires `economy.enabled=true`.
- **Migration journal drift** — RECONCILED ([ai](../features/ai.md) — mood AI-adaptive slice): re-added the
  missing `0006_info_articles` journal entry and restored the HEAD snapshot (`meta/0017_snapshot.json`)
  so `db:generate` emits only new deltas. Policy: commit each migration **with its snapshot + a real
  timestamp**, forward-only. Caveat: a local DB that already skipped 0006 won't auto-apply it (drizzle
  applies `when > last`) — apply `0006_info_articles.sql` once by hand if `info_articles` is missing.
- **Economy reconcile** — invite reward on transient grant failure isn't retried (cap denial is by
  design); outbox/retry = Phase 2. Refund coin reversal shipped (APP-025, refund-only +
  clamp-to-zero); churn-based reversal deliberately not implemented.
- **Local RLS masking** — RESOLVED as a test gap (WP-K): `test/rls-isolation.e2e-spec.ts` provisions
  a self-contained `rls_probe` role (NOSUPERUSER/NOBYPASSRLS) and proves cross-user isolation +
  context-less deny on four user-owned and three Discovery V2 tables; helpful votes are user-isolated,
  while tag/thread-tag/helpful writes require ADMIN/SERVICE — the first suite to exercise policies (all other
  e2e run as the superuser `mentor`, which bypasses RLS). Local dev still connects as superuser, so
  keep verifying RLS-sensitive reads run in the right context. Known nuance: `coach_messages` (0044)
  casts `app.user_id` to uuid — an empty-string context ERRORS instead of filtering (still a denial);
  other policies compare as text.
- **KVKK erasure is now full-scope (WP-K)** — `DELETE /v1/account` covers identity + ai + coaching +
  **forum (redaction-in-place) + social graph + notifications**; ledger/payment rows retained
  (legal). Proven table-by-table in `test/account-erasure.e2e-spec.ts`, incl. idempotent second
  DELETE. Self-service data **export** is still missing (backlog).
- **Forum / community (W7)** — entire surface gated by `forum.enabled` (default **off**); flip per
  environment to go live. Public SEO QA reads run in **service context** (forum tables are RLS-forced)
  hard-filtered to indexable QA (`PublicQuestionView` omits PII). Membership management is complete:
  reject (`{approve:false}`), kick (`DELETE members/:userId`, OWNER-protected) and voluntary
  **leave/withdraw** (`POST /zones/:id/leave`, OWNER 409) all shipped with web UI. **Flip is
  operationally ready (WP-J):** two launch zones are seeded at boot (idempotent, stable slugs) so
  `/topluluk` is never an empty dead end, and the orphan-attachment sweep runs on its own 6h
  in-process timer — **no Render Cron entry to register** (the HTTP endpoint stays as the manual
  override). Forum endpoints
  **intentionally ship without OpenAPI response schemas** — web consumes `http<T>()` + `@mentor/types`
  (api-client regen is a no-op); API-wide `@ApiOkResponse`/CLI-plugin adoption is a deliberately
  deferred, separate round. `NEXT_PUBLIC_SITE_URL` drives canonical/sitemap/robots.

## Guardrails honored (AGENTS §4)
Coin non-monetary/capped · append-only ledgers (never edited/deleted) · reward tied to verified action ·
no coin in chat · LLM never generates official info (editorial + trust metadata) · every admin mutation
audited · org/coach-ready schema · KVKK erasure via anonymization.
**Forum (W7):** no coin anywhere · forum XP only on accepted answer (idempotent) · moderation actions
append-only audit · public QA omits PII (no `authorId`) · forum content not LLM-ingested (C-layer = Phase 2).
