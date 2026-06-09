import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { users } from "../../../database/schema";

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

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

  async findByIdService(id: string): Promise<UserRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.select().from(users).where(eq(users.id, id)).limit(1);
      return rows[0];
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
}
