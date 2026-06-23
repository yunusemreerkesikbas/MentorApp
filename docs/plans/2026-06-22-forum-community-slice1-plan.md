# Forum/Community — Slice 1 (Zone + Membership Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `forum` bounded context with the Zone + membership spine: staff-created public zones, external OWNER assignment, join (`OPEN` instant / `REQUEST` → owner-approved), all behind a `forum.enabled` feature flag.

**Architecture:** New NestJS module `apps/api/src/modules/forum` (Pragmatic Clean: `presentation/application/infrastructure/domain`). DB access only via repository with `withUserContext`/`withServiceContext` (double-belt RLS). Authz isolated in a framework-free `forum.policy.ts`. No cross-module table access.

**Tech Stack:** TypeScript · NestJS · Drizzle + Neon Postgres (pg Pool) · Zod (`@mentor/validation`) · shared enums (`@mentor/types`) · Vitest (`*.spec.ts`).

## Global Constraints

- All routes under `/v1` (global prefix), backward-compatible. Input validated with Zod at the boundary; DTOs via `createZodDto`.
- DB access only via repository; every tenant query runs through `withUserContext` / `withServiceContext` (`apps/api/src/database/rls.ts`) — app filter **+** Postgres RLS.
- Schema changes via `pnpm --filter @mentor/api db:generate` (Drizzle), forward-only; RLS policies + `set_updated_at()` trigger hand-added to the generated SQL (matches `0010_w6_economy_ledger.sql`).
- Lists paginated (`paginationQuerySchema`, max 100). Error shape `ApiError { code, message, details? }`; user-facing copy localized server-side.
- `snake_case` DB columns / `camelCase` TS; tables appended to `database/schema.ts` in a `/* ===== forum ===== */` block (append-only shared surface).
- Guardrails (§4): **no coin** anywhere in forum; `org_id` nullable from day one; external OWNER scoped to one zone (no admin panel / no PII / no other zones).
- CI gate: `pnpm typecheck && pnpm lint && pnpm build` green; devnote added at slice end.

---

### Task 1: Shared enums + validation schemas

**Files:**
- Create: `packages/types/src/forum.ts`
- Modify: `packages/types/src/index.ts` (re-export forum)
- Create: `packages/validation/src/forum.ts`
- Modify: `packages/validation/src/index.ts` (re-export forum)
- Test: `packages/validation/src/forum.spec.ts`

**Interfaces:**
- Produces: `ZoneType` (`ANNOUNCEMENT|CHAT|QA`), `ZoneVisibility` (`PUBLIC|PRIVATE`), `ZoneJoinPolicy` (`OPEN|REQUEST`), `ZoneRole` (`OWNER|MODERATOR|MEMBER`), `ZoneMemberStatus` (`ACTIVE|PENDING`) as const-objects (match `Currency` style). Zod: `createZoneSchema`, `assignOwnerSchema`, `zoneListQuerySchema`, `joinZoneSchema` (none → empty), `approveMemberSchema`.

- [ ] **Step 1: Write the failing test** (`packages/validation/src/forum.spec.ts`)

```ts
import { describe, expect, it } from "vitest";
import { createZoneSchema, zoneListQuerySchema } from "./forum";
import { ZoneType, ZoneJoinPolicy } from "@mentor/types";

describe("forum validation", () => {
  it("accepts a valid zone create", () => {
    const parsed = createZoneSchema.parse({
      type: ZoneType.QA, title: "KPSS Genel", joinPolicy: ZoneJoinPolicy.OPEN,
    });
    expect(parsed.title).toBe("KPSS Genel");
    expect(parsed.joinPolicy).toBe("OPEN");
  });
  it("rejects an unknown zone type", () => {
    expect(() => createZoneSchema.parse({ type: "FOO", title: "x" })).toThrow();
  });
  it("defaults list query page/pageSize", () => {
    const q = zoneListQuerySchema.parse({});
    expect(q.page).toBe(1);
    expect(q.pageSize).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test → fails** (module not found)

Run: `pnpm --filter @mentor/validation test -- forum`
Expected: FAIL (cannot find `./forum`).

- [ ] **Step 3: Add the const enums** (`packages/types/src/forum.ts`)

```ts
/** Forum module contracts (Phase-2-pulled-to-MVP). Shared api + web/admin. */
export const ZoneType = { ANNOUNCEMENT: "ANNOUNCEMENT", CHAT: "CHAT", QA: "QA" } as const;
export type ZoneType = (typeof ZoneType)[keyof typeof ZoneType];

