import { Inject, Injectable } from "@nestjs/common";
import type { Paginated, PlanItemDto } from "@mentor/types";
import type { ListPlanTasksQuery } from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { PlanEventRepository } from "../infrastructure/plan-event.repository";
import { PlanItemRepository } from "../infrastructure/plan-item.repository";
import { PlanTaskRepository } from "../infrastructure/plan-task.repository";
import { todayInIstanbul } from "../domain/date.util";
import { toPlanTaskDto } from "./coaching.mappers";
import { toPlanEventDto } from "./plan-event.mapper";

@Injectable()
export class PlanItemService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly items: PlanItemRepository,
    private readonly tasks: PlanTaskRepository,
    private readonly events: PlanEventRepository,
  ) {}

  list(
    userId: string,
    query: ListPlanTasksQuery,
  ): Promise<Paginated<PlanItemDto>> {
    const effectiveQuery = {
      ...query,
      date: query.from ? undefined : (query.date ?? todayInIstanbul()),
    };
    return withUserContext(this.db, { userId }, async (tx) => {
      const page = await this.items.listPaged(tx, userId, effectiveQuery);
      const taskIds = page.refs
        .filter((ref) => ref.kind === "TASK")
        .map((ref) => ref.id);
      const eventIds = page.refs
        .filter((ref) => ref.kind === "EVENT")
        .map((ref) => ref.id);
      const [taskRows, eventRows] = await Promise.all([
        this.tasks.findByIds(tx, userId, taskIds),
        this.events.findParticipantByIds(tx, userId, eventIds),
      ]);
      const tasksById = new Map(taskRows.map((row) => [row.id, row]));
      const eventsById = new Map(eventRows.map((row) => [row.id, row]));
      const result: PlanItemDto[] = [];
      for (const ref of page.refs) {
        if (ref.kind === "TASK") {
          const row = tasksById.get(ref.id);
          if (row) result.push({ kind: "TASK", task: toPlanTaskDto(row) });
        } else {
          const row = eventsById.get(ref.id);
          if (row) result.push({ kind: "EVENT", event: toPlanEventDto(row) });
        }
      }
      return {
        items: result,
        total: page.total,
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }
}
