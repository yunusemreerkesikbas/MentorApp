import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { ListPlanTasksQuery } from "@mentor/validation";
import type { DatabaseTx } from "../../../database/drizzle";
import {
  planEventAttendees,
  planEvents,
  planTasks,
} from "../../../database/schema";

export interface PlanItemRef {
  kind: "TASK" | "EVENT";
  id: string;
}

@Injectable()
export class PlanItemRepository {
  async listPaged(
    tx: DatabaseTx,
    userId: string,
    query: ListPlanTasksQuery,
  ): Promise<{ refs: PlanItemRef[]; total: number }> {
    const taskDate = query.from
      ? sql`${planTasks.taskDate} between ${query.from} and ${query.to!}`
      : sql`${planTasks.taskDate} = ${query.date!}`;
    const eventDate = query.from
      ? sql`${planEvents.eventDate} between ${query.from} and ${query.to!}`
      : sql`${planEvents.eventDate} = ${query.date!}`;
    const participant = sql`(
      ${planEvents.organizerUserId} = ${userId}
      or exists (
        select 1 from ${planEventAttendees}
        where ${planEventAttendees.eventId} = ${planEvents.id}
          and ${planEventAttendees.attendeeUserId} = ${userId}
      )
    )`;
    const union = sql`
      select 'TASK'::text as kind, ${planTasks.id} as id,
             ${planTasks.taskDate} as item_date,
             ${planTasks.startTime} as start_time,
             ${planTasks.createdAt} as created_at
      from ${planTasks}
      where ${planTasks.userId} = ${userId} and ${taskDate}
      union all
      select 'EVENT'::text as kind, ${planEvents.id} as id,
             ${planEvents.eventDate} as item_date,
             ${planEvents.startTime} as start_time,
             ${planEvents.createdAt} as created_at
      from ${planEvents}
      where ${participant} and ${eventDate}
    `;
    const [page, count] = await Promise.all([
      tx.execute(sql`
        select kind, id
        from (${union}) plan_items
        order by item_date asc, (start_time is not null) asc,
                 start_time asc, created_at asc, id asc
        limit ${query.pageSize}
        offset ${(query.page - 1) * query.pageSize}
      `),
      tx.execute(sql`select count(*)::int as count from (${union}) plan_items`),
    ]);
    return {
      refs: page.rows as PlanItemRef[],
      total: Number((count.rows[0] as { count?: number } | undefined)?.count ?? 0),
    };
  }
}
