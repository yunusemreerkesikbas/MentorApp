import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

/**
 * Mentorship (human coach ↔ student) input schemas — W8.
 * Leaf import only (`./pagination.js`, never `./index.js`) — see coaching.ts for the ESM cycle note.
 */

/** `MENTOR-KOC-` + 12 uppercase hex. Case-insensitive on the wire; normalized upstream. */
export const MENTORSHIP_INVITE_CODE_PATTERN = /^MENTOR-KOC-[0-9A-F]{12}$/;

export const mentorshipInviteCodeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(MENTORSHIP_INVITE_CODE_PATTERN, "invalid_code"),
});
export type MentorshipInviteCodeParam = z.infer<typeof mentorshipInviteCodeParamSchema>;

export const listMentorshipStudentsQuerySchema = paginationQuerySchema.extend({
  /** Default ACTIVE — a coach's roster is the active cohort; ENDED is opt-in history. */
  status: z.enum(["ACTIVE", "ENDED"]).default("ACTIVE"),
});
export type ListMentorshipStudentsQuery = z.infer<typeof listMentorshipStudentsQuerySchema>;

export const mentorshipStudentParamSchema = z.object({
  studentId: z.string().uuid(),
});
export type MentorshipStudentParam = z.infer<typeof mentorshipStudentParamSchema>;