export const ZoneVisibility = { PUBLIC: "PUBLIC", PRIVATE: "PRIVATE" } as const;
export type ZoneVisibility = (typeof ZoneVisibility)[keyof typeof ZoneVisibility];

export const ZoneJoinPolicy = { OPEN: "OPEN", REQUEST: "REQUEST" } as const;
export type ZoneJoinPolicy = (typeof ZoneJoinPolicy)[keyof typeof ZoneJoinPolicy];

export const ZoneRole = { OWNER: "OWNER", MODERATOR: "MODERATOR", MEMBER: "MEMBER" } as const;
export type ZoneRole = (typeof ZoneRole)[keyof typeof ZoneRole];

export const ZoneMemberStatus = { ACTIVE: "ACTIVE", PENDING: "PENDING" } as const;
export type ZoneMemberStatus = (typeof ZoneMemberStatus)[keyof typeof ZoneMemberStatus];

export interface ZoneView {
  id: string;
  type: ZoneType;
  title: string;
  slug: string;
  description: string | null;
  visibility: ZoneVisibility;
  joinPolicy: ZoneJoinPolicy;
  examType: string | null;
  isArchived: boolean;
  memberCount: number;
  myStatus: ZoneMemberStatus | null; // viewer's membership status, null if none
  createdAt: string;
}
```

Add to `packages/types/src/index.ts`: `export * from "./forum.js";`

- [ ] **Step 4: Add the Zod schemas** (`packages/validation/src/forum.ts`)

```ts
import { z } from "zod";
import { ZoneType, ZoneJoinPolicy } from "@mentor/types";
import { paginationQuerySchema } from "./pagination";

export const createZoneSchema = z.object({
  type: z.nativeEnum(ZoneType),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  examType: z.string().trim().max(32).optional(),
  joinPolicy: z.nativeEnum(ZoneJoinPolicy).default(ZoneJoinPolicy.OPEN),
});
export type CreateZone = z.infer<typeof createZoneSchema>;

export const assignOwnerSchema = z.object({ userId: z.string().uuid() });
export type AssignOwner = z.infer<typeof assignOwnerSchema>;

export const approveMemberSchema = z.object({ approve: z.boolean() });
export type ApproveMember = z.infer<typeof approveMemberSchema>;

export const zoneListQuerySchema = paginationQuerySchema.extend({
  type: z.nativeEnum(ZoneType).optional(),
  examType: z.string().trim().max(32).optional(),
});
export type ZoneListQuery = z.infer<typeof zoneListQuerySchema>;
```

Add to `packages/validation/src/index.ts`: `export * from "./forum";`

- [ ] **Step 5: Run test → passes**

Run: `pnpm --filter @mentor/validation test -- forum`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/forum.ts packages/types/src/index.ts packages/validation/src/forum.ts packages/validation/src/index.ts packages/validation/src/forum.spec.ts
git commit -m "feature/APP-012 forum slice1: shared zone enums + validation"
```

---

### Task 2: Schema + migration (zones + memberships + RLS)

**Files:**
- Modify: `apps/api/src/database/schema.ts` (append `/* ===== forum ===== */` block)
- Create (generated then hand-edited): `apps/api/drizzle/00NN_forum_zones.sql`

**Interfaces:**
- Produces: Drizzle tables `forumZones`, `forumZoneMembers` with `$inferSelect`/`$inferInsert`.

- [ ] **Step 1: Append tables to `schema.ts`**

```ts
/* ============================== forum ==============================
 * Zone primitive (announcement/chat/qa) + scoped membership (owner/mod/member).
 * org_id nullable from day one; visibility PUBLIC in MVP (PRIVATE reserved).
 * RLS: read public zones (any authed) ; writes via service/policy. Phase 2 adds
 * threads/posts/reactions/reports/moderation_actions.
 * ================================================================== */
export const forumZones = pgTable(
  "forum_zones",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    type: text("type").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    visibility: text("visibility").notNull().default("PUBLIC"),
    joinPolicy: text("join_policy").notNull().default("OPEN"),
    examType: text("exam_type"),
    organizationId: uuid("organization_id").references(() => organizations.id),
    createdBy: uuid("created_by").references(() => users.id),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_zones_slug_idx").on(t.slug),
    index("forum_zones_type_idx").on(t.type),
  ],
);

export const forumZoneMembers = pgTable(
  "forum_zone_members",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    zoneId: uuid("zone_id").notNull().references(() => forumZones.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    role: text("role").notNull().default("MEMBER"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_zone_members_unique_idx").on(t.zoneId, t.userId),
    index("forum_zone_members_zone_status_idx").on(t.zoneId, t.status),
  ],
);
```

