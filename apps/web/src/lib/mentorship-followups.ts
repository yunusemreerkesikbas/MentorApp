import {
  mentorshipFollowupControllerGetFollowupAvailability,
  mentorshipFollowupControllerListFollowups,
  mentorshipFollowupControllerCreateFollowup,
  mentorshipFollowupControllerUpdateFollowup,
  mentorshipFollowupControllerListSharedFollowups,
  mentorshipFollowupControllerRespondToFollowup,
} from "@mentor/api-client";
import type { CreateMentorshipFollowupInput, UpdateMentorshipFollowupInput, RespondMentorshipFollowupInput } from "@mentor/validation";

export const fetchFollowupAvailability = (signal?: AbortSignal) =>
  mentorshipFollowupControllerGetFollowupAvailability({ signal });
export const fetchMentorshipFollowups = (query: { studentId?: string; view?: "ALL" | "ACTIONABLE"; page: number; pageSize: number }, signal?: AbortSignal) =>
  mentorshipFollowupControllerListFollowups(query, { signal });
export const fetchSharedFollowups = (page: number, pageSize: number, signal?: AbortSignal) =>
  mentorshipFollowupControllerListSharedFollowups({ page, pageSize }, { signal });
export const createFollowup = (studentId: string, input: CreateMentorshipFollowupInput) =>
  mentorshipFollowupControllerCreateFollowup(studentId, input);
export const updateFollowup = (studentId: string, id: string, input: UpdateMentorshipFollowupInput) =>
  mentorshipFollowupControllerUpdateFollowup(studentId, id, input);
export const respondToFollowup = (id: string, input: RespondMentorshipFollowupInput) =>
  mentorshipFollowupControllerRespondToFollowup(id, input);
