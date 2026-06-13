# 0020 — W6 · Config Registry + Feature Flags

> Date: 2026-06-12 · Scope: api (common/config + admin) + admin UI + db · Related: roadmap §9, engineering-principles §2/§8, workstreams W6

## What was done
- **Central config registry** (`common/config`, `@Global() ConfigRegistryModule`) — the mechanism for
  tunable values + **feature flags** (engineering-principles §2/§8, roadmap §9). Distinct from
  `@nestjs/config` (env/secrets, boot-time fail-fast): this is runtime, admin-editable business config.
- **Code-defined catalog** [`config.catalog.ts`]: `CONFIG_CATALOG` key→{ category, type, Zod schema,
  default, sensitive, description }. Admins can't invent keys; values validated against the key's
  schema (bounds live in the schema). Seeded **only real feature flags** (YAGNI): `ai.enabled` (true,
  §4/§8 AI kill-switch), `economy.enabled` (false), `signup.enabled` (true). `FeatureFlag` key consts
  exported for consumers.
- **`ConfigRegistryService`**: typed `get<K>(key)` (override ?? default, **z.infer**-typed return),
  `list()` (catalog + effective values for admin UI), `set(actor,key,value)` (validate → upsert →
  cache-invalidate, returns before/after). **In-memory cache** (lazy load, invalidate-on-write);
  process-scoped — fine for the MVP single Render instance, multi-instance invalidation is Phase 2.
- **DB:** `config_overrides` (key PK, value jsonb, updated_by, updated_at) — **overrides only**, not the
  whole catalog. Migration `0009`; RLS SERVICE/ADMIN (read+write). 
- **Admin editing** (`admin` module, `AdminConfigController`, `@Roles(ADMIN)` + audit): `GET /admin/config`
  (grouped catalog+values) · `PATCH /admin/config/:key` `{value}` → `@Audit('config.update')`
  (before/after; flag values non-PII). Errors `ADMIN_CONFIG_KEY_NOT_FOUND` (404) /
  `ADMIN_CONFIG_INVALID_VALUE` (400), TR/EN.
- **Admin UI (TS):** `/config` page — flags as toggles (boolean), inline input for number/string,
  sensitive → SweetAlert2 confirm; "Ayarlar" menu item. `ConfigEntry` type in `src/lib/types.ts`.
- **No consumers wired this slice** (workstream boundaries): modules that read flags call
  `configRegistry.get(FeatureFlag.X)` in their own slice (e.g. economy gates on `economy.enabled`).

## How to use (usage)
```ts
// Any module (ConfigRegistryModule is @Global): inject + read, typed.
constructor(private readonly config: ConfigRegistryService) {}
if (await this.config.get(FeatureFlag.AI_ENABLED)) { /* … */ }
```
```bash
# Admin: /config → toggle a flag (audited). Add a new tunable = add a key to config.catalog.ts.
```

## Gotchas
- **Cache is per-process** → a flag change is instant on the instance that served the PATCH; other
  instances pick it up on next cold read. MVP = 1 instance, so fine; Phase 2 = pub/sub or short TTL.
- **Catalog is the source of truth** — never insert config_overrides rows by hand for keys absent from
  the catalog; `get` would ignore them and `set` rejects them (404).
- Sensitive (money/coin/commission) keys: put **bounds in the Zod schema** + set `sensitive:true` (UI
  confirms). None seeded yet (economy not built).
- Migration ordering: `0009` clean (0008 snapshot already healed the W5 baseline — see devnote 0018).

## Related files & decisions
- `apps/api/src/common/config/**` (catalog · repository · service · module) · `database/schema.ts`
  (`config_overrides`) · `drizzle/0009_w6_config_overrides.sql` · `app.module.ts` (global import)
- `apps/api/src/modules/admin/presentation/admin-config.controller.ts` · `packages/validation/src/admin.ts`
- `apps/admin/src/app/(general)/config/page.tsx` · `src/lib/types.ts`
- **Verified:** unit 6/6 (registry) + admin unit 10 + e2e 16 (incl. config list/update/400/404/403 +
  audit) green; admin typecheck + build green; lint clean; live (Claude_Preview) — `/config` toggle
  `economy.enabled` → persisted + audit `config.update`, restore OK.
- Decision: feature flags ARE config-registry entries (one mechanism, not two).

## Code-review fixes / decisions (this slice)
- **(F1, §4 #7 org-readiness — DECISION):** `config_overrides` is **global platform config by design**
  (no `org_id`). Per-org/B2B overrides will use the existing **`organizations.settings`** jsonb (already
  org-ready) — NOT this table. So §4 #7 is satisfied without retrofitting `org_id` into the registry.
  Documented in `config.catalog.ts` SCOPE note.
- **(F3) Secrets guardrail:** the registry must NEVER hold secrets — values are plaintext in DB + in the
  audit trail. Secrets stay in env only. Guardrail comment added to `config.catalog.ts`.
- **(F4) Type accuracy:** repo upsert no longer casts `value as object` (wrong for primitive flag
  values) — uses the jsonb column's insert type.
- Backlog: re-validate overrides on read against the (possibly evolved) catalog schema (F2); cache the
  in-flight load promise (F5); optionally Turkish catalog descriptions (F6).
