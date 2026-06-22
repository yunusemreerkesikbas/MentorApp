# 0052 — Forum/Community slice 1 (zones + membership)

> Date: 2026-06-22 · Scope: api + packages (types/validation) · Related: roadmap §2/§4/§9, design [`docs/plans/2026-06-22-forum-community-design.md`](../plans/2026-06-22-forum-community-design.md), plan [`docs/plans/2026-06-22-forum-community-slice1-plan.md`](../plans/2026-06-22-forum-community-slice1-plan.md)

## What was done
- Pulled **forum/community** from Phase 2 into the MVP as a scoped slice (product decision, brainstorming 2026-06-22). New `forum` bounded context (`apps/api/src/modules/forum`).
- **One `Zone` primitive, three behaviours** (`ANNOUNCEMENT` / `CHAT` / `QA`) + **scoped membership** (`forum_zone_members` with per-zone `role` OWNER/MODERATOR/MEMBER and `status` ACTIVE/PENDING). "Mahalle" is a future config of the same model, not a new domain.
- **Two-plane authz** in framework-free `forum.policy.ts`: platform role (global override) vs zone role (scoped to one zone). Curated zone creation (staff only); external community leaders become a zone `OWNER`.
- **Join policies**: `OPEN` → ACTIVE instantly; `REQUEST` → PENDING + `forum.member.requested` event, approved by owner/mod (or staff override).
- Gated by **`forum.enabled`** feature flag (default off). XP/coin, threads/QA, search, report→moderation, verification, C-layer = later slices / Phase 2. **No coin in forum** (§4 #3).

## How to use (usage)
```bash
# enable the feature (admin, per-environment)
PATCH /v1/admin/config/forum.enabled { "value": true }

# staff creates a curated zone
POST /v1/forum/zones { "type": "QA", "title": "KPSS Genel", "joinPolicy": "OPEN" }
# hand a zone to an external community leader
POST /v1/forum/zones/:id/owner { "userId": "<uuid>" }
# user joins (OPEN→ACTIVE, REQUEST→PENDING); owner/staff approves a pending request
POST /v1/forum/zones/:id/join
POST /v1/forum/zones/:id/members/:userId/approve { "approve": true }
GET  /v1/forum/zones?type=QA&examType=KPSS&page=1&pageSize=20
```

## Gotchas
- **Migration not auto-applied here** (no local Postgres at dev time): run `pnpm db:up && pnpm --filter @mentor/api db:migrate` once. Migration `0021_flashy_vance_astro.sql` has hand-added RLS policies + `set_updated_at` triggers (drizzle-kit does not emit those — same pattern as `0010`).
- **RLS**: public-zone reads + own-membership reads run in **user context**; privileged writes and member-list reads run in **SERVICE context** and are policy-checked in the app first (double belt). A local superuser DB bypasses RLS — verify policies on Neon.
- **Slug** is server-derived from the title with a `Date.now()` base-36 suffix (keeps the unique constraint safe without a retry loop — curated, low volume). Clients never send a slug.
- **Tests need the DB**: the vitest `globalSetup` migrates a real Postgres before any spec, so even the pure `forum.policy.spec.ts` requires `pnpm db:up`. Run `pnpm --filter @mentor/api test` once the DB is up.
- **api-client not regenerated yet** (orval `openapi:export` boots the app/DB): run `pnpm --filter @mentor/api openapi:export && pnpm --filter @mentor/api-client generate` after the DB is up.

## Related files & decisions
- `apps/api/src/modules/forum/**` (policy, repository, service, controller, module, events)
- `apps/api/src/database/schema.ts` (`forumZones`, `forumZoneMembers`) · `apps/api/drizzle/0021_flashy_vance_astro.sql`
- `packages/types/src/forum.ts` · `packages/validation/src/forum.ts`
- `apps/api/src/common/config/config.catalog.ts` (`forum.enabled`)
- Decision: forum = curated (staff create zones, assign external OWNER); self-serve creation + private/invite + mahalle = Phase 2. SEO (QA indexable, chat noindex) + threads/QA = next slices.