- [ ] **Step 2: Generate migration**

Run: `pnpm --filter @mentor/api db:generate`
Expected: new `apps/api/drizzle/00NN_forum_zones.sql` created.

- [ ] **Step 3: Hand-add RLS + updated_at trigger to the generated SQL** (append, matching `0010_w6_economy_ledger.sql` style)

```sql
-- ===================== RLS (§6/§4 #7) — zones + scoped membership =====================
ALTER TABLE "forum_zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_zones" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Read: any authenticated user sees PUBLIC, non-archived zones; SERVICE/ADMIN see all.
CREATE POLICY forum_zones_read ON "forum_zones" FOR SELECT
  USING (
    (visibility = 'PUBLIC' AND is_archived = false AND current_setting('app.user_id', true) <> '')
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY forum_zones_write ON "forum_zones" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "forum_zone_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_zone_members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Read: a user sees their own membership rows; SERVICE/ADMIN see all (owner member-list runs in service).
CREATE POLICY forum_zone_members_read ON "forum_zone_members" FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY forum_zone_members_write ON "forum_zone_members" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
CREATE TRIGGER set_forum_zones_updated_at BEFORE UPDATE ON "forum_zones"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_forum_zone_members_updated_at BEFORE UPDATE ON "forum_zone_members"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 4: Apply + verify**

Run: `pnpm --filter @mentor/api db:migrate` (or the repo's migrate script)
Expected: migration applies; `forum_zones` + `forum_zone_members` exist with RLS enabled.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/schema.ts apps/api/drizzle
git commit -m "feature/APP-012 forum slice1: zones + memberships schema + RLS migration"
```

---

### Task 3: Feature flag

**Files:**
- Modify: `apps/api/src/common/config/config.catalog.ts`

**Interfaces:**
- Produces: config key `"forum.enabled"` (default `false`) + `FeatureFlag.FORUM_ENABLED`.

- [ ] **Step 1: Add the flag to `CONFIG_CATALOG`**

```ts
  "forum.enabled": flag(false, "Gate for the forum/community module (zones, threads, moderation)."),
```

- [ ] **Step 2: Add the constant to `FeatureFlag`**

```ts
  FORUM_ENABLED: "forum.enabled",
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @mentor/api typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/config/config.catalog.ts
git commit -m "feature/APP-012 forum slice1: forum.enabled feature flag"
```

---

### Task 4: Authz policy (framework-free, the critical logic)

**Files:**
- Create: `apps/api/src/modules/forum/domain/forum.policy.ts`
- Test: `apps/api/src/modules/forum/domain/forum.policy.spec.ts`

**Interfaces:**
- Consumes: `ZoneRole` (`@mentor/types`), platform roles (`UserRole`).
- Produces:
  - `type ForumActor = { userId: string; platformRoles: string[]; zoneRole: ZoneRole | null }`
  - `isPlatformStaff(roles: string[]): boolean` — true for ADMIN/SUPER_ADMIN/MODERATOR/EDITOR/STAFF.
  - `canModerateZone(actor: ForumActor): boolean` — platform staff OR zone OWNER/MODERATOR.
  - `canCreateZone(roles: string[]): boolean` — platform staff only.
  - `canApproveMember(actor: ForumActor): boolean` — same as canModerateZone.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { UserRole, ZoneRole } from "@mentor/types";
import { canCreateZone, canModerateZone, isPlatformStaff } from "./forum.policy";

const actor = (platformRoles: string[], zoneRole: ZoneRole | null = null) => ({
  userId: "u1", platformRoles, zoneRole,
});

describe("forum.policy", () => {
  it("only platform staff create zones", () => {
    expect(canCreateZone([UserRole.ADMIN])).toBe(true);
    expect(canCreateZone([UserRole.MODERATOR])).toBe(true);
    expect(canCreateZone([UserRole.STUDENT])).toBe(false);
  });
  it("zone owner can moderate own zone", () => {
    expect(canModerateZone(actor([UserRole.STUDENT], ZoneRole.OWNER))).toBe(true);
    expect(canModerateZone(actor([UserRole.STUDENT], ZoneRole.MODERATOR))).toBe(true);
    expect(canModerateZone(actor([UserRole.STUDENT], ZoneRole.MEMBER))).toBe(false);
    expect(canModerateZone(actor([UserRole.STUDENT], null))).toBe(false);
  });
  it("platform staff moderate any zone regardless of zone role", () => {
    expect(canModerateZone(actor([UserRole.ADMIN], null))).toBe(true);
  });
  it("isPlatformStaff excludes plain students", () => {
    expect(isPlatformStaff([UserRole.STUDENT])).toBe(false);
    expect(isPlatformStaff([UserRole.EDITOR])).toBe(true);
  });
});
```

- [ ] **Step 2: Run → fails**

Run: `pnpm --filter @mentor/api test -- forum.policy`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `forum.policy.ts`**

```ts
import { UserRole, ZoneRole } from "@mentor/types";

