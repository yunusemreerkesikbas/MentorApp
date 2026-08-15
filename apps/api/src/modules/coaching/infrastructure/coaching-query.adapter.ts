import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { mistakeNotebookEntries, users } from "../../../database/schema";
import { UserStatus } from "../../identity/domain/identity.constants";
import type {
  CoachingQueryPort,
  DailyReminderCandidate,
  NotebookReviewCandidate,
} from "../../coaching/domain/coaching-query.port";

/** SERVICE-scoped queries for W5 daily reminder eligibility. */
@Injectable()
export class CoachingQueryAdapter implements CoachingQueryPort {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listDailyReminderCandidates(dateIso: string): Promise<DailyReminderCandidate[]> {
    const dayStart = new Date(`${dateIso}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateIso}T23:59:59.999Z`);

    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          userId: users.id,
          email: users.email,
          displayName: users.displayName,
        })
        .from(users)
        .where(
          and(
            eq(users.status, UserStatus.ACTIVE),
            sql`NOT EXISTS (
              SELECT 1 FROM study_sessions s
              WHERE s.user_id = ${users.id}
                AND s.started_at >= ${dayStart}
                AND s.started_at <= ${dayEnd}
            )`,
            sql`NOT EXISTS (
              SELECT 1 FROM mood_checkins m
              WHERE m.user_id = ${users.id}
                AND m.checkin_date = ${dateIso}
            )`,
          ),
        );
      return rows;
    });
  }

  /**
   * One row per user with work waiting, not one per due entry: the reminder is a single nudge
   * carrying a count, and fanning out per entry would turn a productive day into a notification
   * storm — the exact shaming pattern the tone rules rule out (§0).
   */
  async listNotebookReviewCandidates(now: Date): Promise<NotebookReviewCandidate[]> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          userId: users.id,
          email: users.email,
          displayName: users.displayName,
          dueCount: sql<number>`count(${mistakeNotebookEntries.id})`.mapWith(Number),
        })
        .from(users)
        .innerJoin(
          mistakeNotebookEntries,
          eq(mistakeNotebookEntries.userId, users.id),
        )
        .where(
          and(
            eq(users.status, UserStatus.ACTIVE),
            isNotNull(mistakeNotebookEntries.nextReviewAt),
            lte(mistakeNotebookEntries.nextReviewAt, now),
          ),
        )
        .groupBy(users.id, users.email, users.displayName);
      return rows;
    });
  }
}
