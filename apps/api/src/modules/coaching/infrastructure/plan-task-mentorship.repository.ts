import { and, asc, eq, gte, lte, or } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { planTasks } from "../../../database/schema";
import type { NewPlanTask, PlanTaskRow } from "./plan-task.repository";

export interface MentorshipTaskScope {
  studentId: string;
  mentorshipLinkId: string;
}

const scopePredicate = (scopes: MentorshipTaskScope[]) =>
  or(
    ...scopes.map((scope) =>
      and(
        eq(planTasks.userId, scope.studentId),
        eq(planTasks.originRefId, scope.mentorshipLinkId),
      ),
    ),
  );

export function listOwnedCoachTasks(
  tx: DatabaseTx,
  coachId: string,
  from: string,
  to: string,
): Promise<PlanTaskRow[]> {
  return tx
    .select()
    .from(planTasks)
    .where(
      and(
        eq(planTasks.userId, coachId),
        gte(planTasks.taskDate, from),
        lte(planTasks.taskDate, to),
      ),
    )
    .orderBy(asc(planTasks.taskDate), asc(planTasks.startTime), asc(planTasks.id));
}

export async function updatePendingMentorshipTask(
  tx: DatabaseTx,
  scope: MentorshipTaskScope,
  id: string,
  patch: Partial<NewPlanTask>,
): Promise<PlanTaskRow | undefined> {
  const [row] = await tx
    .update(planTasks)
    .set(patch)
    .where(
      and(
        eq(planTasks.id, id),
        eq(planTasks.userId, scope.studentId),
        eq(planTasks.status, "PENDING"),
        eq(planTasks.originType, "MENTORSHIP"),
        eq(planTasks.originRefId, scope.mentorshipLinkId),
      ),
    )
    .returning();
  return row;
}

export function updatePendingMentorshipGroup(
  tx: DatabaseTx,
  scopes: MentorshipTaskScope[],
  assignmentGroupId: string,
  patch: Partial<NewPlanTask>,
): Promise<PlanTaskRow[]> {
  if (scopes.length === 0) return Promise.resolve([]);
  return tx
    .update(planTasks)
    .set(patch)
    .where(
      and(
        eq(planTasks.assignmentGroupId, assignmentGroupId),
        eq(planTasks.status, "PENDING"),
        eq(planTasks.originType, "MENTORSHIP"),
        scopePredicate(scopes),
      ),
    )
    .returning();
}

export async function deletePendingMentorshipTask(
  tx: DatabaseTx,
  scope: MentorshipTaskScope,
  id: string,
): Promise<PlanTaskRow | undefined> {
  const [row] = await tx
    .delete(planTasks)
    .where(
      and(
        eq(planTasks.id, id),
        eq(planTasks.userId, scope.studentId),
        eq(planTasks.status, "PENDING"),
        eq(planTasks.originType, "MENTORSHIP"),
        eq(planTasks.originRefId, scope.mentorshipLinkId),
      ),
    )
    .returning();
  return row;
}

export function deletePendingMentorshipGroup(
  tx: DatabaseTx,
  scopes: MentorshipTaskScope[],
  assignmentGroupId: string,
): Promise<PlanTaskRow[]> {
  if (scopes.length === 0) return Promise.resolve([]);
  return tx
    .delete(planTasks)
    .where(
      and(
        eq(planTasks.assignmentGroupId, assignmentGroupId),
        eq(planTasks.status, "PENDING"),
        eq(planTasks.originType, "MENTORSHIP"),
        scopePredicate(scopes),
      ),
    )
    .returning();
}
