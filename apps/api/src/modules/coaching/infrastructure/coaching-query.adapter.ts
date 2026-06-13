import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { users } from "../../../database/schema";
import { UserStatus } from "../../identity/domain/identity.constants";
import type {
  CoachingQueryPort,
  DailyReminderCandidate,
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
}
