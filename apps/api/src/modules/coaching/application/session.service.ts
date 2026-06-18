import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { StudySessionDto } from "@mentor/types";
import type { StartStudySessionInput, UpdateStudySessionInput } from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { toIsoDate } from "../domain/date.util";
import { DailyActivityRepository } from "../infrastructure/daily-activity.repository";
import { StudySessionRepository } from "../infrastructure/study-session.repository";
import { toStudySessionDto } from "./coaching.mappers";

/**
 * Study (Pomodoro) sessions: start → complete/abandon. Finalizing a session recomputes
 * `daily_activity.has_session` for the session's day in the SAME transaction (feeds the streak).
 *
 * Start creates an `IN_PROGRESS` row (`ended_at = null`); only `COMPLETED` sessions with
 * `ended_at` set count toward daily activity / streak.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly sessions: StudySessionRepository,
    private readonly activity: DailyActivityRepository,
  ) {}

  async start(userId: string, input: StartStudySessionInput): Promise<StudySessionDto> {
    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
    const plannedFocusMinutes =
      input.preset === "custom" ? (input.focusMinutes ?? null) : null;
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.sessions.create(tx, {
        userId,
        startedAt,
        preset: input.preset,
        plannedFocusMinutes,
        subject: input.subject ?? null,
      });
      return toStudySessionDto(row);
    });
  }

  async finalize(
    userId: string,
    id: string,
    input: UpdateStudySessionInput,
  ): Promise<StudySessionDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.sessions.findById(tx, userId, id);
      if (!existing) {
        throw new DomainError(ErrorCode.COACHING_SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      if (existing.endedAt) {
        throw new DomainError(ErrorCode.COACHING_SESSION_ALREADY_CLOSED, HttpStatus.CONFLICT);
      }
      const updated = await this.sessions.update(tx, userId, id, {
        status: input.status,
        actualFocusSeconds: input.actualFocusSeconds,
        endedAt: new Date(),
      });
      // Recompute the day's session flag (robust against abandon/re-complete) — same tx.
      const date = toIsoDate(existing.startedAt);
      const hasSession = await this.sessions.hasCompletedOnDate(tx, userId, date);
      await this.activity.upsertHasSession(tx, userId, date, hasSession);
      return toStudySessionDto(updated!);
    });
  }
}
