import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Paginated, StudySessionDto } from "@mentor/types";
import type {
  ListStudySessionsQuery,
  SessionFeedbackInput,
  StartStudySessionInput,
  UpdateStudySessionInput,
} from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { toIsoDate, todayIso } from "../domain/date.util";
import {
  ACTIVE_SESSION_GRACE_MINUTES,
  FOCUSING_NOW_CACHE_MS,
  FOCUSING_NOW_MIN_VISIBLE,
  qualifiesAsFocusSession,
  RECENT_SESSION_WINDOW_DAYS,
  RECENT_SUBJECTS_MAX,
  STALE_SESSION_GRACE_MINUTES,
  type RecentSessionSummary,
} from "../domain/coaching.constants";
import {
  CoachingEventTopic,
  DailyPlanCompleted,
  FirstSessionOfDay,
  StudySessionCompleted,
  PlanTaskCompleted,
} from "../domain/coaching.events";
import { DailyActivityRepository } from "../infrastructure/daily-activity.repository";
import { PlanTaskRepository } from "../infrastructure/plan-task.repository";
import { StudyRoomRepository } from "../infrastructure/study-room.repository";
import { StudySessionRepository } from "../infrastructure/study-session.repository";
import { toStudySessionDto } from "./coaching.mappers";
import type { CoachRhythmEvidence } from "../domain/coach-evidence";
import { hasSevenFullIstanbulDaysBetween } from "../domain/achievement-evidence";

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
    private readonly planTasks: PlanTaskRepository,
    private readonly rooms: StudyRoomRepository,
    private readonly activity: DailyActivityRepository,
    private readonly events: EventEmitter2,
    private readonly config: ConfigRegistryService,
  ) {}

  private getMinFocusSeconds(): Promise<number> {
    return this.config.get("coaching.session.min_focus_seconds");
  }

  /** ponytail: per-instance cache is fine (Nest singleton); no cache lib needed. */
  private focusingNowCache: { value: number; expiresAt: number } | null = null;

  async getSessionRepeatStats(now = new Date()): Promise<{
    activeUsers7d: number;
    repeatUsers7d: number;
    repeatRate7d: number;
  }> {
    const toDate = now.toISOString().slice(0, 10);
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 6);
    const fromDate = from.toISOString().slice(0, 10);
    const counts = await withServiceContext(this.db, (tx) =>
      this.activity.getSessionRepeatStats(tx, fromDate, toDate),
    );
    return {
      ...counts,
      repeatRate7d:
        counts.activeUsers7d === 0
          ? 0
          : counts.repeatUsers7d / counts.activeUsers7d,
    };
  }

  /**
   * Anonymous "focusing right now" ambience count. Aggregate-only cross-user read in
   * SERVICE context (sanctioned pattern — leaderboard/follows). Returns null below
   * the visibility threshold so a lonely count never reaches any client.
   */
  async getFocusingNowCount(): Promise<number | null> {
    const now = Date.now();
    if (!this.focusingNowCache || this.focusingNowCache.expiresAt <= now) {
      const value = await withServiceContext(this.db, (tx) =>
        this.sessions.countFocusingNow(tx, ACTIVE_SESSION_GRACE_MINUTES),
      );
      this.focusingNowCache = { value, expiresAt: now + FOCUSING_NOW_CACHE_MS };
    }
    const count = this.focusingNowCache.value;
    return count >= FOCUSING_NOW_MIN_VISIBLE ? count : null;
  }

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

  /** Whether the user is in a focus session right now (RLS-scoped read). */
  async isStudyingNow(userId: string): Promise<boolean> {
    return withUserContext(this.db, { userId }, (tx) =>
      this.sessions.hasActiveSession(tx, userId, ACTIVE_SESSION_GRACE_MINUTES),
    );
  }

  /** Today's accumulated COMPLETED focus minutes (UTC day, consistent with daily_activity). */
  async getTodayFocusMinutes(userId: string): Promise<number> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const seconds = await this.sessions.sumCompletedFocusSecondsOnDate(tx, userId, todayIso());
      return Math.round(seconds / 60);
    });
  }

  async qualifiesForReturnAchievement(userId: string, currentStartedAt: Date): Promise<boolean> {
    const minFocusSeconds = await this.getMinFocusSeconds();
    const previous = await withUserContext(this.db, { userId }, (tx) =>
      this.sessions.findLatestQualifiedBefore(tx, userId, currentStartedAt, minFocusSeconds),
    );
    return previous !== null && hasSevenFullIstanbulDaysBetween(previous, currentStartedAt);
  }

  /** Aggregate-only mentor context. No struggle note or per-session title leaves coaching. */
  async getCoachRhythm(
    userId: string,
    now = new Date(),
  ): Promise<CoachRhythmEvidence> {
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since28d = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const [todayFocusMinutes, rhythm] = await Promise.all([
      this.getTodayFocusMinutes(userId),
      withUserContext(this.db, { userId }, (tx) =>
        this.sessions.coachRhythm(tx, userId, since7d, since28d),
      ),
    ]);
    return {
      todayFocusMinutes,
      sessions7d: rhythm.sessions7d,
      focusMinutes7d: Math.round(rhythm.focusSeconds7d / 60),
      activeDays7d: rhythm.activeDays7d,
      averageSessionMinutes7d: Math.round(rhythm.averageFocusSeconds7d / 60),
      sessions28d: rhythm.sessions28d,
      focusMinutes28d: Math.round(rhythm.focusSeconds28d / 60),
      activeDays28d: rhythm.activeDays28d,
      averageSessionMinutes28d: Math.round(rhythm.averageFocusSeconds28d / 60),
      dominantTimeBand: rhythm.dominantTimeBand,
      lastActiveAt: rhythm.lastActiveAt?.toISOString() ?? null,
    };
  }

  /** Paginated finalized-session history (most recent first) for the "Son seanslar" surface. */
  async list(
    userId: string,
    query: ListStudySessionsQuery,
  ): Promise<Paginated<StudySessionDto>> {
    const minFocusSeconds = await this.getMinFocusSeconds();
    return withUserContext(this.db, { userId }, async (tx) => {
      const { items, total } = await this.sessions.listPaged(
        tx,
        userId,
        query.page,
        query.pageSize,
        query.subject,
        query.from,
        query.to,
      );
      return {
        items: items.map(({ planTaskTitle, ...row }) =>
          toStudySessionDto(row, minFocusSeconds, { planTaskTitle }),
        ),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  async start(userId: string, input: StartStudySessionInput): Promise<StudySessionDto> {
    const minFocusSeconds = await this.getMinFocusSeconds();
    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
    const plannedFocusMinutes =
      input.preset === "custom" ? (input.focusMinutes ?? null) : null;
    return withUserContext(this.db, { userId }, async (tx) => {
      // Orphaned IN_PROGRESS rows (tab died) are lazily abandoned on next start.
      await this.sessions.closeStaleOpenSessions(tx, userId, STALE_SESSION_GRACE_MINUTES);
      if (input.planTaskId) {
        const task = await this.planTasks.findById(tx, userId, input.planTaskId);
        if (!task) {
          throw new DomainError(ErrorCode.COACHING_TASK_NOT_FOUND, HttpStatus.NOT_FOUND);
        }
      }
      // Sitting down at a room: membership is the only gate, and the seat is fixed for the
      // whole session (changing tables mid-focus would mean two rooms showing the same person).
      if (input.roomId) {
        if (!(await this.rooms.isMember(tx, input.roomId, userId))) {
          throw new DomainError(ErrorCode.COACHING_ROOM_NOT_MEMBER, HttpStatus.FORBIDDEN);
        }
        await this.rooms.touchLastActive(tx, input.roomId);
      }
      const row = await this.sessions.create(tx, {
        userId,
        startedAt,
        preset: input.preset,
        plannedFocusMinutes,
        subject: input.subject ?? null,
        planTaskId: input.planTaskId ?? null,
        roomId: input.roomId ?? null,
      });
      return toStudySessionDto(row, minFocusSeconds);
    });
  }

  /** W3 seam: idempotently starts (or returns) the open session for an approved plan action. */
  async startFromAiCoach(
    userId: string,
    planTaskId: string,
  ): Promise<StudySessionDto> {
    const minFocusSeconds = await this.getMinFocusSeconds();
    return withUserContext(this.db, { userId }, async (tx) => {
      await this.planTasks.acquireUserLock(tx, userId);
      await this.sessions.closeStaleOpenSessions(
        tx,
        userId,
        STALE_SESSION_GRACE_MINUTES,
      );
      const existing = await this.sessions.findOpenByPlanTask(
        tx,
        userId,
        planTaskId,
      );
      if (existing) return toStudySessionDto(existing, minFocusSeconds);
      const task = await this.planTasks.findById(tx, userId, planTaskId);
      if (!task) {
        throw new DomainError(
          ErrorCode.COACHING_TASK_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const created = await this.sessions.create(tx, {
        userId,
        startedAt: new Date(),
        preset: "25_5",
        plannedFocusMinutes: null,
        subject: task.subject,
        planTaskId,
      });
      return toStudySessionDto(created, minFocusSeconds);
    });
  }

  async finalize(
    userId: string,
    id: string,
    input: UpdateStudySessionInput,
  ): Promise<StudySessionDto> {
    const minFocusSeconds = await this.getMinFocusSeconds();
    let firstSessionToday = false;
    let planCompleted: number | null = null;
    let completedPlanTaskId: string | null = null;
    const result = await withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.sessions.findById(tx, userId, id);
      if (!existing) {
        throw new DomainError(ErrorCode.COACHING_SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      if (existing.endedAt) {
        throw new DomainError(ErrorCode.COACHING_SESSION_ALREADY_CLOSED, HttpStatus.CONFLICT);
      }
      const shouldAutoCompletePlanTask =
        input.status === "COMPLETED" &&
        qualifiesAsFocusSession(input.actualFocusSeconds, minFocusSeconds) &&
        Boolean(existing.planTaskId);
      if (shouldAutoCompletePlanTask) {
        await this.planTasks.acquireUserLock(tx, userId);
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
        this.sessions.hasCompletedOnDate(tx, userId, date, minFocusSeconds),
      ]);
      await this.activity.upsertHasSession(tx, userId, date, hasSession);
      if (!prior?.hasSession && hasSession) firstSessionToday = true;

      let planTaskAutoCompleted = false;
      if (shouldAutoCompletePlanTask && existing.planTaskId) {
        const task = await this.planTasks.findById(tx, userId, existing.planTaskId);
        if (task && task.status !== "DONE" && task.taskDate >= todayIso()) {
          await this.planTasks.update(tx, userId, task.id, { status: "DONE" });
          const doneCount = await this.planTasks.countDone(tx, userId, task.taskDate);
          await this.activity.upsertTasksDone(tx, userId, task.taskDate, doneCount);
          planTaskAutoCompleted = true;
          completedPlanTaskId = task.id;
          if (task.taskDate === todayIso()) {
            const total = await this.planTasks.countTotal(tx, userId, task.taskDate);
            if (total > 0 && doneCount === total) planCompleted = total;
          }
        }
      }

      return toStudySessionDto(updated!, minFocusSeconds, { planTaskAutoCompleted });
    });
    if (firstSessionToday) {
      this.events.emit(CoachingEventTopic.FIRST_SESSION, new FirstSessionOfDay(userId));
    }
    if (planCompleted !== null) {
      this.events.emit(
        CoachingEventTopic.PLAN_COMPLETED,
        new DailyPlanCompleted(userId, planCompleted),
      );
    }
    if (completedPlanTaskId) {
      this.events.emit(
        CoachingEventTopic.PLAN_TASK_COMPLETED,
        new PlanTaskCompleted(userId, completedPlanTaskId),
      );
    }
    // XP / quest rewards only for sessions that meet the min-focus threshold (roadmap §261).
    if (
      input.status === "COMPLETED" &&
      qualifiesAsFocusSession(input.actualFocusSeconds, minFocusSeconds)
    ) {
      this.events.emit(
        CoachingEventTopic.SESSION_COMPLETED,
        new StudySessionCompleted(userId, new Date(result.startedAt)),
      );
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
    const minFocusSeconds = await this.getMinFocusSeconds();
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
          ? {
              aiReflection: null,
              aiModel: null,
              aiLocale: null,
              aiReflectedAt: null,
              aiSuggestedTask: null,
            }
          : {}),
      });
      return toStudySessionDto(updated!, minFocusSeconds);
    });
  }

  /**
   * Cache the premium AI session reflection (written by W3 via this public surface so
   * `study_sessions` is only mutated inside coaching — workstreams §2). Requires a finalized
   * session; returns the updated DTO for callers that need the cached text.
   * Optional `suggestedTask` is the stripped <<TASK>> plan suggestion (null clears / none).
   */
  async setAiReflection(
    userId: string,
    id: string,
    reflection: string,
    model: string,
    suggestedTask: { title: string; subject: string | null } | null = null,
    locale = "tr",
  ): Promise<StudySessionDto> {
    const minFocusSeconds = await this.getMinFocusSeconds();
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
        aiLocale: locale,
        aiReflectedAt: new Date(),
        aiSuggestedTask: suggestedTask,
      });
      return toStudySessionDto(updated!, minFocusSeconds);
    });
  }

  /** Read a single session (RLS-scoped) — used by W3 session reflection. */
  async getById(userId: string, id: string): Promise<StudySessionDto | null> {
    const minFocusSeconds = await this.getMinFocusSeconds();
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.sessions.findById(tx, userId, id);
      return row ? toStudySessionDto(row, minFocusSeconds) : null;
    });
  }

  async getAiReflectionLocale(userId: string, id: string): Promise<string | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.sessions.findById(tx, userId, id);
      return row?.aiLocale ?? null;
    });
  }
}