export interface ForumActor {
  userId: string;
  platformRoles: string[];
  zoneRole: ZoneRole | null;
}

const STAFF_ROLES: readonly string[] = [
  UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR, UserRole.EDITOR, UserRole.STAFF,
];

export function isPlatformStaff(roles: string[]): boolean {
  return roles.some((r) => STAFF_ROLES.includes(r));
}

/** Zone creation + OWNER assignment is curated — platform staff only (MVP). */
export function canCreateZone(roles: string[]): boolean {
  return isPlatformStaff(roles);
}

/** Moderate/approve within a zone: platform staff (override) OR that zone's OWNER/MODERATOR. */
export function canModerateZone(actor: ForumActor): boolean {
  if (isPlatformStaff(actor.platformRoles)) return true;
  return actor.zoneRole === ZoneRole.OWNER || actor.zoneRole === ZoneRole.MODERATOR;
}

export const canApproveMember = canModerateZone;
```

- [ ] **Step 4: Run → passes**

Run: `pnpm --filter @mentor/api test -- forum.policy`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/forum/domain/forum.policy.ts apps/api/src/modules/forum/domain/forum.policy.spec.ts
git commit -m "feature/APP-012 forum slice1: zone authz policy (framework-free)"
```

---

### Task 5: Repository

**Files:**
- Create: `apps/api/src/modules/forum/infrastructure/forum-zone.repository.ts`
- Test: `apps/api/src/modules/forum/infrastructure/forum-zone.repository.spec.ts` (integration, skipped if no DB — guard like existing repo specs)

**Interfaces:**
- Consumes: `DRIZZLE`, `withUserContext`/`withServiceContext`, schema tables.
- Produces (`ForumZoneRepository`):
  - `createZone(input: { type; title; slug; description?; examType?; joinPolicy; createdBy }): Promise<ZoneRow>`
  - `findBySlug(slug, viewerId): Promise<ZoneRow | null>`
  - `listPublic(viewerId, { page, pageSize, type?, examType? }): Promise<{ items: ZoneRow[]; total: number }>`
  - `upsertMember(zoneId, userId, role, status): Promise<MemberRow>` (idempotent on (zone,user) via onConflictDoUpdate)
  - `findMembership(zoneId, userId): Promise<MemberRow | null>`
  - `listMembers(zoneId, status?): Promise<MemberRow[]>` (service-context; caller checks policy)
  - `setMemberStatus(zoneId, userId, status): Promise<void>`
  - `memberCount(zoneId): Promise<number>`

- [ ] **Step 1: Implement the repository** (reads run in user context for RLS self-read; privileged writes/listMembers in service context — mirror `LedgerRepository`)

