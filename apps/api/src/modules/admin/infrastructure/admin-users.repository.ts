import { Inject, Injectable } from "@nestjs/common";
import { desc, eq, or, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { users } from "../../../database/schema";

export type AdminUserRow = typeof users.$inferSelect;

/**
 * Admin-facing user access. All reads/writes run in SERVICE context (admin acts on OTHER
 * users → the self-scoped RLS belt would hide them; the `users` policy allows SERVICE/ADMIN).
 */
@Injectable()
export class AdminUsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Paginated user list; `q` matches email or display name (case-insensitive, partial). */
  async search(q: string | undefined, page: number, pageSize: number): Promise<AdminUserRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const base = tx
        .select()
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      if (!q) return base;
      const like = `%${q}%`;
      return base.where(or(sql`${users.email} ILIKE ${like}`, sql`${users.displayName} ILIKE ${like}`));
    });
  }

  async findById(id: string): Promise<AdminUserRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.select().from(users).where(eq(users.id, id)).limit(1);
      return rows[0];
    });
  }

  /**
   * Replace a user's role set atomically and return the before/after snapshots (for audit).
   * The read + write share one SERVICE transaction so a concurrent toggle can't interleave.
   */
  async setRoles(
    id: string,
    compute: (current: string[]) => string[],
  ): Promise<{ before: string[]; after: string[] } | undefined> {
    return withServiceContext(this.db, async (tx: DatabaseTx) => {
      const rows = await tx
        .select({ roles: users.roles })
        .from(users)
        .where(eq(users.id, id))
        .for("update")
        .limit(1);
      const current = rows[0]?.roles;
      if (!current) return undefined;
      const after = compute(current);
      await tx.update(users).set({ roles: after }).where(eq(users.id, id));
      return { before: current, after };
    });
  }

  /** Set the account status; returns the before/after status for audit (undefined if missing). */
  async updateStatus(
    id: string,
    status: string,
  ): Promise<{ before: string; after: string } | undefined> {
    return withServiceContext(this.db, async (tx: DatabaseTx) => {
      const rows = await tx
        .select({ status: users.status })
        .from(users)
        .where(eq(users.id, id))
        .for("update")
        .limit(1);
      const before = rows[0]?.status;
      if (before === undefined) return undefined;
      await tx.update(users).set({ status }).where(eq(users.id, id));
      return { before, after: status };
    });
  }

  /**
   * KVKK erasure by anonymization (§9): scrub PII and ban the account, keeping the row so
   * foreign keys / append-only ledgers stay intact. Returns before/after PII for audit.
   */
  async anonymize(
    id: string,
  ): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> } | undefined> {
    return withServiceContext(this.db, async (tx: DatabaseTx) => {
      const rows = await tx
        .select({
          email: users.email,
          displayName: users.displayName,
          username: users.username,
          status: users.status,
        })
        .from(users)
        .where(eq(users.id, id))
        .for("update")
        .limit(1);
      const current = rows[0];
      if (!current) return undefined;
      const anonEmail = `deleted+${id}@anonymized.local`;
      const after = {
        email: anonEmail,
        displayName: "Silinmiş Kullanıcı",
        username: null,
        status: "BANNED",
      };
      await tx
        .update(users)
        .set({ ...after, examType: null, examDate: null })
        .where(eq(users.id, id));
      return { before: current, after };
    });
  }
}
