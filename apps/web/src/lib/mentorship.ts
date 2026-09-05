import type {
  MentorshipCoachOverviewDto,
  MentorshipInviteCodeDto,
  MentorshipInvitationPreviewDto,
  MentorshipProgramTemplateDto,
  MentorshipProgramTemplateTaskDto,
  MentorshipRosterRowDto,
  MentorshipStudentReportDto,
  MyCoachDto,
  Paginated,
  PlanTaskDto,
} from "@mentor/types";
import { http } from "@mentor/api-client";

/**
 * Typed wrappers over the human-coach surface (`/v1/mentorship`). Hand-written `http` calls,
 * mirroring lib/study-rooms.ts — the generated client carries no response schemas for these DTOs.
 *
 * NOT the AI coach: that lives in lib/coach.ts and talks to `/v1/coach/*`.
 */

// --- coach side ---------------------------------------------------------------------------

/**
 * The coach's landing state: invite code, seats taken out of the cap, and the data-scope contract.
 * One call, because the roster header renders all three together.
 */
export async function fetchOverview(): Promise<MentorshipCoachOverviewDto> {
  return (await http<MentorshipCoachOverviewDto>(
    "/v1/mentorship/overview",
  )) as MentorshipCoachOverviewDto;
}

/** Issue a fresh code. The previous one stops working immediately. */
export async function rotateInviteCode(): Promise<MentorshipInviteCodeDto> {
  return (await http<MentorshipInviteCodeDto>("/v1/mentorship/invite-code", {
    method: "POST",
  })) as MentorshipInviteCodeDto;
}

export async function fetchRoster(
  status: "ACTIVE" | "ENDED" = "ACTIVE",
): Promise<Paginated<MentorshipRosterRowDto>> {
  return (await http<Paginated<MentorshipRosterRowDto>>(
    `/v1/mentorship/students?status=${status}&pageSize=100`,
  )) as Paginated<MentorshipRosterRowDto>;
}

export async function fetchStudentReport(
  studentId: string,
): Promise<MentorshipStudentReportDto> {
  return (await http<MentorshipStudentReportDto>(
    `/v1/mentorship/students/${encodeURIComponent(studentId)}`,
  )) as MentorshipStudentReportDto;
}

/** One row of the week composer. `topic` requires `subject`; the API refuses the pair otherwise. */
export interface MentorshipAssignmentDraft {
  title: string;
  subject?: string | null;
  topic?: string | null;
  taskDate?: string;
  /** The coach's own instruction. Read back to them in the report — unlike the student's note. */
  coachNote?: string | null;
}

/**
 * Assign plan tasks to a student. They land in the student's own plan screen, badged.
 * Up to 21 in one call (`createMentorshipAssignmentsSchema`) — a 22nd is refused, not truncated.
 */
export async function assignTasks(
  studentId: string,
  tasks: MentorshipAssignmentDraft[],
): Promise<PlanTaskDto[]> {
  return (await http<PlanTaskDto[]>(
    `/v1/mentorship/students/${encodeURIComponent(studentId)}/assignments`,
    { method: "POST", body: JSON.stringify({ tasks }) },
  )) as PlanTaskDto[];
}

export async function endStudentLink(studentId: string): Promise<void> {
  await http(`/v1/mentorship/students/${encodeURIComponent(studentId)}`, {
    method: "DELETE",
  });
}

/** The coach's saved weekly programs, newest edit first. */
export async function fetchTemplates(): Promise<MentorshipProgramTemplateDto[]> {
  return (await http<MentorshipProgramTemplateDto[]>(
    "/v1/mentorship/templates",
  )) as MentorshipProgramTemplateDto[];
}

/**
 * Save under a name. Saving over an existing name replaces it — that is the edit path, which is
 * why there is no PUT here and none on the API.
 */
export async function saveTemplate(input: {
  name: string;
  examType: string | null;
  tasks: MentorshipProgramTemplateTaskDto[];
}): Promise<MentorshipProgramTemplateDto> {
  return (await http<MentorshipProgramTemplateDto>("/v1/mentorship/templates", {
    method: "POST",
    body: JSON.stringify(input),
  })) as MentorshipProgramTemplateDto;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await http<void>(`/v1/mentorship/templates/${encodeURIComponent(templateId)}`, {
    method: "DELETE",
  });
}

// --- student side -------------------------------------------------------------------------

/**
 * What the student is asked to consent to. The code goes in the body, not the URL — it is a
 * bearer secret and URLs end up in logs, referrers and history.
 */
export async function previewInvitation(
  code: string,
): Promise<MentorshipInvitationPreviewDto> {
  return (await http<MentorshipInvitationPreviewDto>(
    "/v1/mentorship/invitations/preview",
    { method: "POST", body: JSON.stringify({ code }) },
  )) as MentorshipInvitationPreviewDto;
}

export async function acceptInvitation(code: string): Promise<MyCoachDto> {
  return (await http<MyCoachDto>("/v1/mentorship/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ code }),
  })) as MyCoachDto;
}

/** Null when the student has no coach. */
export async function fetchMyCoach(): Promise<MyCoachDto | null> {
  return (
    ((await http<MyCoachDto>("/v1/mentorship/my-coach")) as MyCoachDto | undefined) ?? null
  );
}

/**
 * The coach's standing note to one student. `null` removes it.
 *
 * PUT, not POST: there is one note per link and writing replaces it. Not a message thread —
 * in-app conversation is Phase 3.
 */
export async function setCoachNote(studentId: string, body: string | null): Promise<void> {
  await http(`/v1/mentorship/students/${encodeURIComponent(studentId)}/note`, {
    method: "PUT",
    body: JSON.stringify({ body }),
  });
}

export async function endMyCoachLink(): Promise<void> {
  await http("/v1/mentorship/my-coach", { method: "DELETE" });
}
