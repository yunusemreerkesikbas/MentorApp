import { z } from "zod";
import { planTaskFieldsSchema, refinePlanTaskTimes } from "./coaching.js";
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

/**
 * One assigned task. Reuses the plan-task shape so a coach cannot write something the student could
 * not have written themselves, minus `description`: that field is the student's own note on their
 * own plan, and the coach report deliberately never reads it back. Letting a coach write into a
 * box they can never see again would make the report's omission look like a bug instead of a rule.
 */
export const mentorshipAssignmentTaskSchema = planTaskFieldsSchema
  .omit({ description: true })
  // `.strict()`: a dropped field must be REFUSED, not silently stripped. Accepting a description
  // and quietly discarding it would leave the coach believing they wrote a note that never existed.
  .strict()
  .superRefine(refinePlanTaskTimes);

/** Cap mirrors `bulkCreatePlanTasksSchema` (three weeks of days). */
export const createMentorshipAssignmentsSchema = z.object({
  tasks: mentorshipAssignmentTaskSchema.array().min(1).max(21),
});
export type CreateMentorshipAssignmentsInput = z.infer<
  typeof createMentorshipAssignmentsSchema
>;
