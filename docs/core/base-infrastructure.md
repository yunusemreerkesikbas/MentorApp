# Base Infrastructure

> The shared foundation every module builds on: monorepo skeleton, DB, errors, i18n, logging, health,
> OpenAPI, security, tests. Module: `apps/api` root + `shared/**`. Cross-cutting (not a feature).
> Full rationale: roadmap §8 (Turkish).

## Overview

The non-feature substrate: how the app boots, how it talks to Postgres, how errors/locales/logging are
shaped, how the API surface is documented, and how tests run. Everything in `docs/features/*` assumes
this layer is in place. It was built first (before any workstream) and hardened in a review pass.

## Architecture (key decisions)

- **Single DB driver:** one `pg` Pool via `drizzle-orm/node-postgres` — works local (docker) and Neon.
  No dual-driver abstraction (dropped early — it added ceremony without value).
- **RLS via `SET LOCAL`:** `withUserContext` / `withServiceContext` open a tx and set `app.user_id` /
  `app.role` for the connection → Postgres RLS policies see it. Local `mentor` superuser **bypasses**
  RLS (verify RLS-sensitive paths on Neon/prod).
- **Errors:** `ApiError` + typed `error-code.ts` (module-prefixed: `AUTH_…`, `PAYMENT_…`, …). pg errors
  mapped (`23505`→CONFLICT, `22007/22008`→400) so nothing leaks as a generic 500.
- **i18n:** `nestjs-i18n`, TR/EN locale files under `i18n/locales/`. **Logic + messages live backend-only**
  (engineering-principles §4/§5); the API returns localized `message` + a stable `code`.
- **Validation:** Zod is the single source (`@mentor/validation`), shared FE+BE.
- **Health:** `GET /v1/health` (filtered — excludes noisy downstreams).
- **OpenAPI:** `/v1/docs` (Swagger prod-gated behind env). orval codegen → `@mentor/api-client`.
- **Security:** per-route throttling (`@Throttle`), CORS (env), Sentry instrumentation, Turnstile where
  signup/Sybil risk exists. Global `JwtAuthGuard` (+`@Public`), `RolesGuard` (+`@Roles`), `@CurrentUser`.

## Tutorials / Guides

```bash
pnpm install
cp .env.example apps/api/.env          # API secrets (JWT_ACCESS_SECRET ≥32 chars, etc.)
pnpm db:up                             # local Postgres 16 + pgvector (host port 5433)
pnpm --filter @mentor/api db:migrate   # apply migrations
pnpm dev                               # api:3001 · web:3000 · admin:3002
```

```bash
# Regenerate API client after endpoint/contract changes:
pnpm --filter @mentor/api openapi:export && pnpm --filter @mentor/api-client generate

# Run the full backend suite (needs the local Postgres):
pnpm db:up && pnpm --filter @mentor/api test
```

## API (foundation endpoints)

- `GET /v1/health` — liveness/readiness (`@Public`).
- `GET /v1/docs` — OpenAPI/Swagger (dev only; prod-gated).
- All feature endpoints under `/v1/*`, versioned, Zod-validated, `ApiError` envelope, `RequestUser.id` RLS.

## Geliştirmeler (timeline)

