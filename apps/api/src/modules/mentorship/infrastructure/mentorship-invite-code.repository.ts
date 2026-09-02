import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { mentorshipInviteCodes } from "../../../database/schema";

export type MentorshipInviteCodeRow = typeof mentorshipInviteCodes.$inferSelect;

/** One rotating invite code per coach (SERVICE context — lookup is by code, across users). */
@Injectable()
export class MentorshipInviteCodeRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findByCoach(coachId: string): Promise<MentorshipInviteCodeRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(mentorshipInviteCodes)
        .where(eq(mentorshipInviteCodes.coachId, coachId))
        .limit(1);
      return rows[0];
    });
  }

  findByCode(code: string): Promise<MentorshipInviteCodeRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(mentorshipInviteCodes)
        .where(eq(mentorshipInviteCodes.code, code))
        .limit(1);
      return rows[0];
    });
  }

  /** KVKK erasure: the coach's code must stop resolving to an anonymized account. */
  async purgeForCoach(coachId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(mentorshipInviteCodes).where(eq(mentorshipInviteCodes.coachId, coachId));
    });
  }

  /** Rotate in place — one row per coach, so issuing a new code invalidates the old one. */
  upsert(coachId: string, code: string, expiresAt: Date): Promise<MentorshipInviteCodeRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(mentorshipInviteCodes)
        .values({ coachId, code, expiresAt })
        .onConflictDoUpdate({
          target: mentorshipInviteCodes.coachId,
          set: { code, expiresAt, updatedAt: new Date() },
        })
        .returning();
      return rows[0]!;
    });
  }
}
