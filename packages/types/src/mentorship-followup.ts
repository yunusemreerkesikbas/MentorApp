export type MentorshipFollowupResponse = "PENDING" | "ACCEPTED" | "CHANGE_REQUESTED";
export type MentorshipFollowupStatus = "OPEN" | "COMPLETED" | "CANCELLED";

export interface MentorshipFollowupDto {
  id: string;
  studentId: string;
  studentDisplayName: string;
  title: string;
  privateNote: string | null;
  sharedDecision: string | null;
  response: MentorshipFollowupResponse;
  followUpDate: string | null;
  status: MentorshipFollowupStatus;
  version: number;
  replacesId: string | null;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  closedAt: string | null;
}

/** Explicit student contract: coach-only fields must never cross this boundary. */
export interface MentorshipSharedFollowupDto {
  id: string;
  sharedDecision: string;
  response: MentorshipFollowupResponse;
  followUpDate: string | null;
  status: MentorshipFollowupStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  closedAt: string | null;
}