- **CI hiç koşmuyormuş: sır taraması, build ve tip kapıları (APP-084, 2026-09-06)** — Amaç iki
  karanlık yüzeyi açmaktı ve `security-release-checklist.md`'nin ilk kapısı "Tam CI … yeşil" diyor.
  Yerelde altı test kırıktı, oradan başlandı; sonra **asıl bulgu** çıktı.
  **CI, lint/typecheck/build/test'e hiç ulaşmıyordu.** `gh run view`: her koşuda "Scan repository
  for secrets" **failure**, sonraki her adım **skipped**. gitleaks bir commit ARALIĞI tarıyor
  (`<base>^..<head>`) ama `actions/checkout@v4` varsayılan olarak derinlik 1 klonluyor, yani base'in
  ebeveyni checkout'ta yok: `fatal: ambiguous argument … unknown revision` → `failed to scan Git
  repository` → exit 1. Log'un kendisi **"no leaks found in partial scan"** diyor — hiçbir sır
  bulunmadı, tarama koşamadı bile. Düzeltme `fetch-depth: 0`.
  **Ne kadardır böyle:** sır tarama adımı APP-080'de, aynı gün eklendi — yani bu özel sebep bir
  günlük. Ama `gh run list` son 100 koşuda (23 Ağustos'a kadar) **hiç başarılı koşu göstermiyor**,
  yani CI ondan önce de başka bir sebeple kırmızıydı. Bu dilim bugünkü zinciri açıyor; kırmızının
  daha eski tarihi ayrıca bakılmayı hak ediyor.
  **Arkasındaki iki kapı da kırıkmış, kimse göremediği için.**
  **(1) `pnpm build`** admin'de düşüyordu: `theme.scss` içindeki CSS `@import url(...)` sass
  tarafından üretilen stylesheet'e taşınıyor, Next 16'nın Turbopack ayrıştırıcısı en başta olmayan
  bir `@import`'u reddediyor (sass'ın önüne koyduğu BOM içerik sayılıyor) →
  `Unexpected token AtKeyword("import")`. Font **`<link>` olarak da eklenemezdi**: admin CSP'si
  `style-src 'self' 'unsafe-inline'` ve `font-src 'self' data:` — yani o webfont CSP geldiğinden
  beri zaten yüklenmiyordu. Yüklenmeyecek bir `<link>` koymak düzeltme gibi görünüp hiçbir şey
  yapmazdı; webfont kaldırıldı, şablonun kendi yığını devraldı. Geri istenirse **self-host**
  (`font-src 'self'` zaten izinli), üçüncü taraf origin için CSP gevşetmek bir güvenlik kararı.
  **(2) `pnpm typecheck`** admin'de yedi hata veriyordu (`react-icons`: *Property 'className' does
  not exist on type 'IconBaseProps'*), ve **turbo bunu önbellekte saklıyordu** — yükseltmeden
  önceki geçen koşu hâlâ cache'teydi. Sebep repoda zaten çözülmüş bir sınıf: `apps/web/tsconfig`'in
  `paths.react` pin'i. Admin'de yoktu, dolayısıyla `react-icons` `SVGAttributes`'ı olmayan bir React
  ad alanına çözülüyordu. Aynı pin admin'e eklendi; `next build` sonrası hayatta kaldığı doğrulandı.
  `react-icons` 5.6→5.7 denendi, **çözmedi**, geri alındı — sorun sürüm değil çözümlemeydi.
  **Yan bulgu:** `apps/web/AGENTS.md` admin'i "React 18 (accepted deviation)" diye anlatıyordu;
  admin artık Next 16 / React 19. Not düzeltildi, çünkü tam da bu pin'i açıklayan yer.
  **Ve arkasında bir kapı daha vardı — ancak push edince görüldü.** Sır taraması düzelince CI ilk
  kez Test adımına ulaştı ve orada düştü: `globalSetup` migration'ı `ECONNREFUSED ...:5433`.
  CI'ın Postgres'i 5432'de ve workflow `TEST_DATABASE_URL`'i job seviyesinde veriyor, ama
  **`pnpm test` turbo'dan geçiyor ve Turbo 2 katı env modunda çalışıyor**: `turbo.json`'da
  tanımlanmayan bir değişken göreve **geçirilmiyor**. `globalEnv` yalnız `NODE_ENV` içeriyordu,
  dolayısıyla e2e kurulumu değişkeni hiç görmedi ve yerel docker-compose portuna (5433) düştü.
  Düzeltme: `tasks.test.env = ["TEST_DATABASE_URL"]`.
  **Yerelde neden görünmüyordu:** `pnpm --filter @mentor/api test` turbo'yu **atlıyor**, ve
  atlayınca fallback zaten doğru port. Doğrulama bilerek yanlış bir portla yapıldı (59999): pas
  geçiliyorsa suite 5433'e düşer, geçiyorsa 59999'a çarpar — 59999'a çarptı.
  **Not (takip):** `NEXT_PUBLIC_SITE_URL` ve `NEXT_PUBLIC_GA_MEASUREMENT_ID` de workflow'da
  tanımlı ama `turbo.json`'da değil, yani `build` görevine de geçmiyorlar. Build yeşil olduğu için
  bu dilimde dokunulmadı; üretim derlemesi Render'da ayrı koştuğu için etkisi CI'la sınırlı, ama
  workflow'un niyeti ile turbo'nun davranışı ayrışıyor.
  **Ve bir kapı daha, aynı sınıftan.** DB bağlantısı düzelince API suite'i geçti, hata **web'e**
  taştı: `canonical-urls.spec.ts` `http://localhost:3000` bekliyor, CI ise
  `NEXT_PUBLIC_SITE_URL=https://mentor.example` veriyor (Turbo `NEXT_PUBLIC_*`'ı framework çıkarımıyla
  zaten geçiriyor). Beklenen değer aslında değişken **tanımsızken** dönen fallback'ti — yani test
  dizüstünde geçip CI'da düşüyordu. `docs/standards/backend.md`'nin `STORAGE_PROVIDER` için
  kaydettiği tuzağın aynısı. Düzeltme kardeş `site-url.spec.ts`'in deseni: `vi.stubEnv` ile origin
  spec'te sabitleniyor, böylece dosyanın konusu ne olduğu şeye — **yol biçimine** — geri dönüyor.
  Yerelde CI'ın değişkeni verilerek doğrulandı.
  **Ve son kapı: `express` bildirilmemiş bir bağımlılıktı.** Web yeşile dönünce API'de beş dosya
  *dosya seviyesinde* düştü (tek bir test kırılmadan):
  `Failed to load url express … in src/common/http/body-parsers.ts`. `apps/api` `express`'i
  **dependencies'inde taşımıyordu**; yalnız `@types/express` devDependency olarak vardı.
  Kaynaktaki diğer bütün kullanımlar `import type` (derlemede siliniyor), ama `body-parsers.ts` bir
  **değer** import'u yapıyor — yani çalışma zamanında gerçekten gerekiyor ve üretimde sadece
  `@nestjs/platform-express`'in getirdiği paketi pnpm yerleşimi sayesinde buluyordu. Vite'ın
  çözümleyicisi temiz kurulumda buna müsamaha etmiyor. `apps/api`'ye `express` eklendi.
  **Üçü zaten kırıktı:** `payments`/`promotions`/`economy-invite` spec'leri kendileri
  `import * as express` yapıyor, yani bu dilimden bağımsız olarak temiz kurulumda düşerlerdi —
  Test adımı hep atlandığı için hiç görülmemişti.
  **Ders:** yeşil bir CI rozeti "testler geçti" demiyor. Bu koşularda **hiçbir test koşmadı**, ve
  rozet kırmızıydı ama kırmızılığın sebebi herkesin sandığı yer değildi.
  **İlgili:** `.github/workflows/ci.yml`, `apps/admin/{tsconfig.json,src/assets/scss/theme.scss,src/app/layout.js}`,
  `apps/web/AGENTS.md`, [`security-release-checklist.md`](./security-release-checklist.md).