```ts
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { ZoneMemberStatus, ZoneRole } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { forumZoneMembers, forumZones } from "../../../database/schema";

export type ZoneRow = typeof forumZones.$inferSelect;
export type MemberRow = typeof forumZoneMembers.$inferSelect;

@Injectable()
export class ForumZoneRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createZone(input: {
    type: string; title: string; slug: string; description?: string | null;
    examType?: string | null; joinPolicy: string; createdBy: string;
  }): Promise<ZoneRow> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.insert(forumZones).values({
        type: input.type, title: input.title, slug: input.slug,
        description: input.description ?? null, examType: input.examType ?? null,
        joinPolicy: input.joinPolicy, createdBy: input.createdBy,
      }).returning();
      return row;
    });
  }

  async findBySlug(slug: string, viewerId: string): Promise<ZoneRow | null> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const [row] = await tx.select().from(forumZones).where(eq(forumZones.slug, slug)).limit(1);
      return row ?? null;
    });
  }

  async listPublic(
    viewerId: string,
    opts: { page: number; pageSize: number; type?: string; examType?: string },
  ): Promise<{ items: ZoneRow[]; total: number }> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const conds = [];
      if (opts.type) conds.push(eq(forumZones.type, opts.type));
      if (opts.examType) conds.push(eq(forumZones.examType, opts.examType));
      const where = conds.length ? and(...conds) : undefined;
      const items = await tx.select().from(forumZones).where(where)
        .orderBy(desc(forumZones.createdAt))
        .limit(opts.pageSize).offset((opts.page - 1) * opts.pageSize);
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` }).from(forumZones).where(where);
      return { items, total: count };
    });
  }

  async upsertMember(zoneId: string, userId: string, role: string, status: string): Promise<MemberRow> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.insert(forumZoneMembers)
        .values({ zoneId, userId, role, status })
        .onConflictDoUpdate({
          target: [forumZoneMembers.zoneId, forumZoneMembers.userId],
          set: { role, status, updatedAt: new Date() },
        }).returning();
      return row;
    });
  }

  async findMembership(zoneId: string, userId: string): Promise<MemberRow | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const [row] = await tx.select().from(forumZoneMembers)
        .where(and(eq(forumZoneMembers.zoneId, zoneId), eq(forumZoneMembers.userId, userId)))
        .limit(1);
      return row ?? null;
    });
  }

  async listMembers(zoneId: string, status?: string): Promise<MemberRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const conds = [eq(forumZoneMembers.zoneId, zoneId)];
      if (status) conds.push(eq(forumZoneMembers.status, status));
      return tx.select().from(forumZoneMembers).where(and(...conds))
        .orderBy(desc(forumZoneMembers.createdAt));
    });
  }

  async setMemberStatus(zoneId: string, userId: string, status: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.update(forumZoneMembers).set({ status, updatedAt: new Date() })
        .where(and(eq(forumZoneMembers.zoneId, zoneId), eq(forumZoneMembers.userId, userId)));
    });
  }

  async memberCount(zoneId: string): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` })
        .from(forumZoneMembers)
        .where(and(eq(forumZoneMembers.zoneId, zoneId), eq(forumZoneMembers.status, ZoneMemberStatus.ACTIVE)));
      return count;
    });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @mentor/api typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/forum/infrastructure/forum-zone.repository.ts
git commit -m "feature/APP-012 forum slice1: zone repository"
```

---

### Task 6: Service (orchestration + flag + policy)

**Files:**
- Create: `apps/api/src/modules/forum/application/forum.service.ts`
- Test: `apps/api/src/modules/forum/application/forum.service.spec.ts`

**Interfaces:**
- Consumes: `ForumZoneRepository`, `ConfigRegistryService`, policy fns.
- Produces (`ForumService`):
  - `assertEnabled(): Promise<void>` — throws `DomainError(FORUM_DISABLED, 404)` when flag off.
  - `createZone(actorRoles, actorId, dto: CreateZone): Promise<ZoneView>` — policy `canCreateZone`, slugify title (unique-suffix on conflict), creator becomes nothing (staff isn't a member); returns view.
  - `assignOwner(actorRoles, zoneId, targetUserId): Promise<void>` — policy `canCreateZone`; `upsertMember(OWNER, ACTIVE)`.
  - `join(zoneId, userId): Promise<{ status: ZoneMemberStatus }>` — `OPEN` → ACTIVE, `REQUEST` → PENDING; idempotent.
  - `approveMember(actor, zoneId, targetUserId, approve): Promise<void>` — policy `canApproveMember`; approve→ACTIVE, reject→remove/PENDING→none.
  - `listZones(viewerId, query): Promise<Paginated<ZoneView>>`
  - `getZone(viewerId, slug): Promise<ZoneView>`
- Produces event: emits `forum.member.requested` (notifications listener wired in a later slice — declare topic now in `domain/forum.events.ts`).

- [ ] **Step 1: Write the failing test** (mock repo + config)

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { HttpStatus } from "@nestjs/common";
import { UserRole, ZoneJoinPolicy, ZoneMemberStatus, ZoneType } from "@mentor/types";
import { ForumService } from "./forum.service";

const makeRepo = () => ({
  createZone: vi.fn().mockResolvedValue({
    id: "z1", type: "QA", title: "T", slug: "t", description: null, visibility: "PUBLIC",
    joinPolicy: "OPEN", examType: null, isArchived: false, createdAt: new Date(),
  }),
  findBySlug: vi.fn(), listPublic: vi.fn(), upsertMember: vi.fn().mockResolvedValue({}),
  findMembership: vi.fn().mockResolvedValue(null), listMembers: vi.fn(),
  setMemberStatus: vi.fn(), memberCount: vi.fn().mockResolvedValue(0),
});
const enabledConfig = { get: vi.fn().mockResolvedValue(true) };
const events = { emit: vi.fn() };

describe("ForumService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let svc: ForumService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new ForumService(repo as any, enabledConfig as any, events as any);
  });

  it("blocks zone creation for non-staff", async () => {
    await expect(svc.createZone([UserRole.STUDENT], "u1", {
      type: ZoneType.QA, title: "Genel", joinPolicy: ZoneJoinPolicy.OPEN,
    } as any)).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
  });

  it("staff creates a zone", async () => {
    const view = await svc.createZone([UserRole.ADMIN], "u1", {
      type: ZoneType.QA, title: "Genel", joinPolicy: ZoneJoinPolicy.OPEN,
    } as any);
    expect(repo.createZone).toHaveBeenCalled();
    expect(view.id).toBe("z1");
  });

  it("OPEN join is immediately ACTIVE", async () => {
    repo.findBySlug.mockResolvedValue(undefined);
    const r = await svc.join("z1", "u2", ZoneJoinPolicy.OPEN);
    expect(r.status).toBe(ZoneMemberStatus.ACTIVE);
    expect(repo.upsertMember).toHaveBeenCalledWith("z1", "u2", expect.any(String), ZoneMemberStatus.ACTIVE);
  });

  it("REQUEST join is PENDING and emits an event", async () => {
    const r = await svc.join("z1", "u2", ZoneJoinPolicy.REQUEST);
    expect(r.status).toBe(ZoneMemberStatus.PENDING);
    expect(events.emit).toHaveBeenCalled();
  });
});
```

> Note: `join` takes the zone's `joinPolicy` as a param in the test for isolation; the real controller fetches the zone first and passes `zone.joinPolicy`. Keep that signature.

- [ ] **Step 2: Run → fails**

Run: `pnpm --filter @mentor/api test -- forum.service`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `domain/forum.events.ts` + `forum.service.ts`**

`domain/forum.events.ts`:
```ts
export const ForumEventTopic = {
  MEMBER_REQUESTED: "forum.member.requested",
} as const;

