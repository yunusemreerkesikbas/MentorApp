import { randomUUID } from "node:crypto";
import { HttpStatus } from "@nestjs/common";
import type { PlanTaskDto } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import type { PlanTaskRepository, PlanTaskRow } from "../infrastructure/plan-task.repository";
import { toPlanTaskDto } from "./coaching.mappers";
import type { MentorshipAssignmentInput } from "./plan.service";

export interface MentorshipPlanScope {
  studentId: string;
  mentorshipLinkId: string;
}

export type MentorshipAssignmentUpdate = Pick<
  MentorshipAssignmentInput,
  "title" | "subject" | "topic" | "taskDate" | "startTime" | "endTime" | "coachNote"
>;

function notEditable(): never {
  throw new DomainError(
    ErrorCode.MENTORSHIP_ASSIGNMENT_NOT_EDITABLE,
    HttpStatus.CONFLICT,
  );
}

function mutablePatch(input: Partial<MentorshipAssignmentUpdate>) {
  return {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.subject !== undefined && { subject: input.subject }),
    ...(input.subject === null && { topic: null }),
    ...(input.topic !== undefined && { topic: input.topic }),
    ...(input.taskDate !== undefined && { taskDate: input.taskDate }),
    ...(input.startTime !== undefined && { startTime: input.startTime }),
    ...(input.endTime !== undefined && { endTime: input.endTime }),
    ...(input.coachNote !== undefined && { coachNote: input.coachNote }),
    updatedAt: new Date(),
  };
}

async function lockScopes(
  tasks: PlanTaskRepository,
  tx: Parameters<PlanTaskRepository["acquireUserLock"]>[0],
  scopes: MentorshipPlanScope[],
): Promise<void> {
  const studentIds = [...new Set(scopes.map((scope) => scope.studentId))].sort();
  for (const studentId of studentIds) await tasks.acquireUserLock(tx, studentId);
}

export async function createMentorshipBatch(
  db: Database,
  tasks: PlanTaskRepository,
  scopes: MentorshipPlanScope[],
  input: MentorshipAssignmentInput & { taskDate: string },
): Promise<PlanTaskDto[]> {
  const assignmentGroupId = randomUUID();
  return withServiceContext(db, async (tx) => {
    await lockScopes(tasks, tx, scopes);
    const rows: PlanTaskRow[] = [];
    for (const scope of scopes) {
      rows.push(
        await tasks.create(tx, {
          userId: scope.studentId,
          taskDate: input.taskDate,
          title: input.title,
          subject: input.subject ?? null,
          topic: input.topic ?? null,
          startTime: input.startTime ?? null,
          endTime: input.endTime ?? null,
          description: null,
          coachNote: input.coachNote ?? null,
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          originType: "MENTORSHIP",
          originRefId: scope.mentorshipLinkId,
          originMeta: null,
          assignmentGroupId,
        }),
      );
    }
    return rows.map(toPlanTaskDto);
  });
}

export async function updateMentorshipTask(
  db: Database,
  tasks: PlanTaskRepository,
  scope: MentorshipPlanScope,
  taskId: string,
  input: Partial<MentorshipAssignmentUpdate>,
): Promise<PlanTaskDto> {
  return withServiceContext(db, async (tx) => {
    await tasks.acquireUserLock(tx, scope.studentId);
    const row = await tasks.updatePendingMentorshipTask(
      tx,
      scope,
      taskId,
      mutablePatch(input),
    );
    if (!row) notEditable();
    return toPlanTaskDto(row!);
  });
}

export async function updateMentorshipTaskGroup(
  db: Database,
  tasks: PlanTaskRepository,
  scopes: MentorshipPlanScope[],
  assignmentGroupId: string,
  input: Partial<MentorshipAssignmentUpdate>,
): Promise<PlanTaskDto[]> {
  return withServiceContext(db, async (tx) => {
    await lockScopes(tasks, tx, scopes);
    const rows = await tasks.updatePendingMentorshipGroup(
      tx,
      scopes,
      assignmentGroupId,
      mutablePatch(input),
    );
    if (rows.length === 0) notEditable();
    return rows.map(toPlanTaskDto);
  });
}

export async function removeMentorshipTask(
  db: Database,
  tasks: PlanTaskRepository,
  scope: MentorshipPlanScope,
  taskId: string,
): Promise<void> {
  await withServiceContext(db, async (tx) => {
    await tasks.acquireUserLock(tx, scope.studentId);
    if (!(await tasks.deletePendingMentorshipTask(tx, scope, taskId))) {
      notEditable();
    }
  });
}

export async function removeMentorshipTaskGroup(
  db: Database,
  tasks: PlanTaskRepository,
  scopes: MentorshipPlanScope[],
  assignmentGroupId: string,
): Promise<void> {
  await withServiceContext(db, async (tx) => {
    await lockScopes(tasks, tx, scopes);
    const rows = await tasks.deletePendingMentorshipGroup(
      tx,
      scopes,
      assignmentGroupId,
    );
    if (rows.length === 0) notEditable();
  });
}
