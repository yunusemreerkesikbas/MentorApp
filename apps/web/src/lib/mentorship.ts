import type {
  MentorshipInviteCodeDto,
  MentorshipInvitationPreviewDto,
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

/** The coach's current invite code, or null when they have never issued one. */
export async function fetchInviteCode(): Promise<MentorshipInviteCodeDto | null> {
  return (
    ((await http<MentorshipInviteCodeDto>("/v1/mentorship/invite-code")) as
      | MentorshipInviteCodeDto
      | undefined) ?? null
  );
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

/** Assign plan tasks to a student. They land in the student's own plan screen, badged. */
export async function assignTasks(
  studentId: string,
  tasks: { title: string; subject?: string | null; taskDate?: string }[],
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

export async function endMyCoachLink(): Promise<void> {
  await http("/v1/mentorship/my-coach", { method: "DELETE" });
}
