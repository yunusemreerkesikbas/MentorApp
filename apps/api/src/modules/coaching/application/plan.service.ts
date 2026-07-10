import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Paginated, PlanTaskCalendarDto, PlanTaskDto } from "@mentor/types";
import type {
  CreatePlanTaskInput,
  ListPlanTasksQuery,
  PlanTaskCalendarQuery,
  UpdatePlanTaskInput,
} from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { todayIso } from "../domain/date.util";
import {
  PlanTaskStatus,
  TODAY_PLAN_PENDING_MAX,
  type TodayPlanSummary,
} from "../domain/coaching.constants";
import { CoachingEventTopic, DailyPlanCompleted } from "../domain/coaching.events";
import { DailyActivityRepository } from "../infrastructure/daily-activity.repository";
import { PlanTaskRepository } from "../infrastructure/plan-task.repository";
import { toPlanTaskDto } from "./coaching.mappers";

/**
 * Plan tasks (today's plan) CRUD. Toggling a task's status recomputes
 * `daily_activity.tasks_done` for that day in the SAME transaction, so the read-time streak
 * stays consistent. All access is RLS-scoped via `withUserContext`.
 */
@Injectable()
export class PlanService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tasks: PlanTaskRepository,
    private readonly activity: DailyActivityRepository,
    private readonly events: EventEmitter2,
  ) {}

  async list(userId: string, query: ListPlanTasksQuery): Promise<Paginated<PlanTaskDto>> {
    return withUserContext(this.db, { userId }, async (tx) => {
      if (query.from && query.to) {
        const { items, total } = await this.tasks.listByDateRangePaged(
          tx,
          userId,
          query.from,
          query.to,
          query.page,
          query.pageSize,
        );
        return {
          items: items.map(toPlanTaskDto),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      }
      const date = query.date ?? todayIso();
      const { items, total } = await this.tasks.listByDatePaged(
        tx,
        userId,
        date,
        query.page,
        query.pageSize,
      );
      return { items: items.map(toPlanTaskDto), total, page: query.page, pageSize: query.pageSize };
    });
  }

  /** Ordered list for one day (used by the composite /today endpoint). */
  listForDate(userId: string, date: string): Promise<PlanTaskDto[]> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await this.tasks.listByDate(tx, userId, date);
      return rows.map(toPlanTaskDto);
    });
  }

  /**
   * PII-free summary of today's plan for the AI coach context (§4 #6 — counts + own titles only).
   * Returns null when the user has no tasks scheduled for today.
   */
  async getTodaySummary(userId: string): Promise<TodayPlanSummary | null> {
    const tasks = await this.listForDate(userId, todayIso());
    if (tasks.length === 0) return null;
    const pending = tasks.filter((t) => t.status !== PlanTaskStatus.DONE);
    return {
      total: tasks.length,
      done: tasks.length - pending.length,
      pendingTitles: pending.map((t) => t.title).slice(0, TODAY_PLAN_PENDING_MAX),
    };
  }

  /** Distinct dates with ≥1 task in range — one query for calendar/week indicators. */
  listCalendarDates(userId: string, query: PlanTaskCalendarQuery): Promise<PlanTaskCalendarDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const dates = await this.tasks.listDistinctDatesInRange(
        tx,
        userId,
        query.from,
        query.to,
      );
      return { dates };
    });
  }

  async create(userId: string, input: CreatePlanTaskInput): Promise<PlanTaskDto> {
    const taskDate = input.taskDate ?? todayIso();
    this.assertTaskDateMutable(taskDate);
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.tasks.create(tx, {
        userId,
        taskDate,
        title: input.title,
        subject: input.subject ?? null,
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      });
      return toPlanTaskDto(row);
    });
  }

  async update(userId: string, id: string, input: UpdatePlanTaskInput): Promise<PlanTaskDto> {
    let planCompleted: number | null = null;
    const result = await withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.tasks.findById(tx, userId, id);
      if (!existing) {
        throw new DomainError(ErrorCode.COACHING_TASK_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      this.assertTaskDateMutable(existing.taskDate);
      const updated = await this.tasks.update(tx, userId, id, {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      });
      // Status change can flip the day's done-count → keep daily_activity in sync (same tx).
      if (input.status !== undefined) {
        const doneCount = await this.tasks.countDone(tx, userId, existing.taskDate);
        await this.activity.upsertTasksDone(tx, userId, existing.taskDate, doneCount);
        if (input.status === "DONE" && existing.taskDate === todayIso()) {
          const total = await this.tasks.countTotal(tx, userId, existing.taskDate);
          if (total > 0 && doneCount === total) planCompleted = total;
        }
      }
      return toPlanTaskDto(updated!);
    });
    if (planCompleted !== null) {
      this.events.emit(CoachingEventTopic.PLAN_COMPLETED, new DailyPlanCompleted(userId, planCompleted));
    }
    return result;
  }

  async remove(userId: string, id: string): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.tasks.findById(tx, userId, id);
      if (!existing) {
        throw new DomainError(ErrorCode.COACHING_TASK_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      this.assertTaskDateMutable(existing.taskDate);
      await this.tasks.delete(tx, userId, id);
      // A removed DONE task lowers the day's count → recompute.
      const doneCount = await this.tasks.countDone(tx, userId, existing.taskDate);
      await this.activity.upsertTasksDone(tx, userId, existing.taskDate, doneCount);
    });
  }

/** Past calendar days are view-only — prevents retroactive streak/plan edits. */
  private assertTaskDateMutable(taskDate: string): void {
    if (taskDate < todayIso()) {
      throw new DomainError(ErrorCode.COACHING_TASK_DATE_READONLY, HttpStatus.FORBIDDEN);
    }
  }
}
