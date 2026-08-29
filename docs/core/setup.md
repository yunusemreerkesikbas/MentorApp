# Local Setup

## Prerequisites
- **Node ≥ 22** (`.nvmrc` = 22; Node 24 also works on the current dev machine).
- **pnpm** (via Corepack: `corepack enable`). Version in `package.json > packageManager`.
- **Docker** (Docker Desktop running) — for the local Postgres.
- Git.

## Steps
```bash
# 1) Dependencies (from root — entire workspace)
pnpm install

# 2) Environment
cp .env.example apps/api/.env   # API secrets + W5 vars (see below)
# Web push needs a separate file (Next.js reads apps/web only):
#   apps/web/.env.local → NEXT_PUBLIC_API_URL + NEXT_PUBLIC_VAPID_PUBLIC_KEY

# 3) Local database (docker — Postgres 16 + pgvector, host port 5433)
pnpm db:up                      # start; `pnpm db:down` to stop
pnpm --filter @mentor/api db:migrate   # apply migrations (extensions + jobs)

# 4) Development — all
pnpm dev                    # api:3001/v1 · web:3000 · admin:3002
#    or a single app
pnpm --filter @mentor/web dev
```

## W5 · Notifications (local smoke test)

Queue + email + push live in the **notifications** module — see [features/notifications.md](../features/notifications.md).

**Env files (git-ignored)**

| File | Variables |
|---|---|
| `apps/api/.env` | `CRON_SECRET` (≥32 chars), optional `POSTMARK_TOKEN` + `POSTMARK_FROM`, `VAPID_*` |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:3001/v1`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (= API public key) |

Copy W5 keys from [`.env.example`](../.env.example). Generate VAPID: `npx web-push generate-vapid-keys`.

Without `POSTMARK_TOKEN`, emails are **logged** (not sent). Without VAPID, push jobs log only; profil shows a config hint until web public key is set. Restart `pnpm dev` after env changes.

**Run the job runner manually** (Render Cron equivalent):

```bash
# Process queued jobs (signup mail, payment mail, push, …)
curl -X POST http://localhost:3001/v1/internal/cron/process-jobs \
  -H "x-cron-secret: $CRON_SECRET"

# Rule-based daily reminders → enqueues email/push jobs (then run process-jobs again)
curl -X POST http://localhost:3001/v1/internal/cron/dispatch-daily-reminders \
  -H "x-cron-secret: $CRON_SECRET"
```

Quick checks: register a user → job row in `jobs` → `process-jobs` → completed; `/profil` → enable push → dispatch + process cron.

**Cron kaydı gerektiren işler (Render Cron):** yalnız yukarıdaki **ikisi** — `process-jobs` ve
`dispatch-daily-reminders`. Forum'un öksüz-ek temizliği (`cleanup-forum-attachments`) **kayıt
istemez**: `ForumMaintenanceService` her API instance'ında 6 saatlik kendi timer'ıyla koşar
(`forum.enabled` kapalıysa atlar). Endpoint manuel/acil tetikleme için durur:

```bash
curl -X POST http://localhost:3001/v1/internal/cron/cleanup-forum-attachments \
  -H "x-cron-secret: $CRON_SECRET"
