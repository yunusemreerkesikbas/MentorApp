# Ads — Google Ad Manager & Rewarded Coin Sessions (`modules/ads`)

> Contextual Google Ad Manager display placements (blog, editor-reviewed Q&A/announcements, and
> gated overviews) plus idempotent rewarded Coin sessions. Ad-free for Premium and `STAFF`.

---

## 1. Overview & Product Boundaries

`AdsModule` manages ad placement eligibility and rewarded session state without touching the
`EconomyModule` ledger directly (rewarded sessions reserve capacity via `coin_grant_reservations`
and settle `(ref_type, ref_id) = ('ad_reward', sessionId)` in one `SERVICE` transaction):

- **Always Ad-Free:** Active `Premium` subscribers, `STAFF`, and `COACH` editors never see ads.
- **Strictest Child/Teen Treatment:** If either the user's profile or the page's content family is `LGS`, requests apply `CHILD` treatment; if either is `YKS`, `TEEN` treatment applies. Zero PII, exam scores, mood, or chat history is ever sent to Google (`limitedAds: true`).
- **Default-Off Rollout & Country Gate:** Every placement flag defaults to `false`. `ads.display.allowed_countries` defaults to `TR` (unknown countries fail closed with `REGION_NOT_ENABLED`). Production (`NODE_ENV === 'production' || APP_ENV === 'production'`) blocks sample display inventory (`TEST_INVENTORY_NOT_ALLOWED`) and fails closed on web rewarded ads (`SERVER_VERIFICATION_UNAVAILABLE` until SSV/AdMob).

---

## 2. The 8 Display Placements & Content-Revision Proofs

Configured in Admin `/config` (`Reklamlar` category) and audited via `GET /v1/admin/ads/readiness`:

| Placement ID | Surface | Verification & Safety Gate |
|---|---|---|
| `knowledge.article.end` | `/bilgi/[slug]` end | Requires published article slug in `ContentModule`. |
| `knowledge.index` | `/bilgi` list | Requires valid `family` (`KPSS/YKS/LGS/ALES/DGS`), `page`, and `>=1` published summary with editorial description. |
| `notebooks.overview` | `/defter` shelf | Authenticated Free student with verified profile context; editor pages stay ad-free. |
| `vision.overview` | `/hedef` discovery | Authenticated Free student; lazy `250×250` / `300×250` slot destroyed when drawer closes. |
| `forum.question.end` | Public `/forum/soru/[id]` | Requires answered public Q&A + editor-approved SHA-256 `contentRevision` (`ad_question_reviews`). |
| `community.question.end` | In-app Q&A detail | Requires separate editor approval of the community publisher snapshot (`waitingQuestions` rail + room proof); hides on composer/dialog interaction. |
| `community.announcement.end` | Public room announcement | Requires `PUBLIC` active `ANNOUNCEMENT` room + editor-approved `contentRevision` (`content_type = 'ANNOUNCEMENT'`). |
| `community.overview` | `/topluluk` Keşfet rail | Requires both `.enabled` and `.review_approved`, plus matching rendered/server public snapshot proof (no personal continuation or buddy cards). |

---

## 3. API Surface

| Endpoint | Purpose |
|---|---|
| `GET /v1/ads/public/placements/:placementId`, `GET /v1/ads/placements/:placementId` | Evaluate anonymous or authenticated display placement policy |
| `GET /v1/admin/ads/readiness` | `SUPER_ADMIN` 8-placement configuration & safety diagnostics |
| `GET\|PUT\|DELETE /v1/admin/ads/questions/:id{,/community}` | `EDITOR` preview, SHA-256 revision approval (`409` if stale), and revoke for Q&A ads (audited) |
| `GET\|PUT\|DELETE /v1/admin/ads/announcements/:threadId` | `EDITOR` preview, approval, and revoke for announcement ads (audited) |
| `GET /v1/ads/reward-offers/:placementId`, `POST /v1/ads/reward-sessions{,/:id/complete,/:id/close}` | Rewarded Coin video offer & session lifecycle (`10 Coin` default, 1/day, dev/test only on web) |
| `POST /v1/internal/cron/expire-ad-reward-sessions` | `CRON_SECRET` sweeper expiring abandoned reward reservations |

---

## 4. Geliştirmeler (Condensed Milestone Timeline)

- **2026-11-01..05 — Production Env Guard Unification & `×10` Rewarded Coin Default:** Unified `isProductionEnv()` (`NODE_ENV` + `APP_ENV`) across sample display blocking and rewarded web fail-closed checks, and updated `ads.rewarded.web.reward_coin` default to `10 Coin`.
- **2026-10-25..27 — Editor-Reviewed Q&A/Announcement Snapshots & Readiness Diagnostics (`0131`, `0132`):** Shipped SHA-256 `contentRevision` approval workflows for `forum.question.end`, `community.question.end`, `community.announcement.end`, and `community.overview`, plus `GET /v1/admin/ads/readiness` and `AdsReadinessSummary.tsx`.
- **2026-08-29..10-09 — Blog/Overview Placements & Rewarded Coin Sessions:** Shipped `AdsModule`, GPT limited-ads loader, `/ads.txt` route, `knowledge.article.end`, `knowledge.index`, `notebooks.overview`, `vision.overview`, and `ad_reward_sessions`.