- **Project initialization** — Turborepo + pnpm monorepo skeleton (`apps/*` + `packages/*`), queue +
  RLS foundational decisions. *(Original devnote 0001.)*
- **Core/base infrastructure** — `db` (pg Pool)/errors/i18n/logging/security/OpenAPI/health/tests; the
  dual-driver was dropped in favor of a single `pg` Pool. *(0007.)*
- **Base review fixes** — health filter exclusion, Swagger prod-gate, CORS env, validation i18n,
  Sentry instrument, negative e2e. *(0008.)*
- **2026-09-05: Privacy-safe diagnostics and production startup locks** — HTTP logs allow only
  method/path (without query strings or upload capabilities), UUID request ID, status and duration.
  Application logs retain module context, stable error codes and error-frame fingerprints; arbitrary
  message text, headers, bodies, user identifiers and raw exception/provider payloads are discarded.
  Sentry receives scrubbed error events only, without automatic request/SQL tracing or breadcrumbs.
  Usage: correlate failures using the response `x-request-id` and safe error fingerprint; use structured
  error metadata for new diagnostics. Gotcha: legacy freeform log prose is intentionally omitted.
  Production now requires HTTPS `APP_URL`, explicit HTTPS `CORS_ORIGINS`, a Turnstile secret and
  `TURNSTILE_EXPECTED_HOSTNAME` matching the app host. The signup widget uses action `signup`;
  `TURNSTILE_VERIFY_TIMEOUT_MS` bounds provider verification (default 5000 ms), including response reads.
  Invalid/missing tokens, wrong hostname/action, HTTP errors and timeouts fail closed. Startup also
  inspects the runtime database role and rejects superuser, BYPASSRLS, CREATEROLE, ownership of application
  tables/schemas/database, and memberships that grant those privileges. Deploy with separate restricted
  runtime and migration-owner credentials; changing environment files alone does not provision roles.
  Local development/test without Turnstile continues working, and only production inspects DB roles.
  Validation: negative unit tests with in-memory log streams, mocked Siteverify and mocked DB queries;
  no remote services, role changes or migrations run during those tests. Related files:
  `apps/api/src/observability/*`, `instrument.ts`, `common/filters/all-exceptions.filter.ts`,
  `config/env*.ts`, `modules/identity/application/turnstile.service.ts`, `database/database-role-safety.ts`,
  `database/database.module.ts`, `.env.example`, `render.yaml`.
