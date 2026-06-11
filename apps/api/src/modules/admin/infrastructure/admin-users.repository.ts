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
}
