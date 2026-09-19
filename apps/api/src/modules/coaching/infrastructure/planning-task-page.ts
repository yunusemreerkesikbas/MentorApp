import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { planTasks } from "../../../database/schema";

/** Coach-safe projection: never select descriptions or another coach's note. */
export function planningTaskPage(
  db: Database,
  studentId: string,
  linkId: string,
  from: string,
  to: string,
  page: number,
  pageSize: number,
) {
  const where = and(
    eq(planTasks.userId, studentId),
    gte(planTasks.taskDate, from),
    lte(planTasks.taskDate, to),
  );
  const mine = sql<boolean>`${planTasks.originType} = 'MENTORSHIP' and ${planTasks.originRefId} = ${linkId}`;
  return withServiceContext(db, async (tx) => {
    const items = await tx
      .select({
        id: planTasks.id,
        taskDate: planTasks.taskDate,
        title: planTasks.title,
        subject: planTasks.subject,
        topic: planTasks.topic,
        status: planTasks.status,
        assignedByCoach: sql<boolean>`coalesce(${mine}, false)`,
        coachNote: sql<
          string | null
        >`case when ${mine} then ${planTasks.coachNote} end`,
      })
      .from(planTasks)
      .where(where)
      .orderBy(
        asc(planTasks.taskDate),
        asc(planTasks.sortOrder),
        asc(planTasks.id),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const [count] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(planTasks)
      .where(where);
    return { items, total: count?.total ?? 0, page, pageSize };
  });
}
