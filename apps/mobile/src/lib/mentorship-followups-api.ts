import {
  mentorshipFollowupControllerCreateFollowup,
  mentorshipFollowupControllerGetFollowupAvailability,
  mentorshipFollowupControllerListFollowups,
  mentorshipFollowupControllerListSharedFollowups,
  mentorshipFollowupControllerRespondToFollowup,
  mentorshipFollowupControllerUpdateFollowup,
} from "@mentor/api-client";
import type {
  MentorshipFollowupDto,
  MentorshipSharedFollowupDto,
  Paginated,
} from "@mentor/types";
import type {
  CreateMentorshipFollowupInput,
  RespondMentorshipFollowupInput,
  UpdateMentorshipFollowupInput,
} from "@mentor/validation";

export async function fetchFollowupAvailability(
  signal?: AbortSignal,
): Promise<{ enabled: boolean }> {
  return (await mentorshipFollowupControllerGetFollowupAvailability({
    signal,
  })) as unknown as { enabled: boolean };
}

export async function fetchMentorshipFollowups(
  query: {
    studentId?: string;
    view?: "ALL" | "ACTIONABLE";
    page: number;
    pageSize: number;
  },
  signal?: AbortSignal,
): Promise<Paginated<MentorshipFollowupDto>> {
  return (await mentorshipFollowupControllerListFollowups(query, {
    signal,
  })) as unknown as Paginated<MentorshipFollowupDto>;
}

export async function fetchSharedFollowups(
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<Paginated<MentorshipSharedFollowupDto>> {
  return (await mentorshipFollowupControllerListSharedFollowups(
    { page, pageSize },
    { signal },
  )) as unknown as Paginated<MentorshipSharedFollowupDto>;
}

export async function createFollowup(
  studentId: string,
  input: CreateMentorshipFollowupInput,
): Promise<MentorshipFollowupDto> {
  return (await mentorshipFollowupControllerCreateFollowup(
    studentId,
    input,
  )) as unknown as MentorshipFollowupDto;
}

export async function updateFollowup(
  studentId: string,
  followupId: string,
  input: UpdateMentorshipFollowupInput,
): Promise<MentorshipFollowupDto> {
  return (await mentorshipFollowupControllerUpdateFollowup(
    studentId,
    followupId,
    input,
  )) as unknown as MentorshipFollowupDto;
}

export async function respondToFollowup(
  followupId: string,
  input: RespondMentorshipFollowupInput,
): Promise<MentorshipSharedFollowupDto> {
  return (await mentorshipFollowupControllerRespondToFollowup(
    followupId,
    input,
  )) as unknown as MentorshipSharedFollowupDto;
}
