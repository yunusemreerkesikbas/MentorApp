import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { inviteRedemptions, invites } from "../../../database/schema";

export type InviteRow = typeof invites.$inferSelect;
export type RedemptionRow = typeof inviteRedemptions.$inferSelect;

/** Invite + redemption persistence (SERVICE context — system-managed, cross-user). */
@Injectable()
export class InviteRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findByInviter(inviterUserId: string): Promise<InviteRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.select().from(invites).where(eq(invites.inviterUserId, inviterUserId)).limit(1);
      return rows[0];
    });
  }

  findByCode(code: string): Promise<InviteRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.select().from(invites).where(eq(invites.code, code)).limit(1);
      return rows[0];
    });
  }

  /** Create the inviter's code; idempotent on the inviter PK (returns the existing row on conflict). */
  async create(inviterUserId: string, code: string): Promise<InviteRow> {
    return withServiceContext(this.db, async (tx) => {
      await tx.insert(invites).values({ inviterUserId, code }).onConflictDoNothing();
      const rows = await tx.select().from(invites).where(eq(invites.inviterUserId, inviterUserId)).limit(1);
      return rows[0]!;
    });
  }

  findRedemptionByInvited(invitedUserId: string): Promise<RedemptionRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(inviteRedemptions)
        .where(eq(inviteRedemptions.invitedUserId, invitedUserId))
        .limit(1);
      return rows[0];
    });
  }

  /** Insert a redemption; returns undefined if the invited user already has one (unique race-safe). */
  createRedemption(
    inviterUserId: string,
    invitedUserId: string,
    code: string,
  ): Promise<RedemptionRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(inviteRedemptions)
        .values({ inviterUserId, invitedUserId, code })
        .onConflictDoNothing()
        .returning();
      return rows[0];
    });
  }

  /** PENDING → CONVERTED, only if currently PENDING (idempotent). Returns the row if it transitioned. */
  markConverted(invitedUserId: string): Promise<RedemptionRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(inviteRedemptions)
        .set({ status: "CONVERTED", convertedAt: new Date() })
        .where(and(eq(inviteRedemptions.invitedUserId, invitedUserId), eq(inviteRedemptions.status, "PENDING")))
        .returning();
      return rows[0];
    });
  }

  countsByInviter(inviterUserId: string): Promise<{ invited: number; converted: number }> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          invited: sql<number>`count(*)::int`,
          converted: sql<number>`count(*) filter (where ${inviteRedemptions.status} = 'CONVERTED')::int`,
        })
        .from(inviteRedemptions)
        .where(eq(inviteRedemptions.inviterUserId, inviterUserId));
      return rows[0] ?? { invited: 0, converted: 0 };
    });
  }
}
