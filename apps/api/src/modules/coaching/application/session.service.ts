import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Paginated, StudySessionDto } from "@mentor/types";
import type {
  ListStudySessionsQuery,
  SessionFeedbackInput,
  StartStudySessionInput,
  UpdateStudySessionInput,
} from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { toIsoDate } from "../domain/date.util";
import {
  RECENT_SESSION_WINDOW_DAYS,
  RECENT_SUBJECTS_MAX,
  type RecentSessionSummary,
} from "../domain/coaching.constants";
import { CoachingEventTopic, FirstSessionOfDay } from "../domain/coaching.events";
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
    private readonly events: EventEmitter2,
  ) {}

  /**
   * PII-free summary of recent study behavior for the AI coach context (§4 #6). Aggregates
   * finalized sessions in the last {@link RECENT_SESSION_WINDOW_DAYS} days plus the recent
   * distinct subjects and the last struggle note. Returns `null` when there is no recent
   * activity, so the AI context can treat it as an absent (not empty) signal.
   */
  async getRecentSummary(userId: string): Promise<RecentSessionSummary | null> {
    const since = new Date(Date.now() - RECENT_SESSION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    return withUserContext(this.db, { userId }, async (tx) => {
      const raw = await this.sessions.recentSummary(tx, userId, since);

      const subjects: string[] = [];
      let lastStruggleNote: string | null = null;
      for (const row of raw.recentRows) {
        const subject = row.subject?.trim();
        if (subject && !subjects.includes(subject) && subjects.length < RECENT_SUBJECTS_MAX) {
          subjects.push(subject);
        }
        if (lastStruggleNote === null && row.struggleNote?.trim()) {
          lastStruggleNote = row.struggleNote.trim();
        }
      }

      if (raw.count7d === 0 && subjects.length === 0 && lastStruggleNote === null) {
        return null;
      }
      return {
        count7d: raw.count7d,
        focusMinutes7d: Math.round(raw.focusSeconds7d / 60),
        subjects,
        lastStruggleNote,
      };
    });
  }

  /** Paginated finalized-session history (most recent first) for the "Son seanslar" surface. */
  async list(
    userId: string,
    query: ListStudySessionsQuery,
  ): Promise<Paginated<StudySessionDto>> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const { items, total } = await this.sessions.listPaged(
        tx,
        userId,
        query.page,
        query.pageSize,
      );
      return {
        items: items.map(toStudySessionDto),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

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
    let firstSessionToday = false;
    const result = await withUserContext(this.db, { userId }, async (tx) => {
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
      const [prior, hasSession] = await Promise.all([
        this.activity.findByDate(tx, userId, date),
        this.sessions.hasCompletedOnDate(tx, userId, date),
      ]);
      await this.activity.upsertHasSession(tx, userId, date, hasSession);
      if (!prior?.hasSession && hasSession) firstSessionToday = true;
      return toStudySessionDto(updated!);
    });
    if (firstSessionToday) {
      this.events.emit(CoachingEventTopic.FIRST_SESSION, new FirstSessionOfDay(userId));
    }
    return result;
  }

  /**
   * Attach the post-session micro check-in (mood 1-3 + optional note) to an existing session.
   * Runs after finalize (the session is already persisted), so it never touches the finalize path.
   * Idempotent: re-submitting overwrites. Changing mood/note clears the premium AI reflection cache
   * (same pattern as mood check-in upsert). ponytail: not gated on status — nullable metadata on
   * the user's own row; the FE only surfaces it on the done screen.
   */
  async recordFeedback(
    userId: string,
    id: string,
    input: SessionFeedbackInput,
  ): Promise<StudySessionDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.sessions.findById(tx, userId, id);
      if (!existing) {
        throw new DomainError(ErrorCode.COACHING_SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      const nextNote = input.struggleNote?.trim() ? input.struggleNote.trim() : null;
      const changed =
        existing.sessionMood !== input.mood || (existing.struggleNote ?? null) !== nextNote;
      const updated = await this.sessions.update(tx, userId, id, {
        sessionMood: input.mood,
        struggleNote: nextNote,
        ...(changed
          ? { aiReflection: null, aiModel: null, aiReflectedAt: null }
          : {}),
      });
      return toStudySessionDto(updated!);
    });
  }

  /**
   * Cache the premium AI session reflection (written by W3 via this public surface so
   * `study_sessions` is only mutated inside coaching — workstreams §2). Requires a finalized
   * session; returns the updated DTO for callers that need the cached text.
   */
  async setAiReflection(
    userId: string,
    id: string,
    reflection: string,
    model: string,
  ): Promise<StudySessionDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.sessions.findById(tx, userId, id);
      if (!existing) {
        throw new DomainError(ErrorCode.COACHING_SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      if (!existing.endedAt) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
      }
      const updated = await this.sessions.update(tx, userId, id, {
        aiReflection: reflection,
        aiModel: model,
        aiReflectedAt: new Date(),
      });
      return toStudySessionDto(updated!);
    });
  }

  /** Read a single session (RLS-scoped) — used by W3 session reflection. */
  async getById(userId: string, id: string): Promise<StudySessionDto | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.sessions.findById(tx, userId, id);
      return row ? toStudySessionDto(row) : null;
    });
  }
}
