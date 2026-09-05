import { z } from "zod";
import {
  planTaskFieldsSchema,
  refinePlanTaskTaxonomy,
  refinePlanTaskTimes,
} from "./coaching.js";
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

/** A coach's instruction on one assignment. Short on purpose: it renders inline under the task. */
export const MENTORSHIP_COACH_NOTE_MAX = 500;

/**
 * The coach's standing note to a student. Same 500-char ceiling as the per-task note: it is the
 * same voice at a different scope, and two limits would only be two things to keep in step.
 * An empty string means "clear it" — the client should not have to know that null is the API's
 * word for erasure.
 */
export const mentorshipCoachNoteSchema = z
  .object({
    body: z
      .string()
      .trim()
      .max(MENTORSHIP_COACH_NOTE_MAX)
      .nullable()
      .transform((value) => (value === null || value === "" ? null : value)),
  })
  .strict();
export type MentorshipCoachNoteInput = z.infer<typeof mentorshipCoachNoteSchema>;

/**
 * One assigned task. Reuses the plan-task shape so a coach cannot write something the student could
 * not have written themselves, minus `description`: that field is the STUDENT's own note on their
 * own plan, and the coach report deliberately never reads it back.
 *
 * The coach is not silenced, they simply have their own box: `coachNote` is written by the coach,
 * shown to the student, and read back to the coach in the report. Two people's words must not
 * share one column — that is the whole reason these are two fields and not one.
 */
export const mentorshipAssignmentTaskSchema = planTaskFieldsSchema
  .omit({ description: true })
  .extend({
    coachNote: z.string().trim().min(1).max(MENTORSHIP_COACH_NOTE_MAX).nullish(),
  })
  // `.strict()`: a dropped field must be REFUSED, not silently stripped. Accepting a description
  // and quietly discarding it would leave the coach believing they wrote a note that never existed.
  .strict()
  .superRefine(refinePlanTaskTimes)
  .superRefine(refinePlanTaskTaxonomy);

/** Cap mirrors `bulkCreatePlanTasksSchema` (three weeks of days). */
export const createMentorshipAssignmentsSchema = z.object({
  tasks: mentorshipAssignmentTaskSchema.array().min(1).max(21),
});
export type CreateMentorshipAssignmentsInput = z.infer<
  typeof createMentorshipAssignmentsSchema
>;

/** How many templates one coach may keep. Anti-abuse, not a business quota — hence a constant. */
export const MENTORSHIP_TEMPLATE_MAX = 20;
export const MENTORSHIP_TEMPLATE_NAME_MAX = 60;

/**
 * One task inside a saved program.
 *
 * Built from `planTaskFieldsSchema` rather than from `mentorshipAssignmentTaskSchema`: the latter
 * ends in `.superRefine`, which makes it a `ZodEffects`, and a `ZodEffects` cannot be `.omit()`-ed
 * or `.pick()`-ed. Same trap the note at the top of `planTaskFieldsSchema` warns about.
 *
 * `dayIndex` replaces `taskDate` — a template that stored dates could only ever be applied to the
 * week it was saved from. It is an offset from the PROGRAM's first day, normalized so the earliest
 * task is day 0, which is what makes a template re-datable onto any start day.
 *
 * The ceiling is 20, not 6: the composer's 21-task limit is explicitly "three weeks of days" and
 * stepping the week button leaves earlier drafts in place, so a composed program can already span
 * more than one week. A 0..6 range would have silently refused programs the composer can build.
 *
 * Times and `sortOrder` are absent because the composer's drafts carry neither; a template stores
 * exactly what the composer can hand back.
 */
export const mentorshipTemplateTaskSchema = planTaskFieldsSchema
  .pick({ title: true, subject: true, topic: true })
  .extend({
    /** 0..20 — days from the program's first day (three weeks, matching the 21-task ceiling). */
    dayIndex: z.coerce.number().int().min(0).max(20),
    coachNote: z.string().trim().min(1).max(MENTORSHIP_COACH_NOTE_MAX).nullish(),
  })
  // `.strict()` for the same reason the assignment schema is strict: a field we drop must be
  // refused, never silently stripped.
  .strict()
  .superRefine(refinePlanTaskTaxonomy);
export type MentorshipTemplateTaskInput = z.infer<typeof mentorshipTemplateTaskSchema>;

/**
 * Save (or overwrite) a template. There is no update endpoint: `(coach_id, name)` is unique and
 * saving under an existing name replaces it, so "edit" is "load, change, save under the same name".
 *
 * `examType` records which taxonomy the topics came from, so the composer can warn when a template
 * is loaded onto a student sitting a different exam. It is not validated against the content
 * module here — this schema is a boundary check, not a taxonomy lookup.
 */
export const saveMentorshipTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(MENTORSHIP_TEMPLATE_NAME_MAX),
    examType: z.string().trim().min(1).max(40).nullish(),
    /** Same 21 ceiling as an assignment call: a template is a week, and a week is what fits. */
    tasks: mentorshipTemplateTaskSchema.array().min(1).max(21),
  })
  .strict();
export type SaveMentorshipTemplateInput = z.infer<typeof saveMentorshipTemplateSchema>;

export const mentorshipTemplateParamSchema = z.object({
  templateId: z.string().uuid(),
});
export type MentorshipTemplateParam = z.infer<typeof mentorshipTemplateParamSchema>;
