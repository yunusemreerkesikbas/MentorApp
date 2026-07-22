import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
  ApplyPlanAdaptationResultDto,
  Paginated,
  PlanTaskCalendarDto,
  PlanTaskDto,
} from "@mentor/types";
import type {
  ApplyPlanAdaptationInput,
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
import { addDays, todayIso } from "../domain/date.util";
import {
  buildPlanRevision,
  PLAN_ADAPTATION_WINDOW_DAYS,
  type PlanAdaptationSnapshot,
} from "../domain/plan-adaptation";
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
      await this.tasks.acquireUserLock(tx, userId);
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

  /**
   * User-confirmed batch add (e.g. an accepted coach draft — the AI itself never writes here,
   * workstreams §2). All-or-nothing: every date is validated first, then one tx writes all rows.
   */
  async createMany(userId: string, inputs: CreatePlanTaskInput[]): Promise<PlanTaskDto[]> {
    const withDates = inputs.map((input) => ({ ...input, taskDate: input.taskDate ?? todayIso() }));
    for (const input of withDates) this.assertTaskDateMutable(input.taskDate);
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = [];
      await this.tasks.acquireUserLock(tx, userId);
      for (const input of withDates) {
        rows.push(
          await this.tasks.create(tx, {
            userId,
            taskDate: input.taskDate,
            title: input.title,
            subject: input.subject ?? null,
            ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          }),
        );
      }
      return rows.map(toPlanTaskDto);
    });
  }

  getAdaptationSnapshot(userId: string): Promise<PlanAdaptationSnapshot> {
    const from = todayIso();
    const to = addDays(from, PLAN_ADAPTATION_WINDOW_DAYS - 1);
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await this.tasks.listByDateRange(tx, userId, from, to);
      return {
        window: { from, to },
        planRevision: buildPlanRevision(rows),
        tasks: rows.map(({ id, taskDate, title, subject, status, sortOrder }) => ({
          id,
          taskDate,
          title,
          subject,
          status,
          sortOrder,
        })),
      };
    });
  }

  async applyAdaptation(
    userId: string,
    input: ApplyPlanAdaptationInput,
  ): Promise<ApplyPlanAdaptationResultDto> {
    const from = todayIso();
    const to = addDays(from, PLAN_ADAPTATION_WINDOW_DAYS - 1);
    return withUserContext(this.db, { userId }, async (tx) => {
      await this.tasks.acquireUserLock(tx, userId);
      const rows = await this.tasks.listByDateRange(tx, userId, from, to);
      if (buildPlanRevision(rows) !== input.planRevision) {
        throw new DomainError(ErrorCode.COACHING_PLAN_CHANGED, HttpStatus.CONFLICT);
      }

      const byId = new Map(rows.map((row) => [row.id, row]));
      const pendingByDate = new Map<string, number>();
      const maxOrderByDate = new Map<string, number>();
      const titleCounts = new Map<string, number>();
      const titleKey = (date: string, title: string) =>
        `${date}:${title.trim().toLocaleLowerCase("tr-TR")}`;
      const adjustTitleCount = (key: string, delta: number) => {
        const next = (titleCounts.get(key) ?? 0) + delta;
        if (next <= 0) titleCounts.delete(key);
        else titleCounts.set(key, next);
      };
      for (const row of rows) {
        if (row.status === PlanTaskStatus.PENDING) {
          pendingByDate.set(row.taskDate, (pendingByDate.get(row.taskDate) ?? 0) + 1);
          adjustTitleCount(titleKey(row.taskDate, row.title), 1);
        }
        maxOrderByDate.set(
          row.taskDate,
          Math.max(maxOrderByDate.get(row.taskDate) ?? -1, row.sortOrder),
        );
      }

      const movedIds = new Set<string>();
      const moves: Array<{
        row: (typeof rows)[number];
        toDate: string;
        sortOrder?: number;
      }> = [];
      const additions: Array<{
        title: string;
        subject: string | null;
        taskDate: string;
        sortOrder: number;
      }> = [];
      const nextOrder = (date: string) => {
        const next = (maxOrderByDate.get(date) ?? -1) + 1;
        maxOrderByDate.set(date, next);
        return next;
      };
      const assertDate = (date: string) => {
        if (date < from || date > to) {
          throw new DomainError(ErrorCode.COACHING_PLAN_CHANGED, HttpStatus.CONFLICT);
        }
      };

      // Resolve and remove all move sources first so capacity checks reflect the
      // selected adaptation's final state, regardless of change order.
      for (const change of input.changes) {
        if (change.kind !== "MOVE") continue;
        const row = byId.get(change.taskId);
        if (
          !row ||
          row.status !== PlanTaskStatus.PENDING ||
          row.taskDate !== change.fromDate ||
          change.fromDate === change.toDate ||
          movedIds.has(row.id)
        ) {
          throw new DomainError(ErrorCode.COACHING_PLAN_CHANGED, HttpStatus.CONFLICT);
        }
        assertDate(change.toDate);
        movedIds.add(row.id);
        pendingByDate.set(row.taskDate, (pendingByDate.get(row.taskDate) ?? 1) - 1);
        adjustTitleCount(titleKey(row.taskDate, row.title), -1);
        moves.push({ row, toDate: change.toDate });
      }

      for (const move of moves) {
        const targetTitleKey = titleKey(move.toDate, move.row.title);
        if (
          (pendingByDate.get(move.toDate) ?? 0) >= 3 ||
          (titleCounts.get(targetTitleKey) ?? 0) > 0
        ) {
          throw new DomainError(ErrorCode.COACHING_PLAN_CHANGED, HttpStatus.CONFLICT);
        }
        pendingByDate.set(move.toDate, (pendingByDate.get(move.toDate) ?? 0) + 1);
        adjustTitleCount(targetTitleKey, 1);
        move.sortOrder = nextOrder(move.toDate);
      }

      for (const change of input.changes) {
        if (change.kind !== "ADD") continue;
        assertDate(change.taskDate);
        const additionTitleKey = titleKey(change.taskDate, change.title);
        if (
          (titleCounts.get(additionTitleKey) ?? 0) > 0 ||
          (pendingByDate.get(change.taskDate) ?? 0) >= 3
        ) {
          throw new DomainError(ErrorCode.COACHING_PLAN_CHANGED, HttpStatus.CONFLICT);
        }
        adjustTitleCount(additionTitleKey, 1);
        pendingByDate.set(change.taskDate, (pendingByDate.get(change.taskDate) ?? 0) + 1);
        additions.push({
          title: change.title,
          subject: change.subject,
          taskDate: change.taskDate,
          sortOrder: nextOrder(change.taskDate),
        });
      }

      const moved = [];
      for (const move of moves) {
        const row = await this.tasks.update(tx, userId, move.row.id, {
          taskDate: move.toDate,
          sortOrder: move.sortOrder!,
          updatedAt: new Date(),
        });
        if (!row) throw new DomainError(ErrorCode.COACHING_PLAN_CHANGED, HttpStatus.CONFLICT);
        moved.push(toPlanTaskDto(row));
      }

      const added = [];
      for (const addition of additions) {
        const row = await this.tasks.create(tx, { userId, ...addition });
        added.push(toPlanTaskDto(row));
      }
      return { moved, added };
    });
  }

  async update(userId: string, id: string, input: UpdatePlanTaskInput): Promise<PlanTaskDto> {
    let planCompleted: number | null = null;
    const result = await withUserContext(this.db, { userId }, async (tx) => {
      await this.tasks.acquireUserLock(tx, userId);
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
      await this.tasks.acquireUserLock(tx, userId);
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
