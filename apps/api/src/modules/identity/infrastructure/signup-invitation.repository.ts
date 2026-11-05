import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Paginated } from "@mentor/types";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  signupInvitations,
  type InvitationRole,
  type InvitationStatus,
} from "../../../database/schema-signup-invitations";

export type { InvitationRole, InvitationStatus };
export type SignupInvitationRow = typeof signupInvitations.$inferSelect;

const activeInvitedWhere = () =>
  and(
    eq(signupInvitations.status, "invited"),
    sql`${signupInvitations.invitedAt} >= now() - interval '6 months'`,
  );

/**
 * Invite-only signup list (`signup_invitations`). Always SERVICE context; callers pass
 * already-normalized (trimmed, lower-cased) emails.
 */
@Injectable()
export class SignupInvitationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findInvited(email: string): Promise<{ role: InvitationRole } | null> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx
        .select({ role: signupInvitations.role })
        .from(signupInvitations)
        .where(and(eq(signupInvitations.email, email), activeInvitedWhere()))
        .limit(1);
      return row ?? null;
    });
  }

  async insertWaiting(input: { email: string; role: InvitationRole; locale: "tr" | "en" }): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx
        .insert(signupInvitations)
        .values({ email: input.email, role: input.role, locale: input.locale, status: "waiting" })
        .onConflictDoNothing({ target: signupInvitations.email }),
    );
  }

  async upsertInvited(
    input: {
      email: string;
      role: InvitationRole;
      locale: "tr" | "en";
      invitedBy: string;
    },
    maxInvited?: number,
  ): Promise<SignupInvitationRow> {
    return withServiceContext(this.db, async (tx) => {
      if (maxInvited !== undefined) {
        await assertCapacityInTx(tx, maxInvited, { email: input.email });
      }
      const invitedAt = new Date();
      const [row] = await tx
        .insert(signupInvitations)
        .values({
          email: input.email,
          role: input.role,
          locale: input.locale,
          status: "invited",
          invitedAt,
          invitedBy: input.invitedBy,
        })
        .onConflictDoUpdate({
          target: signupInvitations.email,
          set: {
            role: input.role,
            locale: input.locale,
            status: "invited",
            invitedAt,
            invitedBy: input.invitedBy,
          },
        })
        .returning();
      return row!;
    });
  }

  async markInvited(id: string, invitedBy: string, maxInvited?: number): Promise<SignupInvitationRow | null> {
    return withServiceContext(this.db, async (tx) => {
      if (maxInvited !== undefined) {
        await assertCapacityInTx(tx, maxInvited, { id });
      }
      const [row] = await tx
        .update(signupInvitations)
        .set({ status: "invited", invitedAt: new Date(), invitedBy })
        .where(eq(signupInvitations.id, id))
        .returning();
      return row ?? null;
    });
  }

  /** Outstanding active invitations: invited within 6 months, not yet registered (registration deletes the row). */
  async countInvited(): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(signupInvitations)
        .where(activeInvitedWhere());
      return row?.count ?? 0;
    });
  }

  async list(q: {
    status?: InvitationStatus;
    role?: InvitationRole;
    search?: string;
    page: number;
    pageSize: number;
  }): Promise<Paginated<SignupInvitationRow>> {
    return withServiceContext(this.db, async (tx) => {
      const search = q.search?.trim();
      const where = and(
        q.status ? eq(signupInvitations.status, q.status) : undefined,
        q.role ? eq(signupInvitations.role, q.role) : undefined,
        search ? ilike(signupInvitations.email, `%${escapeLike(search)}%`) : undefined,
      );
      const [items, totals] = await Promise.all([
        tx
          .select()
          .from(signupInvitations)
          .where(where)
          .orderBy(desc(signupInvitations.createdAt), desc(signupInvitations.id))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        tx.select({ count: sql<number>`count(*)::int` }).from(signupInvitations).where(where),
      ]);
      return { items, total: totals[0]?.count ?? 0, page: q.page, pageSize: q.pageSize };
    });
  }

  async findById(id: string): Promise<SignupInvitationRow | null> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select().from(signupInvitations).where(eq(signupInvitations.id, id)).limit(1);
      return row ?? null;
    });
  }

  async deleteById(id: string): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .delete(signupInvitations)
        .where(eq(signupInvitations.id, id))
        .returning({ id: signupInvitations.id });
      return rows.length > 0;
    });
  }

  async deleteByEmail(email: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx.delete(signupInvitations).where(eq(signupInvitations.email, email)),
    );
  }

  // ponytail: KVKK 6 ay sabit; aydınlatma metniyle birlikte değişir
  async purgeExpired(): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx.delete(signupInvitations).where(
        or(
          and(eq(signupInvitations.status, "waiting"), sql`${signupInvitations.createdAt} < now() - interval '6 months'`),
          and(eq(signupInvitations.status, "invited"), sql`${signupInvitations.invitedAt} < now() - interval '6 months'`),
        ),
      ),
    );
  }
}

async function assertCapacityInTx(
  tx: DatabaseTx,
  maxInvited: number,
  target: { id: string } | { email: string },
): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('signup_invitations_capacity'))`);
  const targetCond = "id" in target ? eq(signupInvitations.id, target.id) : eq(signupInvitations.email, target.email);
  const [alreadyInvited] = await tx
    .select({ id: signupInvitations.id })
    .from(signupInvitations)
    .where(and(targetCond, activeInvitedWhere()))
    .limit(1);
  if (alreadyInvited) return;
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(signupInvitations)
    .where(activeInvitedWhere());
  if ((row?.count ?? 0) >= maxInvited) {
    throw new DomainError(ErrorCode.WAITLIST_INVITE_LIMIT, HttpStatus.CONFLICT);
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
