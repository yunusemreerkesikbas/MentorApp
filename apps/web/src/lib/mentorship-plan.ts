import type {
  CoachPlanEventDto,
  CoachPlanItemDto,
  MentorshipRosterRowDto,
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
import { http } from "@mentor/api-client";

const PAGE_SIZE = 100;
/** Seat cap is dozens; ten pages is already far past that. A runaway total must not hammer the API. */
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
    signal?.throwIfAborted();
    const result = await loadPage(page);
    signal?.throwIfAborted();
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

/** Complete active roster for calendar filters; a coach must never lose students after page one. */
export async function fetchActiveRoster(signal?: AbortSignal): Promise<MentorshipRosterRowDto[]> {
  return collectAllPages(
    "Active roster",
    (page) =>
      http<Paginated<MentorshipRosterRowDto>>(
        `/v1/mentorship/students?status=ACTIVE&page=${page}&pageSize=${PAGE_SIZE}`,
        { signal },
      ) as Promise<Paginated<MentorshipRosterRowDto>>,
    signal,
  );
}

/** All calendar rows for one bounded range, preserving the server's authoritative order. */
export async function fetchCoachPlan(input: {
  from: string;
  to: string;
  studentId?: string;
  signal?: AbortSignal;
}): Promise<CoachPlanItemDto[]> {
  return collectAllPages(
    "Coach plan",
    (page) => {
      const query = new URLSearchParams({ from: input.from, to: input.to });
      if (input.studentId) query.set("studentId", input.studentId);
      query.set("page", String(page));
      query.set("pageSize", String(PAGE_SIZE));
      return http<Paginated<CoachPlanItemDto>>(
        `/v1/mentorship/plan?${query}`,
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