export interface MemberRequested {
  zoneId: string;
  userId: string;
}
```

`application/forum.service.ts` (key shape — full impl):
```ts
import { HttpStatus, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ZoneMemberStatus, ZoneRole, type ZoneView } from "@mentor/types";
import type { CreateZone, ZoneListQuery } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ForumZoneRepository, type MemberRow, type ZoneRow } from "../infrastructure/forum-zone.repository";
import { canApproveMember, canCreateZone, type ForumActor } from "../domain/forum.policy";
import { ForumEventTopic } from "../domain/forum.events";

@Injectable()
export class ForumService {
  constructor(
    private readonly repo: ForumZoneRepository,
    private readonly config: ConfigRegistryService,
    private readonly events: EventEmitter2,
  ) {}

  async assertEnabled(): Promise<void> {
    if (!(await this.config.get("forum.enabled"))) {
      throw new DomainError(ErrorCode.FORUM_DISABLED, HttpStatus.NOT_FOUND);
    }
  }

  private slugify(title: string): string {
    return title.toLowerCase().trim()
      .replace(/[İığ ü ş ö ç]/g, (c) => ({ "İ": "i", "ı": "i", "ğ": "g", "ü": "u", "ş": "s", "ö": "o", "ç": "c" }[c] ?? c))
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }

  async createZone(actorRoles: string[], actorId: string, dto: CreateZone): Promise<ZoneView> {
    await this.assertEnabled();
    if (!canCreateZone(actorRoles)) throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    const slug = `${this.slugify(dto.title)}-${Date.now().toString(36)}`;
    const row = await this.repo.createZone({
      type: dto.type, title: dto.title, slug, description: dto.description,
      examType: dto.examType, joinPolicy: dto.joinPolicy, createdBy: actorId,
    });
    return this.toView(row, 0, null);
  }

  async assignOwner(actorRoles: string[], zoneId: string, targetUserId: string): Promise<void> {
    await this.assertEnabled();
    if (!canCreateZone(actorRoles)) throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    await this.repo.upsertMember(zoneId, targetUserId, ZoneRole.OWNER, ZoneMemberStatus.ACTIVE);
  }