- **2026-09-05: Güvenlik tabanı, bağımlılıklar ve CI kapıları** — Web ve admin Next.js 16.3.4,
  React 19.2.8 tabanına alındı; admin Bootstrap görünümü korundu. Drizzle, Sentry, axios, multer ve
  alt bağımlılıklar güvenli sürümlere taşındı; üretim bağımlılık taraması bilinen açık olmadan geçti.
  CI artık yüksek önem düzeyinde üretim bağımlılığı taraması ve gitleaks sır taraması çalıştırıyor.
  `0102_security-hardening` migration'ı sunucu oturumları, Google link niyetleri, push teslimat claim'leri
  ve yükleme yetkilerini ekliyor ve RLS'yi ENABLE+FORCE yapıyor. OpenAPI export, DTO ile bağlanan eksik
  yol parametrelerini de geçerli sözleşmeye tamamlıyor. Kullanım: endpoint değişikliğinden sonra normal
  export+orval komutunu çalıştır. Gotcha: bağımlılık taramasının yeşil olması uygulama mantığının veya
  gerçek Cloudflare/Render/Neon ayarlarının güvenli olduğunu tek başına kanıtlamaz. Yayın öncesi dış
  ortam adımları için [security-release-checklist.md](./security-release-checklist.md) kullanılır.

## Gotchas / Known issues

- **Local RLS masking:** `mentor` DB user is superuser → RLS bypassed locally; always verify
  RLS-sensitive reads (admin drafts, public forum reads) on Neon/prod.
- **Throttling was once a no-op** (real bug, fixed): `ThrottlerModule` with an empty `throttlers:[]`
  silently disabled `@Throttle`. Fixed by a named `default` throttler so route overrides apply.
- **Windows e2e boot** can exceed 10s → vitest `hookTimeout: 30s`.
- **Migration journal discipline:** commit each migration **with its snapshot + a real timestamp**,
  forward-only, never edit an applied migration (a cross-track journal-ordering corruption hit twice —
  0006/0008/0013; reconciled in the mood devnote).
- **Known pre-existing failure (W1):** `health-down.e2e` boots with an unreachable DB, but
  `SubjectSeedService.onModuleInit` (content) eagerly queries → `app.init()` throws before readiness
  assertions run. Fix = make the seed boot-resilient (W1 backlog).

## Related

- [architecture.md](./architecture.md) · [repo-and-conventions.md](./repo-and-conventions.md)
- Standards: [backend.md](../standards/backend.md) · [api.md](../standards/api.md) · [engineering-principles.md](../standards/engineering-principles.md)
- Setup: [setup.md](./setup.md) · Integrations: [integrations.md](./integrations.md)
