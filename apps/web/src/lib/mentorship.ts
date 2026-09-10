import type {
  MentorshipApplicationDto,
  MentorshipCoachRegistrationStateDto,
  MentorshipCoachOverviewDto,
  MentorshipAssignmentSuggestionsDto,
  MentorshipCohortBriefDto,
  MentorshipSharedDataDto,
  MentorshipInviteCodeDto,
  MentorshipBriefDto,
  MentorshipInvitationPreviewDto,
  MentorshipProgramTemplateDto,
  MentorshipProgramTemplateTaskDto,
  MentorshipRosterRowDto,
  MentorshipStudentReportDto,
  MyCoachDto,
  Paginated,
  PlanTaskDto,
} from "@mentor/types";
import type {
  RegisterCoachInput,
  UpdateCoachProfileInput,
} from "@mentor/validation";
import { http } from "@mentor/api-client";
export * from "./mentorship-plan";

/**
 * Typed wrappers over the human-coach surface (`/v1/mentorship`). Hand-written `http` calls,
 * mirroring lib/study-rooms.ts — the generated client carries no response schemas for these DTOs.
 *
 * NOT the AI coach: that lives in lib/coach.ts and talks to `/v1/coach/*`.
 */

// --- becoming a coach (self-service registration, roadmap §5 revised by APP-089) ------------

/**
 * Register as a coach. Writes the registry row and grants COACH.
 *
 * The admin's columns are absent from the body by design — the API refuses one that carries them.
 * Nobody reviews this before a student can read it, so the contact-detail check on `headline` and
 * `bio` is the only thing standing between this text and a consent screen.
 */
export async function registerCoach(
  input: RegisterCoachInput,
): Promise<MentorshipApplicationDto> {
  return (await http<MentorshipApplicationDto>("/v1/mentorship/coach-registration", {
    method: "POST",
    body: JSON.stringify(input),
  })) as MentorshipApplicationDto;
}

/**
 * Am I a coach, is the intake open, and does my invite code work yet.
 *
 * One call for all three because every screen asking one asks the others: the form needs
 * `registrationOpen` BEFORE it is filled in, and the coach panel needs `emailVerified` to explain a
 * locked invite code.
 */
export async function fetchCoachRegistrationState(): Promise<MentorshipCoachRegistrationStateDto> {
  return (await http<MentorshipCoachRegistrationStateDto>(
    "/v1/mentorship/coach-registration/mine",
  )) as MentorshipCoachRegistrationStateDto;
}

/**
 * The coach rewriting the two lines a student reads.
 *
 * PUT on the registration itself, because the ACTIVE row IS the profile — there is no second
 * resource. The admin's columns are not in the body and the API refuses one that carries them: a
 * coach editing the institution behind a verified badge would make the badge a lie.
 */
export async function updateCoachProfile(
  input: UpdateCoachProfileInput,
): Promise<MentorshipApplicationDto> {
  return (await http<MentorshipApplicationDto>("/v1/mentorship/coach-registration/mine", {
    method: "PUT",
    body: JSON.stringify(input),
  })) as MentorshipApplicationDto;
}

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

/**
 * Mark a student handled, or take the mark back.
 *
 * No flag list travels: the server evaluates what it is marking. A set chosen here could silence a
 * flag that appeared after this page rendered, and the API rejects the field outright.
 */
export async function setAttention(studentId: string, attended: boolean): Promise<void> {
  await http(`/v1/mentorship/students/${encodeURIComponent(studentId)}/attention`, {
    method: "PUT",
    body: JSON.stringify({ attended }),
  });
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

/**
 * Ask for the AI brief on one student. POST because it may spend an LLM call and a quota unit —
 * never something a page load can trigger. The API returns `model: "cache"` when the report has
 * not moved since the last one.
 */
export async function generateBrief(studentId: string): Promise<MentorshipBriefDto> {
  return (await http<MentorshipBriefDto>(
    `/v1/mentorship/students/${encodeURIComponent(studentId)}/brief`,
    { method: "POST" },
  )) as MentorshipBriefDto;
}

/**
 * This morning's cohort brief, if one was written. Free: no LLM call, no quota — which is why the
 * roster may ask for it on load. An empty body means none exists yet.
 */
export async function fetchCohortBrief(): Promise<MentorshipCohortBriefDto | null> {
  return (
    ((await http<MentorshipCohortBriefDto>("/v1/mentorship/brief")) as
      | MentorshipCohortBriefDto
      | undefined) ?? null
  );
}

/**
 * Write a new cohort brief. POST for `generateBrief`'s reason; the API returns `model: "cache"`
 * when the cohort has not moved, so pressing refresh twice costs nothing.
 */
export async function generateCohortBrief(): Promise<MentorshipCohortBriefDto> {
  return (await http<MentorshipCohortBriefDto>("/v1/mentorship/brief", {
    method: "POST",
  })) as MentorshipCohortBriefDto;
}

/**
 * Ask the model to draft a week for this student.
 *
 * POST because it spends an LLM call and a quota unit. It writes NOTHING — the tasks come back as
 * drafts for the composer, and the coach still submits them through `assignTasks`. Uncached on the
 * server, so calling it again really does produce a different week.
 */
export async function suggestAssignments(
  studentId: string,
): Promise<MentorshipAssignmentSuggestionsDto> {
  return (await http<MentorshipAssignmentSuggestionsDto>(
    `/v1/mentorship/students/${encodeURIComponent(studentId)}/assignment-suggestions`,
    { method: "POST" },
  )) as MentorshipAssignmentSuggestionsDto;
}

// --- student side -------------------------------------------------------------------------

/**
 * The numbers currently travelling to my coach.
 *
 * Free and read-only. Empty body when I have no coach: nothing is being shared, so there is nothing
 * to mirror. Its own call rather than a field on `fetchMyCoach` — see the API route's comment.
 */
export async function fetchSharedData(): Promise<MentorshipSharedDataDto | null> {
  const res = await http<MentorshipSharedDataDto>("/v1/mentorship/my-coach/data");
  return res && "examType" in res ? (res as MentorshipSharedDataDto) : null;
}

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