  async join(zoneId: string, userId: string, joinPolicy: string): Promise<{ status: string }> {
    await this.assertEnabled();
    const existing = await this.repo.findMembership(zoneId, userId);
    if (existing && existing.status === ZoneMemberStatus.ACTIVE) return { status: existing.status };
    const status = joinPolicy === "REQUEST" ? ZoneMemberStatus.PENDING : ZoneMemberStatus.ACTIVE;
    await this.repo.upsertMember(zoneId, userId, ZoneRole.MEMBER, status);
    if (status === ZoneMemberStatus.PENDING) {
      this.events.emit(ForumEventTopic.MEMBER_REQUESTED, { zoneId, userId });
    }
    return { status };
  }

  async approveMember(actor: ForumActor, zoneId: string, targetUserId: string, approve: boolean): Promise<void> {
    await this.assertEnabled();
    if (!canApproveMember(actor)) throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    await this.repo.setMemberStatus(
      zoneId, targetUserId, approve ? ZoneMemberStatus.ACTIVE : ZoneMemberStatus.PENDING,
    );
    // reject = leave PENDING (no auto-grant); hard removal is a moderation action (later slice).
  }

  async listZones(viewerId: string, q: ZoneListQuery): Promise<{ items: ZoneView[]; total: number; page: number; pageSize: number }> {
    await this.assertEnabled();
    const { items, total } = await this.repo.listPublic(viewerId, q);
    const views = await Promise.all(items.map(async (z) => {
      const m = await this.repo.findMembership(z.id, viewerId);
      return this.toView(z, await this.repo.memberCount(z.id), m?.status ?? null);
    }));
    return { items: views, total, page: q.page, pageSize: q.pageSize };
  }

  async getZone(viewerId: string, slug: string): Promise<ZoneView> {
    await this.assertEnabled();
    const row = await this.repo.findBySlug(slug, viewerId);
    if (!row) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    const m = await this.repo.findMembership(row.id, viewerId);
    return this.toView(row, await this.repo.memberCount(row.id), m?.status ?? null);
  }

  private toView(z: ZoneRow, memberCount: number, myStatus: string | null): ZoneView {
    return {
      id: z.id, type: z.type as ZoneView["type"], title: z.title, slug: z.slug,
      description: z.description, visibility: z.visibility as ZoneView["visibility"],
      joinPolicy: z.joinPolicy as ZoneView["joinPolicy"], examType: z.examType,
      isArchived: z.isArchived, memberCount, myStatus: myStatus as ZoneView["myStatus"],
      createdAt: z.createdAt.toISOString(),
    };
  }
}
```

> Add `FORUM_DISABLED`, `FORBIDDEN`, `NOT_FOUND` to `ErrorCode` if absent (check `common/errors/error-code.ts`; reuse existing generic codes — only add `FORUM_DISABLED`). Add localized messages in `apps/web` i18n + API i18n catalogs.

- [ ] **Step 4: Run → passes**

Run: `pnpm --filter @mentor/api test -- forum.service`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/forum/application apps/api/src/modules/forum/domain/forum.events.ts apps/api/src/common/errors/error-code.ts
git commit -m "feature/APP-012 forum slice1: forum service + events + flag gate"
```

---

### Task 7: Controller + module wiring

**Files:**
- Create: `apps/api/src/modules/forum/presentation/forum.dto.ts`
- Create: `apps/api/src/modules/forum/presentation/forum.controller.ts`
- Create: `apps/api/src/modules/forum/forum.module.ts`
- Modify: `apps/api/src/app.module.ts` (import `ForumModule`)
- Modify: `apps/api/src/modules/README.md` (mark forum live)

**Interfaces:**
- Consumes: `ForumService`, `CurrentUser`, `Roles`/`RolesGuard`.
- Produces endpoints (under `/v1/forum`): `GET /zones`, `GET /zones/:slug`, `POST /zones` (Roles), `POST /zones/:id/owner` (Roles), `POST /zones/:id/join`, `POST /zones/:id/members/:userId/approve`.

- [ ] **Step 1: DTOs** (`forum.dto.ts`)

```ts
import { createZodDto } from "nestjs-zod";
import { approveMemberSchema, assignOwnerSchema, createZoneSchema, zoneListQuerySchema } from "@mentor/validation";

export class CreateZoneDto extends createZodDto(createZoneSchema) {}
export class AssignOwnerDto extends createZodDto(assignOwnerSchema) {}
export class ApproveMemberDto extends createZodDto(approveMemberSchema) {}
export class ZoneListQueryDto extends createZodDto(zoneListQuerySchema) {}
```

- [ ] **Step 2: Controller** (`forum.controller.ts`)

