import type {
  CoachPlanGroupedTaskDto,
  PlanEventMutationScope,
} from "@mentor/types";
import type {
  CreateMentorshipBatchAssignmentInput,
  CreatePlanEventInput,
  CreatePlanTaskInput,
  UpdateMentorshipAssignmentGroupInput,
  UpdateMentorshipAssignmentInput,
  UpdatePlanEventInput,
  UpdatePlanTaskInput,
} from "@mentor/validation";

export interface CoachTaskFormValues {
  title: string;
  taskDate: string;
  startTime: string;
  endTime: string;
  coachNote: string;
  attendeeIds: string[];
}

export type CoachTaskCreate =
  | { kind: "PERSONAL"; input: CreatePlanTaskInput }
  | { kind: "BATCH"; input: CreateMentorshipBatchAssignmentInput };

export function buildCoachTaskCreate(
  values: CoachTaskFormValues,
): CoachTaskCreate {
  const task = {
    title: values.title.trim(),
    taskDate: values.taskDate,
    startTime: optionalTime(values.startTime),
    endTime: optionalTime(values.endTime),
  };
  if (values.attendeeIds.length === 0) {
    return { kind: "PERSONAL", input: task };
  }
  return {
    kind: "BATCH",
    input: {
      studentIds: values.attendeeIds,
      task: {
        ...task,
        coachNote: optionalText(values.coachNote),
      },
    },
  };
}

export type CoachTaskMutationTarget =
  | { kind: "PERSONAL"; taskId: string }
  | { kind: "ASSIGNMENT"; studentId: string; taskId: string }
  | { kind: "GROUP"; assignmentGroupId: string; studentIds: string[] };

export function taskMutationTarget(
  task: CoachPlanGroupedTaskDto,
): CoachTaskMutationTarget | null {
  if (task.participants.length === 0) {
    return task.status === "PENDING"
      ? { kind: "PERSONAL", taskId: task.id }
      : null;
  }
  const pending = task.participants.filter(
    (participant) => participant.status === "PENDING",
  );
  if (pending.length === 0) return null;
  if (task.assignmentGroupId) {
    return {
      kind: "GROUP",
      assignmentGroupId: task.assignmentGroupId,
      studentIds: pending.map((participant) => participant.studentId),
    };
  }
  if (pending.length !== 1) return null;
  return {
    kind: "ASSIGNMENT",
    studentId: pending[0]!.studentId,
    taskId: pending[0]!.taskId,
  };
}

export interface CoachTaskEditValues {
  title: string;
  taskDate: string;
  startTime: string;
  endTime: string;
  coachNote: string;
}

export function buildCoachTaskUpdate(
  target: CoachTaskMutationTarget,
  values: CoachTaskEditValues,
):
  | UpdatePlanTaskInput
  | UpdateMentorshipAssignmentInput
  | UpdateMentorshipAssignmentGroupInput {
  const common = {
    title: values.title.trim(),
    startTime: optionalTime(values.startTime),
    endTime: optionalTime(values.endTime),
  };
  if (target.kind === "PERSONAL") return common;
  const assignment = {
    ...common,
    taskDate: values.taskDate,
    coachNote: optionalText(values.coachNote),
  };
  return target.kind === "GROUP"
    ? { studentIds: target.studentIds, ...assignment }
    : assignment;
}

export interface CoachEventFormValues {
  title: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  attendeeIds: string[];
  recurrenceFrequency: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  recurrenceEndKind: "COUNT" | "DATE";
  recurrenceCount: number;
  recurrenceEndDate: string;
}

export function buildCoachEventCreate(
  values: CoachEventFormValues,
): CreatePlanEventInput {
  const recurrence =
    values.recurrenceFrequency === "NONE"
      ? null
      : {
          frequency: values.recurrenceFrequency,
          end:
            values.recurrenceEndKind === "COUNT"
              ? { kind: "COUNT" as const, count: values.recurrenceCount }
              : { kind: "DATE" as const, date: values.recurrenceEndDate },
        };
  return {
    title: values.title.trim(),
    description: optionalText(values.description),
    eventDate: values.eventDate,
    startTime: optionalTime(values.startTime),
    endTime: optionalTime(values.endTime),
    attendeeIds: values.attendeeIds,
    recurrence,
  };
}

export function buildCoachEventUpdate(
  values: CoachEventFormValues,
  scope: PlanEventMutationScope,
): UpdatePlanEventInput {
  const create = buildCoachEventCreate(values);
  if (scope === "OCCURRENCE") {
    return {
      scope,
      title: create.title,
      description: create.description,
      eventDate: create.eventDate,
      startTime: create.startTime,
      endTime: create.endTime,
      attendeeIds: create.attendeeIds,
    };
  }
  return {
    scope,
    ...create,
  };
}

export function eventMutationScope(
  seriesId: string | null,
  selected: PlanEventMutationScope | null,
): PlanEventMutationScope | null {
  return seriesId ? selected : "OCCURRENCE";
}

export function isCoachEventMutable(
  event: { status: string; eventDate: string },
  today: string,
): boolean {
  return event.status === "SCHEDULED" && event.eventDate >= today;
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function optionalTime(value: string): string | null {
  return value === "" ? null : value;
}
