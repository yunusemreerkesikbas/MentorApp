import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { planTasks } from "../../../database/schema";
import type { NewPlanTask, PlanTaskRow } from "./plan-task.repository";

export interface MentorshipTaskScope {
  studentId: string;
  mentorshipLinkId: string;
}

export type MentorshipTaskVisibleSignature = Pick<
  PlanTaskRow,
  | "taskDate"
  | "title"
  | "subject"
  | "topic"
  | "startTime"
  | "endTime"
  | "coachNote"
>;

const scopePredicate = (scopes: MentorshipTaskScope[]) =>
  or(
    ...scopes.map((scope) =>
      and(
        eq(planTasks.userId, scope.studentId),
        eq(planTasks.originRefId, scope.mentorshipLinkId),
      ),
    ),
  );

const nullableTextPredicate = (
  column:
    | typeof planTasks.subject
    | typeof planTasks.topic
    | typeof planTasks.startTime
    | typeof planTasks.endTime
    | typeof planTasks.coachNote,
  value: string | null,
) => value === null ? isNull(column) : eq(column, value);

const visibleSignaturePredicate = (
  signature: MentorshipTaskVisibleSignature,
) =>
  and(
    eq(planTasks.taskDate, signature.taskDate),
    eq(planTasks.title, signature.title),
    nullableTextPredicate(planTasks.subject, signature.subject),
    nullableTextPredicate(planTasks.topic, signature.topic),
    nullableTextPredicate(planTasks.startTime, signature.startTime),
    nullableTextPredicate(planTasks.endTime, signature.endTime),
    nullableTextPredicate(planTasks.coachNote, signature.coachNote),
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
  expectedSignature: MentorshipTaskVisibleSignature,
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
        visibleSignaturePredicate(expectedSignature),
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
  expectedSignature: MentorshipTaskVisibleSignature,
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
        visibleSignaturePredicate(expectedSignature),
      ),
    )
    .returning();
}
