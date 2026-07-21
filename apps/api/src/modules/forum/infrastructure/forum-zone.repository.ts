import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { ZoneMemberStatus, ZoneRole } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { forumThreads, forumZoneMembers, forumZones, users } from "../../../database/schema";

export type ZoneRow = typeof forumZones.$inferSelect;
export type MemberRow = typeof forumZoneMembers.$inferSelect;

/** One @mention autocomplete candidate — an ACTIVE member with a username (APP-021). */
export interface MemberSearchRow {
  username: string;
  displayName: string;
  avatarStorageKey: string | null;
}

/**
 * Zone + membership access (design 2026-06-22). Mirrors LedgerRepository conventions:
 * a user's own reads run in user context (RLS self-read belt); privileged writes and
 * member-list reads run in SERVICE context (the application checks forum.policy first).
 */
@Injectable()
export class ForumZoneRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createZone(input: {
    type: string;
    title: string;
    slug: string;
    description?: string | null;
    examType?: string | null;
    emoji?: string | null;
    joinPolicy: string;
    /** Null for seeded zones (created before any staff user exists). */
    createdBy: string | null;
  }): Promise<ZoneRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(forumZones)
        .values({
          type: input.type,
          title: input.title,
          slug: input.slug,
          description: input.description ?? null,
          examType: input.examType ?? null,
          emoji: input.emoji ?? null,
          joinPolicy: input.joinPolicy,
          createdBy: input.createdBy,
        })
        .returning();
      return rows[0]!;
    });
  }

  /**
   * Insert a launch zone if its slug is free. Idempotent via the unique slug index, so the boot
   * seed can run on every start (and on every instance) without duplicating rows. Returns true
   * when this call created the zone.
   */
  async seedZone(input: {
    type: string;
    title: string;
    slug: string;
    description?: string | null;
    emoji?: string | null;
    joinPolicy: string;
  }): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(forumZones)
        .values({
          type: input.type,
          title: input.title,
          slug: input.slug,
          description: input.description ?? null,
          emoji: input.emoji ?? null,
          joinPolicy: input.joinPolicy,
          createdBy: null,
        })
        .onConflictDoNothing({ target: forumZones.slug })
        .returning({ id: forumZones.id });
      return rows.length > 0;
    });
  }

  async findById(id: string, viewerId: string): Promise<ZoneRow | null> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const [row] = await tx.select().from(forumZones).where(eq(forumZones.id, id)).limit(1);
      return row ?? null;
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
      const items = await tx
        .select()
        .from(forumZones)
        .where(where)
        .orderBy(desc(forumZones.createdAt))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize);
      const totalRow = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(forumZones)
        .where(where);
      return { items, total: totalRow[0]?.count ?? 0 };
    });
  }

  /** Idempotent on (zone,user): a re-join updates role/status rather than erroring. */
  async upsertMember(
    zoneId: string,
    userId: string,
    role: string,
    status: string,
  ): Promise<MemberRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(forumZoneMembers)
        .values({ zoneId, userId, role, status })
        .onConflictDoUpdate({
          target: [forumZoneMembers.zoneId, forumZoneMembers.userId],
          set: { role, status, updatedAt: new Date() },
        })
        .returning();
      return rows[0]!;
    });
  }

  /** Batched ACTIVE member counts for a page of zones (avoids N+1 in listZones). */
  async memberCountsByZone(zoneIds: string[]): Promise<Map<string, number>> {
    if (zoneIds.length === 0) return new Map();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ zoneId: forumZoneMembers.zoneId, count: sql<number>`count(*)::int` })
        .from(forumZoneMembers)
        .where(
          and(
            inArray(forumZoneMembers.zoneId, zoneIds),
            eq(forumZoneMembers.status, ZoneMemberStatus.ACTIVE),
          ),
        )
        .groupBy(forumZoneMembers.zoneId);
      return new Map(rows.map((r) => [r.zoneId, r.count]));
    });
  }

  /** Batched non-deleted thread counts for a page of zones (avoids N+1 in listZones). */
  async threadCountsByZone(zoneIds: string[]): Promise<Map<string, number>> {
    if (zoneIds.length === 0) return new Map();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ zoneId: forumThreads.zoneId, count: sql<number>`count(*)::int` })
        .from(forumThreads)
        .where(and(inArray(forumThreads.zoneId, zoneIds), isNull(forumThreads.deletedAt)))
        .groupBy(forumThreads.zoneId);
      return new Map(rows.map((r) => [r.zoneId, r.count]));
    });
  }

  /** Batched viewer memberships for a page of zones (avoids N+1 in listZones). */
  async findMembershipsByZone(zoneIds: string[], userId: string): Promise<Map<string, MemberRow>> {
    if (zoneIds.length === 0) return new Map();
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select()
        .from(forumZoneMembers)
        .where(and(inArray(forumZoneMembers.zoneId, zoneIds), eq(forumZoneMembers.userId, userId)));
      return new Map(rows.map((r) => [r.zoneId, r]));
    });
  }

  async findMembership(zoneId: string, userId: string): Promise<MemberRow | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const [row] = await tx
        .select()
        .from(forumZoneMembers)
        .where(and(eq(forumZoneMembers.zoneId, zoneId), eq(forumZoneMembers.userId, userId)))
        .limit(1);
      return row ?? null;
    });
  }

  /** SERVICE context — owner/mod member list; the caller must pass forum.policy first. */
  async listMembers(zoneId: string, status?: string): Promise<MemberRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const conds = [eq(forumZoneMembers.zoneId, zoneId)];
      if (status) conds.push(eq(forumZoneMembers.status, status));
      return tx
        .select()
        .from(forumZoneMembers)
        .where(and(...conds))
        .orderBy(desc(forumZoneMembers.createdAt));
    });
  }

  /**
   * SERVICE context — @mention autocomplete (APP-021): ACTIVE members whose username starts with
   * `qLower`. Caller passes forum.policy (`canSearchMembers`) first and guarantees `qLower` is
   * lowercase handle-charset (schema-validated), so LIKE needs no wildcard escaping.
   */
  async searchActiveMembers(zoneId: string, qLower: string, limit = 8): Promise<MemberSearchRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          username: users.username,
          displayName: users.displayName,
          avatarStorageKey: users.avatarStorageKey,
        })
        .from(forumZoneMembers)
        .innerJoin(users, eq(users.id, forumZoneMembers.userId))
        .where(
          and(
            eq(forumZoneMembers.zoneId, zoneId),
            eq(forumZoneMembers.status, ZoneMemberStatus.ACTIVE),
            isNotNull(users.username),
            sql`lower(${users.username}) like ${qLower + "%"}`,
          ),
        )
        .orderBy(asc(users.username))
        .limit(limit);
      // isNotNull() already guarantees username; the cast just narrows the inferred nullable type.
      return rows as MemberSearchRow[];
    });
  }

  async setMemberStatus(zoneId: string, userId: string, status: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(forumZoneMembers)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(forumZoneMembers.zoneId, zoneId), eq(forumZoneMembers.userId, userId)));
    });
  }

  /** SERVICE context — look up any member's row for policy checks (caller holds authz). */
  async findMembershipPrivileged(zoneId: string, userId: string): Promise<MemberRow | null> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx
        .select()
        .from(forumZoneMembers)
        .where(and(eq(forumZoneMembers.zoneId, zoneId), eq(forumZoneMembers.userId, userId)))
        .limit(1);
      return row ?? null;
    });
  }

  /** SERVICE context — a zone's slug (for building notification links), or null if it no longer exists. */
  async zoneSlug(zoneId: string): Promise<string | null> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx
        .select({ slug: forumZones.slug })
        .from(forumZones)
        .where(eq(forumZones.id, zoneId))
        .limit(1);
      return row?.slug ?? null;
    });
  }

  /** SERVICE context — active owner + moderator user ids of a zone (for notifying on join requests). */
  async listOwnerAndMods(zoneId: string): Promise<string[]> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ userId: forumZoneMembers.userId })
        .from(forumZoneMembers)
        .where(
          and(
            eq(forumZoneMembers.zoneId, zoneId),
            eq(forumZoneMembers.status, ZoneMemberStatus.ACTIVE),
            inArray(forumZoneMembers.role, [ZoneRole.OWNER, ZoneRole.MODERATOR]),
          ),
        );
      return rows.map((r) => r.userId);
    });
  }

  async deleteMember(zoneId: string, userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .delete(forumZoneMembers)
        .where(and(eq(forumZoneMembers.zoneId, zoneId), eq(forumZoneMembers.userId, userId)));
    });
  }

  async memberCount(zoneId: string): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(forumZoneMembers)
        .where(
          and(
            eq(forumZoneMembers.zoneId, zoneId),
            eq(forumZoneMembers.status, ZoneMemberStatus.ACTIVE),
          ),
        );
      return rows[0]?.count ?? 0;
    });
  }
}
