import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { users } from "../../../database/schema";

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/** Public-safe identity fields for a suggested user (follow discovery cohort fallback). */
export interface CohortPeer {
  userId: string;
  displayName: string;
  username: string;
  avatarStorageKey: string | null;
}

/**
 * All access goes through RLS contexts (double belt):
 *  - service-scoped for pre-auth flows (login/signup — no user identity yet),
 *  - user-scoped for self reads/writes (policy enforces id = app.user_id).
 */
@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByEmailService(email: string): Promise<UserRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = lower(${email})`)
        .limit(1);
      return rows[0];
    });
  }

  async findByUsernameService(username: string): Promise<UserRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(users)
        .where(sql`lower(${users.username}) = lower(${username})`)
        .limit(1);
      return rows[0];
    });
  }

  async findByIdService(id: string): Promise<UserRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.select().from(users).where(eq(users.id, id)).limit(1);
      return rows[0];
    });
  }

  /**
   * Cohort peers for follow discovery cold-start: recent ACTIVE users with a username, scoped to the
   * given exam-type cohort (any exam type when `examType` is null), excluding `excludeIds`. Newest first.
   */
  async suggestCohortPeers(
    examType: string | null,
    excludeIds: string[],
    limit: number,
  ): Promise<CohortPeer[]> {
    return withServiceContext(this.db, async (tx) => {
      const conds = [
        eq(users.status, "ACTIVE"),
        isNotNull(users.username),
        notInArray(users.id, excludeIds),
      ];
      if (examType) conds.push(eq(users.examType, examType));
      return tx
        .select({
          userId: users.id,
          displayName: sql<string>`coalesce(${users.displayName}, '')`,
          username: sql<string>`${users.username}`,
          avatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(users)
        .where(and(...conds))
        .orderBy(desc(users.createdAt))
        .limit(limit);
    });
  }

  /** Service-scoped: resolve a set of (lowercase) usernames → `username → id` map. Empty in → empty map. */
  async findIdsByUsernames(usernames: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (usernames.length === 0) return map;
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(inArray(users.username, usernames));
      for (const r of rows) {
        if (r.username) map.set(r.username.toLowerCase(), r.id);
      }
      return map;
    });
  }

  async createService(data: NewUser): Promise<UserRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.insert(users).values(data).returning();
      return rows[0]!;
    });
  }

  /** Self read — user-scoped RLS (returns nothing if the id doesn't match the context). */
  async findSelf(userId: string): Promise<UserRow | undefined> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      return rows[0];
    });
  }

  /** Self update — user-scoped RLS. */
  async updateSelf(userId: string, patch: Partial<NewUser>): Promise<UserRow | undefined> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx.update(users).set(patch).where(eq(users.id, userId)).returning();
      return rows[0];
    });
  }

  /** Service-scoped update (token flows: verify email, reset password). */
  async updateService(userId: string, patch: Partial<NewUser>): Promise<UserRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.update(users).set(patch).where(eq(users.id, userId)).returning();
      return rows[0];
    });
  }

  /**
   * Admin metrics aggregate (W6) — cross-tenant counts in a single scan (SERVICE context).
   * Read-only; role-gated at the controller.
   */
  async statsSnapshot(): Promise<{
    total: number;
    new7d: number;
    new30d: number;
    verified: number;
    active: number;
    suspended: number;
    banned: number;
    kpss: number;
    yks: number;
    lgs: number;
  }> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          total: sql<number>`count(*)::int`,
          new7d: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '7 days')::int`,
          new30d: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '30 days')::int`,
          verified: sql<number>`count(*) filter (where ${users.emailVerifiedAt} is not null)::int`,
          active: sql<number>`count(*) filter (where ${users.status} = 'ACTIVE')::int`,
          suspended: sql<number>`count(*) filter (where ${users.status} = 'SUSPENDED')::int`,
          banned: sql<number>`count(*) filter (where ${users.status} = 'BANNED')::int`,
          kpss: sql<number>`count(*) filter (where ${users.examType} = 'KPSS')::int`,
          yks: sql<number>`count(*) filter (where ${users.examType} = 'YKS')::int`,
          lgs: sql<number>`count(*) filter (where ${users.examType} = 'LGS')::int`,
        })
        .from(users);
      return rows[0]!;
    });
  }

  /**
   * KVKK erasure of the identity row (identity owns this table — admin/account orchestrators call
   * through the service, never write `users` directly). Returns the pre-scrub PII for the audit
   * trail plus the avatar key so the caller can drop the object from storage.
   * Idempotent: re-running on an already-scrubbed row just rewrites the same values.
   */
  async anonymizeAccount(
    id: string,
    status: string,
  ): Promise<
    | {
        before: Record<string, unknown>;
        after: Record<string, unknown>;
        avatarStorageKey: string | null;
      }
    | undefined
  > {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          email: users.email,
          displayName: users.displayName,
          username: users.username,
          status: users.status,
          avatarStorageKey: users.avatarStorageKey,
        })
        .from(users)
        .where(eq(users.id, id))
        .for("update")
        .limit(1);
      const current = rows[0];
      if (!current) return undefined;

      const after = {
        email: `deleted+${id}@anonymized.local`,
        displayName: "Silinmiş Kullanıcı",
        username: null,
        status,
      };
      await tx
        .update(users)
        .set({
          ...after,
          examType: null,
          examDate: null,
          // Public profile PII (KVKK).
          bio: null,
          website: null,
          avatarStorageKey: null,
        })
        .where(eq(users.id, id));

      const { avatarStorageKey, ...before } = current;
      return { before, after, avatarStorageKey };
    });
  }
}
