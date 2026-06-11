import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Paginated, PlanTaskDto } from "@mentor/types";
import type {
  CreatePlanTaskInput,
  ListPlanTasksQuery,
  UpdatePlanTaskInput,
} from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { todayIso } from "../domain/date.util";
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
  ) {}

  async list(userId: string, query: ListPlanTasksQuery): Promise<Paginated<PlanTaskDto>> {
    const date = query.date ?? todayIso();
    return withUserContext(this.db, { userId }, async (tx) => {
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

  async create(userId: string, input: CreatePlanTaskInput): Promise<PlanTaskDto> {
    const taskDate = input.taskDate ?? todayIso();
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
    return withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.tasks.findById(tx, userId, id);
      if (!existing) {
        throw new DomainError(ErrorCode.COACHING_TASK_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      const updated = await this.tasks.update(tx, userId, id, {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      });
      // Status change can flip the day's done-count → keep daily_activity in sync (same tx).
      if (input.status !== undefined) {
        await this.syncTasksDone(tx, userId, existing.taskDate);
      }
      return toPlanTaskDto(updated!);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.tasks.findById(tx, userId, id);
      if (!existing) {
        throw new DomainError(ErrorCode.COACHING_TASK_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      await this.tasks.delete(tx, userId, id);
      // A removed DONE task lowers the day's count → recompute.
      await this.syncTasksDone(tx, userId, existing.taskDate);
    });
  }

  /** Recompute and persist `daily_activity.tasks_done` for a day from the current DONE count. */
  private async syncTasksDone(tx: DatabaseTx, userId: string, date: string): Promise<void> {
    const doneCount = await this.tasks.countDone(tx, userId, date);
    await this.activity.upsertTasksDone(tx, userId, date, doneCount);
  }
}