```

## Forum Discovery V2 smoke test (staging pre-flip)

Production bayrağı bu akışta açılmaz. Staging kontrolü migration/seed → sorgu planı → staging flag →
ürün smoke → SEO/PII → kullanıcının görsel onayı sırasıyla yapılır; hata halinde yalnız
`forum.enabled=false` ile geri alınır, migration geri çevrilmez.

1. Forward-only migration'ları uygula; seed sonrası CHAT ve QA launch odalarının mevcut olduğunu doğrula.
2. 10 bin geçici thread + thread-tag ilişkisini transaction sonunda geri alan sorgu smoke'unu çalıştır:

   ```bash
   docker cp apps/api/scripts/explain-forum-discovery.sql mentor-postgres:/tmp/explain-forum-discovery.sql
   docker exec mentor-postgres psql -U mentor -d mentor_test -f /tmp/explain-forum-discovery.sql
   ```

   Staging'de aynı dosyayı staging bağlantısıyla çalıştır. Recent/trending/top/tag planlarında
   `Sort Method: external` veya temp spill olmamalı; seçici etiket yolu
   `forum_thread_tags_tag_thread_idx` (bitmap kabul) kullanmalı. Cursor tekrarsızlığı forum E2E'de
   ayrıca kanıtlanır.
3. Yalnız staging'de `forum.enabled=true` yap.
4. İki STUDENT + bir EDITOR ile hub, üç feed sekmesi, composer, helpful self/idempotency, edit
   süresi/etkileşim kilidi ve aramalı featured seçimini smoke et.
5. Cevaplı public QA SEO sayfasını ve `/forum/search` yanıtında e-posta/PII olmadığını kontrol et.
6. 375/768/1024/1440 px görsel onayı kullanıcı tarafından verildikten sonra ayrı production kontrol
   noktası aç; onay öncesi production flag kapalı kalır.

## Economy smoke test (pre-flip)

10 adımlık uçtan uca prova: `economy.enabled` açılmadan önce staging'de (veya lokalde) koşulur.
İlk tam koşu: 2026-07-19, 10/10 PASS — bkz. [features/economy.md](../features/economy.md) timeline.
**All-fake env yeterli:** `AI_PROVIDER=fake` (narration FakeLlm ile çalışır), `PAYMENTS_PROVIDER=fake`.

**Hazırlık**

1. `pnpm db:up` → `pnpm --filter @mentor/api db:migrate` → `pnpm dev`.
   Gotcha: web route klasörleri değiştiyse (ör. URL rename) **`apps/web/.next` silinmeli** — bayat
   Turbopack cache'i tüm alt sayfaları 404 yapar.
2. Üç kullanıcı kaydet (web `/kayit`): U1 (test), U2 (davet edilen), A1 (admin). SUPER_ADMIN:
   `update users set roles = array_append(roles,'SUPER_ADMIN') where email='<A1>';` → `:3002/login`.
3. Flip: admin `/config` → `economy.enabled` **Feature Flags grubunda** (economy grubunda değil).
   SQL fallback: `insert into config_overrides(key,value) values ('economy.enabled','true'::jsonb)
   on conflict (key) do update set value=excluded.value;` — **sonra API restart** (process-local cache).
4. Coin fonlama (adım 6-7 için ≥45): `POST /v1/admin/users/<U1>/economy/adjust
   {"unit":"COIN","amount":50,"reason":"smoke funding"}` — audit'li, cap'leri bilinçli bypass eder ve
   organik cap muhasebesine girmez (davet ödülü +20 ise organiktir, 50/gün cap'ine sayılır).

**Adımlar** (ledger sorgusu: `select reason, unit, amount, ref_type, ref_id from ledger_entries
where user_id='<id>' order by created_at desc;`)

| # | Aksiyon | Beklenen |
|---|---|---|
| 1 | Admin `/config`: economy anahtarları; `weekly_focus_sessions_target=0` ve `daily_cap=-1` dene | Anahtarlar görünür; ikisi de 400 (zod bound); `admin_audit_log`'da `config.update` satırı |
| 2 | U1 `GET /v1/economy/balance`; web `/panel` + `/profil` | 200; balance pill + quest banner + earn hub görünür |
| 3 | `/plan`da görev ekle + tamamla | +5 XP, ledger TR etiketli (`Görev ödülü`), `user_quest_progress.period_key=YYYY-AA-GG` |
| 4 | Quest sheet "Bu Hafta" tab'ı; kısa bir odak seansı bitir (backdate: `startedAt` −12 dk, `actualFocusSeconds≥300`) | 3 haftalık görev, hedefler config'ten, `{target}` çözülmüş; seans → progress +1; `period_key=YYYY-Www` |
| 5 | U1 kodu → U2 redeem → U2 fake checkout → imzalı `payment_succeeded` webhook (HMAC-SHA256, `x-fake-signature`, raw body birebir) → admin refund → tekrar refund | Redeem PENDING; checkout TRIALING (ödül yok); webhook → U1 +20 `invite.converted`; refund → `invite.reverted` −N (clamp, `note: orig:20`); ikinci refund 400 + reversal satırı hâlâ 1 |
| 6 | Streak: `daily_activity`e T-2/T-4/T-6 satırı ekle (T-1/T-3/T-5 boş) → `/panel` "Günü dondur" 2-tap | `GET /streak-rescue` eligible (en eski bu-ay boşluğu); −20 `streak.freeze.purchase`; `streak_freezes` satırı |
| 7 | Derin analiz: geçen haftaya 2 COMPLETED seans gerekli — **review `ended_at` ile geçen haftayı sayar**, finalize `ended_at=now` yazdığından SQL ile geçen haftaya çek → `/analiz` Gelişim tab → 2-tap 25 coin | Kart "25 coin ile aç" → "Açıldı" + narration + önerilen görev; −25 tek satır; tekrar `POST /deep-analysis` → `unlocked:true`, debit YOK |
| 8 | `/koc` + `/koc/sohbet` görsel tarama | Coin/maliyet/bakiye UI yok ("kalan mesaj hakkı" soyutlaması serbest) |
| 9 | `disabled_ids="daily.mood-checkin"` → mood check-in yap → temizle | Görev listelenmez + grant edilmez; temizlenince listelenir ve koşul sağlanmışsa hemen grant |
| 10 | `economy.enabled=false` | Economy endpoint'leri 404; `/panel` pill+banner, `/profil` hub, `/analiz` kartı gizli; narration unlock satırına rağmen 403. Staging'de false bırakılır |

Webhook imza yardımcıları: `signFakeWebhook` (`fake-payments.adapter.ts`) veya eşdeğer node script
(`createHmac("sha256", PAYMENTS_WEBHOOK_SECRET).update(rawBody)`).

## Tests
```bash
pnpm db:up                              # e2e needs the local Postgres
pnpm --filter @mentor/api test          # vitest unit + e2e
```
CI runs the same against a Postgres service (see `.github/workflows/ci.yml`).

## Verification
```bash
curl http://localhost:3001/v1/health     # {"status":"ok",...}
# web  → http://localhost:3000   (brand shell, DESIGN tokens)
# admin→ http://localhost:3002   (admin shell)
pnpm typecheck && pnpm lint && pnpm build
```

## Ports
| App | Port |
|---|---|
| api | 3001 (`/v1`) |
| web | 3000 |
| admin | 3002 |
| postgres (docker) | 5433 → 5432 |

## Troubleshooting
- **`mixin.stripAnsi is not a function`** (on every command in Bash): noise from a global Angular shim;
  the command still runs. Use **PowerShell** for scaffolding/long commands.
- **`@mentor/ui` type error (dev):** packages must be built first → `pnpm build` (turbo orders `^build`)
  or `pnpm --filter @mentor/ui build`.
- **Next.js 16:** for breaking changes, see the per-app `AGENTS.md` → `node_modules/next/dist/docs/`.
- **pnpm 11 blocks native build scripts** → approve them in `pnpm-workspace.yaml > allowBuilds`
  (esbuild/sharp/@nestjs/core/unrs-resolver = true).
