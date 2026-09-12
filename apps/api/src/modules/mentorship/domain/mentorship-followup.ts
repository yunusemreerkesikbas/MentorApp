import type { MentorshipFollowupDto, MentorshipSharedFollowupDto } from "@mentor/types";
import type { FollowupRow } from "../infrastructure/mentorship-followup.repository";

/** Whitelist projection; never spread a database or coach DTO onto the student response. */
export function toSharedFollowup(row: FollowupRow): MentorshipSharedFollowupDto {
  if (row.sharedDecision === null) throw new Error("Private follow-up cannot be shared");
  return {
    id: row.id, sharedDecision: row.sharedDecision, response: row.response,
    followUpDate: row.followUpDate, status: row.status, version: row.version,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null, closedAt: row.closedAt?.toISOString() ?? null,
  };
}

export function toCoachFollowup(row: FollowupRow, studentId: string, studentDisplayName: string): MentorshipFollowupDto {
  return {
    id: row.id, studentId, studentDisplayName, title: row.title, privateNote: row.privateNote,
    sharedDecision: row.sharedDecision, response: row.response, followUpDate: row.followUpDate,
    status: row.status, version: row.version, replacesId: row.replacesId,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null, closedAt: row.closedAt?.toISOString() ?? null,
  };
}

export function followupToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
