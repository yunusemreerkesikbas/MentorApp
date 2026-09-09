import type {
  CoachPlanEventDto,
  CoachPlanGroupedTaskDto,
  PlanEventMutationScope,
} from "@mentor/types";
import type {
  CreateMentorshipBatchAssignmentInput,
  CreatePlanEventInput,
  CreatePlanTaskInput,
  MentorshipAssignmentVisibleSignature,
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
  | {
      kind: "GROUP";
      assignmentGroupId: string;
      studentIds: string[];
      expectedSignature: MentorshipAssignmentVisibleSignature;
    };

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
      expectedSignature: taskVisibleSignature(task),
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
    ? {
        studentIds: target.studentIds,
        expectedSignature: target.expectedSignature,
        ...assignment,
      }
    : assignment;
}

function taskVisibleSignature(
  task: CoachPlanGroupedTaskDto,
): MentorshipAssignmentVisibleSignature {
  return {
    taskDate: task.taskDate,
    title: task.title,
    subject: task.subject,
    topic: task.topic,
    startTime: task.startTime,
    endTime: task.endTime,
    coachNote: task.coachNote,
  };
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
  original: CoachPlanEventDto,
): UpdatePlanEventInput {
  const create = buildCoachEventCreate(values);
  const update: UpdatePlanEventInput = { scope };
  if (create.title !== original.title) update.title = create.title;
  if (create.description !== original.description) {
    update.description = create.description;
  }
  if (create.eventDate !== original.eventDate) {
    update.eventDate = create.eventDate;
  }
  if (create.startTime !== original.startTime) update.startTime = create.startTime;
  if (create.endTime !== original.endTime) update.endTime = create.endTime;
  if (!sameIds(create.attendeeIds, original.attendees.map(({ studentId }) => studentId))) {
    update.attendeeIds = create.attendeeIds;
  }
  if (
    scope === "SERIES" &&
    !sameRecurrence(create.recurrence, original.recurrence)
  ) {
    update.recurrence = create.recurrence;
  }
  return update;
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

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    left.every((id) => right.includes(id));
}

function sameRecurrence(
  left: CreatePlanEventInput["recurrence"],
  right: CoachPlanEventDto["recurrence"],
): boolean {
  if (left == null || right == null) return left == null && right == null;
  if (left.frequency !== right.frequency || left.end.kind !== right.end.kind) {
    return false;
  }
  return left.end.kind === "COUNT" && right.end.kind === "COUNT"
    ? left.end.count === right.end.count
    : left.end.kind === "DATE" &&
        right.end.kind === "DATE" &&
        left.end.date === right.end.date;
}
