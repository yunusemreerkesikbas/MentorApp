import {
  http,
  mentorshipCoachControllerListPlanningTasks,
} from "@mentor/api-client";
import type {
  CoachPlanEventDto,
  CoachPlanItemDto,
  MentorshipPlanningTaskDto,
  Paginated,
  PlanTaskDto,
} from "@mentor/types";
import type {
  CancelPlanEventInput,
  CreateMentorshipBatchAssignmentInput,
  CreatePlanEventInput,
  RemoveMentorshipAssignmentGroupInput,
  UpdateMentorshipAssignmentGroupInput,
  UpdateMentorshipAssignmentInput,
  UpdatePlanEventInput,
} from "@mentor/validation";

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

async function collectAllPages<T>(
  label: string,
  loadPage: (page: number) => Promise<Paginated<T>>,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let total = 0;
  do {
    if (page > MAX_PAGES) {
      throw new Error(`${label} pagination exceeded ${MAX_PAGES} pages`);
    }
    if (signal?.aborted) throw new Error("Aborted");
    const result = await loadPage(page);
    if (signal?.aborted) throw new Error("Aborted");
    if (result.page !== page) {
      throw new Error(`${label} pagination ignored the page cursor`);
    }
    if (result.items.length === 0 && items.length < result.total) {
      throw new Error(`${label} pagination ended before total was reached`);
    }
    items.push(...result.items);
    total = result.total;
    page += 1;
  } while (items.length < total);
  return items;
}

export function fetchPlanningTasks(
  studentId: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<MentorshipPlanningTaskDto[]> {
  return collectAllPages(
    "Planning tasks",
    (page) =>
      mentorshipCoachControllerListPlanningTasks(
        studentId,
        { from, to, page, pageSize: PAGE_SIZE },
        { signal },
      ) as unknown as Promise<Paginated<MentorshipPlanningTaskDto>>,
    signal,
  );
}

export async function fetchCoachPlan(input: {
  from: string;
  to: string;
  studentId?: string;
  signal?: AbortSignal;
}): Promise<CoachPlanItemDto[]> {
  return collectAllPages(
    "Coach plan",
    (page) => {
      const params = [
        `from=${encodeURIComponent(input.from)}`,
        `to=${encodeURIComponent(input.to)}`,
        `page=${page}`,
        `pageSize=${PAGE_SIZE}`,
      ];
      if (input.studentId) {
        params.push(`studentId=${encodeURIComponent(input.studentId)}`);
      }
      return http<Paginated<CoachPlanItemDto>>(
        `/v1/mentorship/plan?${params.join("&")}`,
        { signal: input.signal },
      ) as Promise<Paginated<CoachPlanItemDto>>;
    },
    input.signal,
  );
}

export async function assignTasksBatch(
  input: CreateMentorshipBatchAssignmentInput,
): Promise<PlanTaskDto[]> {
  return (await http<PlanTaskDto[]>("/v1/mentorship/assignments", {
    method: "POST",
    body: JSON.stringify(input),
  })) as PlanTaskDto[];
}

export async function updateAssignment(
  studentId: string,
  assignmentId: string,
  input: UpdateMentorshipAssignmentInput,
): Promise<PlanTaskDto> {
  return (await http<PlanTaskDto>(
    `/v1/mentorship/students/${encodeURIComponent(studentId)}/assignments/${encodeURIComponent(assignmentId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  )) as PlanTaskDto;
}

export async function removeAssignment(
  studentId: string,
  assignmentId: string,
): Promise<void> {
  await http(
    `/v1/mentorship/students/${encodeURIComponent(studentId)}/assignments/${encodeURIComponent(assignmentId)}`,
    { method: "DELETE" },
  );
}

export async function updateAssignmentGroup(
  assignmentGroupId: string,
  input: UpdateMentorshipAssignmentGroupInput,
): Promise<PlanTaskDto[]> {
  return (await http<PlanTaskDto[]>(
    `/v1/mentorship/assignment-groups/${encodeURIComponent(assignmentGroupId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  )) as PlanTaskDto[];
}

export async function removeAssignmentGroup(
  assignmentGroupId: string,
  input: RemoveMentorshipAssignmentGroupInput,
): Promise<void> {
  await http(
    `/v1/mentorship/assignment-groups/${encodeURIComponent(assignmentGroupId)}`,
    { method: "DELETE", body: JSON.stringify(input) },
  );
}

export async function createCoachPlanEvent(
  input: CreatePlanEventInput,
): Promise<CoachPlanEventDto> {
  return (await http<CoachPlanEventDto>("/v1/mentorship/events", {
    method: "POST",
    body: JSON.stringify(input),
  })) as CoachPlanEventDto;
}

export async function updateCoachPlanEvent(
  eventId: string,
  input: UpdatePlanEventInput,
): Promise<CoachPlanEventDto> {
  return (await http<CoachPlanEventDto>(
    `/v1/mentorship/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  )) as CoachPlanEventDto;
}

export async function cancelCoachPlanEvent(
  eventId: string,
  input: CancelPlanEventInput,
): Promise<void> {
  await http(`/v1/mentorship/events/${encodeURIComponent(eventId)}/cancel`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
