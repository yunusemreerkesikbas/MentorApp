import { randomUUID } from "node:crypto";
import { HttpStatus } from "@nestjs/common";
import type { PlanTaskDto } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { DatabaseTx } from "../../../database/drizzle";
import type {
  PlanTaskRepository,
  PlanTaskRow,
} from "../infrastructure/plan-task.repository";
import type { MentorshipTaskVisibleSignature } from "../infrastructure/plan-task-mentorship.repository";
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
export type MentorshipAssignmentVisibleSignature =
  MentorshipTaskVisibleSignature;

function notEditable(): never {
  throw new DomainError(
    ErrorCode.MENTORSHIP_ASSIGNMENT_NOT_EDITABLE,
    HttpStatus.CONFLICT,
  );
}

function staleAssignment(): never {
  throw new DomainError(
    ErrorCode.MENTORSHIP_ASSIGNMENT_STALE,
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

export async function createMentorshipBatchInTransaction(
  tx: DatabaseTx,
  tasks: PlanTaskRepository,
  scopes: MentorshipPlanScope[],
  input: MentorshipAssignmentInput & { taskDate: string },
): Promise<PlanTaskDto[]> {
  const assignmentGroupId = randomUUID();
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
}

export async function updateMentorshipTaskInTransaction(
  tx: DatabaseTx,
  tasks: PlanTaskRepository,
  scope: MentorshipPlanScope,
  taskId: string,
  input: Partial<MentorshipAssignmentUpdate>,
): Promise<PlanTaskDto> {
  await tasks.acquireUserLock(tx, scope.studentId);
  const row = await tasks.updatePendingMentorshipTask(
    tx,
    scope,
    taskId,
    mutablePatch(input),
  );
  if (!row) notEditable();
  return toPlanTaskDto(row!);
}

export async function updateMentorshipTaskGroupInTransaction(
  tx: DatabaseTx,
  tasks: PlanTaskRepository,
  scopes: MentorshipPlanScope[],
  assignmentGroupId: string,
  input: Partial<MentorshipAssignmentUpdate>,
  expectedSignature: MentorshipTaskVisibleSignature,
): Promise<PlanTaskDto[]> {
  await lockScopes(tasks, tx, scopes);
  const rows = await tasks.updatePendingMentorshipGroup(
    tx,
    scopes,
    assignmentGroupId,
    expectedSignature,
    mutablePatch(input),
  );
  if (rows.length !== scopes.length) staleAssignment();
  return rows.map(toPlanTaskDto);
}

export async function removeMentorshipTaskInTransaction(
  tx: DatabaseTx,
  tasks: PlanTaskRepository,
  scope: MentorshipPlanScope,
  taskId: string,
): Promise<void> {
  await tasks.acquireUserLock(tx, scope.studentId);
  if (!(await tasks.deletePendingMentorshipTask(tx, scope, taskId))) {
    notEditable();
  }
}

export async function removeMentorshipTaskGroupInTransaction(
  tx: DatabaseTx,
  tasks: PlanTaskRepository,
  scopes: MentorshipPlanScope[],
  assignmentGroupId: string,
  expectedSignature: MentorshipTaskVisibleSignature,
): Promise<void> {
  await lockScopes(tasks, tx, scopes);
  const rows = await tasks.deletePendingMentorshipGroup(
    tx,
    scopes,
    assignmentGroupId,
    expectedSignature,
  );
  if (rows.length !== scopes.length) staleAssignment();
}