```ts
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole, type ZoneView } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { ForumService } from "../application/forum.service";
import { ApproveMemberDto, AssignOwnerDto, CreateZoneDto, ZoneListQueryDto } from "./forum.dto";

@ApiTags("forum")
@ApiBearerAuth()
@Controller("forum")
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get("zones")
  list(@CurrentUser() user: RequestUser, @Query() q: ZoneListQueryDto) {
    return this.forum.listZones(user.id, q);
  }

  @Get("zones/:slug")
  get(@CurrentUser() user: RequestUser, @Param("slug") slug: string): Promise<ZoneView> {
    return this.forum.getZone(user.id, slug);
  }

  @Post("zones")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR, UserRole.EDITOR)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateZoneDto): Promise<ZoneView> {
    return this.forum.createZone(user.roles, user.id, dto);
  }

  @Post("zones/:id/owner")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  async assignOwner(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: AssignOwnerDto) {
    await this.forum.assignOwner(user.roles, id, dto.userId);
    return { status: "ok" };
  }

  @Post("zones/:id/join")
  async join(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    // controller resolves the zone's join policy, then delegates
    const zone = await this.forum.getZoneById(id, user.id);
    return this.forum.join(id, user.id, zone.joinPolicy);
  }

  @Post("zones/:id/members/:userId/approve")
  async approve(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("userId") targetUserId: string,
    @Body() dto: ApproveMemberDto,
  ) {
    const membership = await this.forum.getActorMembership(id, user.id);
    await this.forum.approveMember(
      { userId: user.id, platformRoles: user.roles, zoneRole: membership?.role ?? null },
      id, targetUserId, dto.approve,
    );
    return { status: "ok" };
  }
}
```

> Add `getZoneById(id, viewerId)` and `getActorMembership(zoneId, userId)` thin helpers to `ForumService` (wrap repo). Keep the controller free of business logic.

- [ ] **Step 3: Module + wiring** (`forum.module.ts` + `app.module.ts`)

```ts
import { Module } from "@nestjs/common";
import { ForumService } from "./application/forum.service";
import { ForumZoneRepository } from "./infrastructure/forum-zone.repository";
import { ForumController } from "./presentation/forum.controller";

@Module({
  controllers: [ForumController],
  providers: [ForumService, ForumZoneRepository],
  exports: [ForumService],
})
export class ForumModule {}
```

Add `ForumModule` to `app.module.ts` imports (alphabetical-ish with the other feature modules).

- [ ] **Step 4: Build + typecheck + lint**

Run: `pnpm --filter @mentor/api typecheck && pnpm --filter @mentor/api lint && pnpm --filter @mentor/api build`
Expected: PASS.

- [ ] **Step 5: e2e smoke** (`apps/api/test/forum.e2e-spec.ts`): flag off → `GET /v1/forum/zones` 404; flag on + admin → create zone 201 → student join OPEN zone → ACTIVE.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/forum apps/api/src/app.module.ts apps/api/src/modules/README.md apps/api/test/forum.e2e-spec.ts
git commit -m "feature/APP-012 forum slice1: controller + module wiring + e2e"
```

---

### Task 8: API client regen + devnote

**Files:**
- Regenerate: `@mentor/api-client` (orval) from updated OpenAPI.
- Modify: `docs/standards/api.md` (service catalog: add forum endpoints).
- Create: `docs/devnotes/00NN-forum-slice1-zones.md`.

- [ ] **Step 1:** Run the OpenAPI + orval codegen script (repo's `pnpm --filter @mentor/api openapi` / api-client `generate` — check `package.json`).
- [ ] **Step 2:** Add forum endpoints to `docs/standards/api.md` service catalog.
- [ ] **Step 3:** Write devnote (usage: feature flag, curated zone creation, OWNER assignment, join policies; gotchas: RLS service-context for member lists, slug uniqueness suffix).
- [ ] **Step 4: Commit**

```bash
git add packages/api-client docs/standards/api.md docs/devnotes
git commit -m "feature/APP-012 forum slice1: api-client + catalog + devnote"
```

---

## Self-Review notes
- **Web UI deferred to Slice 2:** Slice 1 has no user-visible content worth a screen (empty zones). Forum web screens (`/forum` list + zone view + join button) land in Slice 2 alongside threads/feeds, so there is real content to render. Stated explicitly per design §9.
- **Spec coverage:** zones + membership + roles + join policies + feature flag + RLS + policy authz + curated creation + OWNER assignment → all covered. Threads/reactions/QA/search/reports/SEO = later slices (design §9).
- **Type consistency:** `ZoneView`, `ZoneRole`, `ZoneMemberStatus`, `joinPolicy` strings consistent across types/validation/service/controller.
