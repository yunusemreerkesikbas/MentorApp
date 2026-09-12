import type {
  MentorshipFollowupDto,
  MentorshipSharedFollowupDto,
  Paginated,
} from "@mentor/types";
import type {
  CreateMentorshipFollowupInput,
  ListMentorshipFollowupsQuery,
  RespondMentorshipFollowupInput,
  UpdateMentorshipFollowupInput,
} from "@mentor/validation";
import { http } from "@mentor/api-client";

/**
 * Typed wrappers over follow-up endpoints. Hand-written `http` calls, same pattern as
 * `lib/mentorship.ts`, so screens keep working even when generated DTO schemas lag.
 */

export async function fetchFollowupAvailability(): Promise<{ enabled: boolean }> {
  return (await http<{ enabled: boolean }>("/v1/mentorship/followups/availability")) as {
    enabled: boolean;
  };
}

export async function fetchMentorshipFollowups(
  query: ListMentorshipFollowupsQuery,
): Promise<Paginated<MentorshipFollowupDto>> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    view: query.view,
  });
  if (query.studentId) params.set("studentId", query.studentId);
  return (await http<Paginated<MentorshipFollowupDto>>(
    `/v1/mentorship/followups?${params}`,
  )) as Paginated<MentorshipFollowupDto>;
}

export async function fetchMyCoachFollowups(
  page: number,
  pageSize: number,
): Promise<Paginated<MentorshipSharedFollowupDto>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return (await http<Paginated<MentorshipSharedFollowupDto>>(
    `/v1/mentorship/my-coach/followups?${params}`,
  )) as Paginated<MentorshipSharedFollowupDto>;
}

export async function createMentorshipFollowup(
  studentId: string,
  input: CreateMentorshipFollowupInput,
): Promise<MentorshipFollowupDto> {
  return (await http<MentorshipFollowupDto>(
    `/v1/mentorship/students/${encodeURIComponent(studentId)}/followups`,
    { method: "POST", body: JSON.stringify(input) },
  )) as MentorshipFollowupDto;
}

export async function updateMentorshipFollowup(
  studentId: string,
  followupId: string,
  input: UpdateMentorshipFollowupInput,
): Promise<MentorshipFollowupDto> {
  return (await http<MentorshipFollowupDto>(
    `/v1/mentorship/students/${encodeURIComponent(studentId)}/followups/${encodeURIComponent(followupId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  )) as MentorshipFollowupDto;
}

export async function respondToMentorshipFollowup(
  followupId: string,
  input: RespondMentorshipFollowupInput,
): Promise<MentorshipSharedFollowupDto> {
  return (await http<MentorshipSharedFollowupDto>(
    `/v1/mentorship/my-coach/followups/${encodeURIComponent(followupId)}/response`,
    { method: "PUT", body: JSON.stringify(input) },
  )) as MentorshipSharedFollowupDto;
}
