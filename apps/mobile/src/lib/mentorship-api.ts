import { http } from "@mentor/api-client";
import type {
  MentorshipApplicationDto,
  MentorshipBriefDto,
  MentorshipCoachOverviewDto,
  MentorshipCoachRegistrationStateDto,
  MentorshipCohortBriefDto,
  MentorshipInvitationPreviewDto,
  MentorshipInviteCodeDto,
  MentorshipRosterRowDto,
  MentorshipSharedDataDto,
  MentorshipStudentReportDto,
  MyCoachDto,
  Paginated,
  PlanTaskDto,
} from "@mentor/types";
import type { UpdateCoachProfileInput } from "@mentor/validation";

export async function fetchCoachRegistrationState(): Promise<MentorshipCoachRegistrationStateDto> {
  return (await http<MentorshipCoachRegistrationStateDto>(
    "/v1/mentorship/coach-registration/mine",
  )) as MentorshipCoachRegistrationStateDto;
}

export async function updateCoachProfile(
  input: UpdateCoachProfileInput,
): Promise<MentorshipApplicationDto> {
  return (await http<MentorshipApplicationDto>(
    "/v1/mentorship/coach-registration/mine",
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  )) as MentorshipApplicationDto;
}

export async function fetchMentorshipOverview(): Promise<MentorshipCoachOverviewDto> {
  return (await http<MentorshipCoachOverviewDto>(
    "/v1/mentorship/overview",
  )) as MentorshipCoachOverviewDto;
}

export async function rotateInviteCode(): Promise<MentorshipInviteCodeDto> {
  return (await http<MentorshipInviteCodeDto>("/v1/mentorship/invite-code", {
    method: "POST",
  })) as MentorshipInviteCodeDto;
}

export async function fetchRoster(
  status: "ACTIVE" | "ENDED" = "ACTIVE",
): Promise<MentorshipRosterRowDto[]> {
  const page = await http<Paginated<MentorshipRosterRowDto>>(
    `/v1/mentorship/students?status=${status}&pageSize=100`,
  );
  return page?.items ?? [];
}

export async function fetchStudentReport(
  studentId: string,
): Promise<MentorshipStudentReportDto> {
  return (await http<MentorshipStudentReportDto>(
    `/v1/mentorship/students/${encodeURIComponent(studentId)}`,
  )) as MentorshipStudentReportDto;
}

export async function setStudentAttention(
  studentId: string,
  attended: boolean,
): Promise<void> {
  await http(`/v1/mentorship/students/${encodeURIComponent(studentId)}/attention`, {
    method: "PUT",
    body: JSON.stringify({ attended }),
  });
}

export async function assignStudentTasks(
  studentId: string,
  tasks: {
    title: string;
    subject?: string | null;
    topic?: string | null;
    taskDate?: string;
    coachNote?: string | null;
  }[],
): Promise<PlanTaskDto[]> {
  return (
    (await http<PlanTaskDto[]>(
      `/v1/mentorship/students/${encodeURIComponent(studentId)}/assignments`,
      {
        method: "POST",
        body: JSON.stringify({ tasks }),
      },
    )) ?? []
  );
}

export async function setCoachNote(
  studentId: string,
  body: string | null,
): Promise<void> {
  await http(`/v1/mentorship/students/${encodeURIComponent(studentId)}/note`, {
    method: "PUT",
    body: JSON.stringify({ body }),
  });
}

export async function generateStudentBrief(
  studentId: string,
): Promise<MentorshipBriefDto> {
  return (await http<MentorshipBriefDto>(
    `/v1/mentorship/students/${encodeURIComponent(studentId)}/brief`,
    { method: "POST" },
  )) as MentorshipBriefDto;
}

export async function fetchCohortBrief(): Promise<MentorshipCohortBriefDto | null> {
  return (
    ((await http<MentorshipCohortBriefDto>("/v1/mentorship/brief")) as
      | MentorshipCohortBriefDto
      | undefined) ?? null
  );
}

export async function generateCohortBrief(): Promise<MentorshipCohortBriefDto> {
  return (await http<MentorshipCohortBriefDto>("/v1/mentorship/brief", {
    method: "POST",
  })) as MentorshipCohortBriefDto;
}

export async function endStudentLink(studentId: string): Promise<void> {
  await http(`/v1/mentorship/students/${encodeURIComponent(studentId)}`, {
    method: "DELETE",
  });
}

// --- Student side (/v1/mentorship/my-coach & invitations) ---

export async function fetchMyCoach(): Promise<MyCoachDto | null> {
  return (
    ((await http<MyCoachDto>("/v1/mentorship/my-coach")) as
      | MyCoachDto
      | undefined) ?? null
  );
}

export async function fetchSharedData(): Promise<MentorshipSharedDataDto | null> {
  const res = await http<MentorshipSharedDataDto>(
    "/v1/mentorship/my-coach/data",
  );
  return res && "examType" in res ? res : null;
}

export async function previewInvitation(
  code: string,
): Promise<MentorshipInvitationPreviewDto> {
  return (await http<MentorshipInvitationPreviewDto>(
    "/v1/mentorship/invitations/preview",
    {
      method: "POST",
      body: JSON.stringify({ code: code.trim() }),
    },
  )) as MentorshipInvitationPreviewDto;
}

export async function acceptInvitation(code: string): Promise<MyCoachDto> {
  return (await http<MyCoachDto>("/v1/mentorship/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ code: code.trim() }),
  })) as MyCoachDto;
}

export async function setMyNote(body: string | null): Promise<void> {
  await http("/v1/mentorship/my-coach/note", {
    method: "PUT",
    body: JSON.stringify({ body }),
  });
}

export async function endMyCoachLink(): Promise<void> {
  await http("/v1/mentorship/my-coach", {
    method: "DELETE",
  });
}
