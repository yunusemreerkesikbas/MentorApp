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

/** Complete active roster for calendar filters; a coach must never lose students after page one. */
export async function fetchActiveRoster(): Promise<MentorshipRosterRowDto[]> {
  const items: MentorshipRosterRowDto[] = [];
  let page = 1;
  let total = 0;
  do {
    const result = (await http<Paginated<MentorshipRosterRowDto>>(
      `/v1/mentorship/students?status=ACTIVE&page=${page}&pageSize=${PAGE_SIZE}`,
    )) as Paginated<MentorshipRosterRowDto>;
    items.push(...result.items);
    total = result.total;
    if (result.items.length === 0 && items.length < total) {
      throw new Error("Active roster pagination ended before total was reached");
    }
    page += 1;
  } while (items.length < total);
  return items;
}

/** All calendar rows for one bounded range, preserving the server's authoritative order. */
export async function fetchCoachPlan(input: {
  from: string;
  to: string;
  studentId?: string;
}): Promise<CoachPlanItemDto[]> {
  const items: CoachPlanItemDto[] = [];
  let page = 1;
  let total = 0;
  do {
    const query = new URLSearchParams({ from: input.from, to: input.to });
    if (input.studentId) query.set("studentId", input.studentId);
    query.set("page", String(page));
    query.set("pageSize", String(PAGE_SIZE));
    const result = (await http<Paginated<CoachPlanItemDto>>(
      `/v1/mentorship/plan?${query}`,
    )) as Paginated<CoachPlanItemDto>;
    items.push(...result.items);
    total = result.total;
    if (result.items.length === 0 && items.length < total) {
      throw new Error("Coach plan pagination ended before total was reached");
    }
    page += 1;
  } while (items.length < total);
  return items;
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
