/**
 * Coaching schemas (W2 daily loop + mood) — shared FE+BE (§8 single validation source).
 * Field copy is NOT here: user-facing messages are localized by the backend.
 */
import { z } from "zod";
import { CAREER_GROUPS } from "@mentor/types";
// NOTE: import from the leaf module, NOT "./index.js" — a barrel import here creates an
// index↔coaching cycle that crashes sync ESM-from-CJS loading (ts-node / node dist).
import { paginationQuerySchema } from "./pagination.js";

/** ISO calendar date (yyyy-mm-dd) that is also a real day. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) &&
      s === new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10),
    { message: "invalid_date" },
  );

export const PLAN_TASK_STATUSES = ["PENDING", "DONE"] as const;
export const SESSION_PRESETS = ["25_5", "50_10", "custom"] as const;
export const STUDY_SESSION_STATUSES = ["IN_PROGRESS", "COMPLETED", "ABANDONED"] as const;
/** Status values allowed when finalizing a session (complete / abandon). */
export const FINAL_STUDY_SESSION_STATUSES = ["COMPLETED", "ABANDONED"] as const;

/* --------------------------------- plan tasks --------------------------------- */

/** Wall-clock time of day, "HH:MM" (24h). */
export const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Max description length — a calendar note, not an essay. */
export const PLAN_TASK_DESCRIPTION_MAX = 2000;

/**
 * `startTime` null/absent = all-day item. `endTime` requires a `startTime` and must be later —
 * mirrors the `plan_tasks_time_range_chk` DB constraint (both sides, never one).
 */
function refinePlanTaskTimes(
  value: { startTime?: string | null; endTime?: string | null },
  ctx: z.RefinementCtx,
): void {
  const { startTime, endTime } = value;
  if (endTime === undefined || endTime === null) return;
  if (startTime === undefined || startTime === null) {
    ctx.addIssue({ code: "custom", message: "end_without_start", path: ["endTime"] });
    return;
  }
  if (endTime <= startTime) {
    ctx.addIssue({ code: "custom", message: "end_before_start", path: ["endTime"] });
  }
}

export const createPlanTaskSchema = z
  .object({
    /** Defaults to the server's "today" when omitted. */
    taskDate: isoDateSchema.optional(),
    title: z.string().trim().min(1).max(200),
    subject: z.string().trim().min(1).max(80).nullish(),
    /** Null/absent = all-day. */
    startTime: hhmmSchema.nullish(),
    endTime: hhmmSchema.nullish(),
    description: z.string().trim().max(PLAN_TASK_DESCRIPTION_MAX).nullish(),
    sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .superRefine(refinePlanTaskTimes);
export type CreatePlanTaskInput = z.infer<typeof createPlanTaskSchema>;

/** POST /v1/plan-tasks/bulk — user-confirmed batch add (e.g. accepted coach draft). */
export const bulkCreatePlanTasksSchema = z.object({
  tasks: createPlanTaskSchema.array().min(1).max(21),
});
export type BulkCreatePlanTasksInput = z.infer<typeof bulkCreatePlanTasksSchema>;

const planAdaptationMoveSchema = z.object({
  kind: z.literal("MOVE"),
  taskId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(80).nullable(),
  fromDate: isoDateSchema,
  toDate: isoDateSchema,
});

const planAdaptationAddSchema = z.object({
  kind: z.literal("ADD"),
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(80).nullable(),
  taskDate: isoDateSchema,
});

export const planAdaptationChangeSchema = z.discriminatedUnion("kind", [
  planAdaptationMoveSchema,
  planAdaptationAddSchema,
]);

export const applyPlanAdaptationSchema = z.object({
  planRevision: z.string().regex(/^[a-f0-9]{64}$/),
  changes: planAdaptationChangeSchema.array().min(1).max(5),
});
export type ApplyPlanAdaptationInput = z.infer<typeof applyPlanAdaptationSchema>;

/**
 * Times are patched as a PAIR: sending `endTime` without `startTime` in the same payload is
 * rejected (clearing = send both as null). Keeps the check payload-local instead of needing a
 * read-modify-validate round-trip against the stored row.
 */
export const updatePlanTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    subject: z.string().trim().min(1).max(80).nullish(),
    status: z.enum(PLAN_TASK_STATUSES).optional(),
    startTime: hhmmSchema.nullish(),
    endTime: hhmmSchema.nullish(),
    description: z.string().trim().max(PLAN_TASK_DESCRIPTION_MAX).nullish(),
    sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .superRefine(refinePlanTaskTimes)
  .refine((v) => Object.keys(v).length > 0, { message: "empty" });
export type UpdatePlanTaskInput = z.infer<typeof updatePlanTaskSchema>;

export const listPlanTasksQuerySchema = paginationQuerySchema
  .extend({
    /** Single-day filter — mutually exclusive with `from`/`to`. */
    date: isoDateSchema.optional(),
    /** Inclusive range start — requires `to`. */
    from: isoDateSchema.optional(),
    /** Inclusive range end — requires `from`. Max 62 days. */
    to: isoDateSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const hasDate = data.date !== undefined;
    const hasFrom = data.from !== undefined;
    const hasTo = data.to !== undefined;

    if (hasDate && (hasFrom || hasTo)) {
      ctx.addIssue({ code: "custom", message: "date_or_range", path: ["date"] });
      return;
    }

    if (hasFrom !== hasTo) {
      ctx.addIssue({
        code: "custom",
        message: "from_to_pair",
        path: hasFrom ? ["to"] : ["from"],
      });
      return;
    }

    if (hasFrom && hasTo) {
      if (data.from! > data.to!) {
        ctx.addIssue({ code: "custom", message: "invalid_range", path: ["to"] });
        return;
      }
      const fromMs = new Date(`${data.from}T12:00:00`).getTime();
      const toMs = new Date(`${data.to}T12:00:00`).getTime();
      const dayCount = Math.floor((toMs - fromMs) / 86_400_000) + 1;
      if (dayCount > 62) {
        ctx.addIssue({ code: "custom", message: "range_too_large", path: ["to"] });
      }
    }
  });
export type ListPlanTasksQuery = z.infer<typeof listPlanTasksQuerySchema>;

/** Calendar dot map — distinct task dates in an inclusive range (max 62 days). */
export const planTaskCalendarQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .superRefine((data, ctx) => {
    if (data.from > data.to) {
      ctx.addIssue({ code: "custom", message: "invalid_range", path: ["to"] });
      return;
    }
    const fromMs = new Date(`${data.from}T12:00:00`).getTime();
    const toMs = new Date(`${data.to}T12:00:00`).getTime();
    const dayCount = Math.floor((toMs - fromMs) / 86_400_000) + 1;
    if (dayCount > 62) {
      ctx.addIssue({ code: "custom", message: "range_too_large", path: ["to"] });
    }
  });
export type PlanTaskCalendarQuery = z.infer<typeof planTaskCalendarQuerySchema>;

/* ------------------------------- study sessions ------------------------------- */

export const startStudySessionSchema = z
  .object({
    preset: z.enum(SESSION_PRESETS),
    /** Required when preset is `custom`; 5-minute steps from 5 to 120. */
    focusMinutes: z.coerce
      .number()
      .int()
      .min(5)
      .max(120)
      .refine((v) => v % 5 === 0, { message: "invalid_focus_minutes_step" })
      .optional(),
    subject: z.string().trim().min(1).max(80).nullish(),
    /** When starting from a plan task deep-link; must belong to the current user. */
    planTaskId: z.string().uuid().optional(),
    /** ISO datetime; defaults to server "now" when omitted. */
    startedAt: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.preset === "custom" && data.focusMinutes == null) {
      ctx.addIssue({
        code: "custom",
        message: "focus_minutes_required",
        path: ["focusMinutes"],
      });
    }
  });
export type StartStudySessionInput = z.infer<typeof startStudySessionSchema>;

export const updateStudySessionSchema = z.object({
  status: z.enum(FINAL_STUDY_SESSION_STATUSES),
  actualFocusSeconds: z.coerce.number().int().min(0).max(86_400),
});
export type UpdateStudySessionInput = z.infer<typeof updateStudySessionSchema>;

/**
 * Post-session micro check-in (roadmap §258): a subjective effort/mood signal (1-3, 😩😐🙂)
 * with an optional "what challenged you" note. Attached to an already-finalized session so the
 * finalize path stays untouched; idempotent (re-submit overwrites).
 */
export const sessionFeedbackSchema = z.object({
  mood: z.coerce.number().int().min(1).max(3),
  struggleNote: z.string().trim().max(280).optional(),
});
export type SessionFeedbackInput = z.infer<typeof sessionFeedbackSchema>;

/** Paginated study-session history (most recent finalized first). */
export const listStudySessionsQuerySchema = paginationQuerySchema
  .extend({
    subject: z.string().trim().min(1).max(100).optional(),
    /** Inclusive UTC start day (yyyy-mm-dd) for `started_at` filter. */
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    /** Inclusive UTC end day (yyyy-mm-dd) for `started_at` filter. */
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "invalid_date_range",
    path: ["from"],
  });
export type ListStudySessionsQuery = z.infer<typeof listStudySessionsQuerySchema>;

/* ---------------------------------- mood -------------------------------------- */

export const createMoodCheckinSchema = z.object({
  /** 1 (very low) .. 5 (great). */
  mood: z.coerce.number().int().min(1).max(5),
  /** Optional subjective signal ("bugün seni en çok zorlayan konu"); blank → omitted. */
  struggleNote: z.string().trim().max(280).optional(),
});
export type CreateMoodCheckinInput = z.infer<typeof createMoodCheckinSchema>;

export const listMoodCheckinsQuerySchema = paginationQuerySchema;
export type ListMoodCheckinsQuery = z.infer<typeof listMoodCheckinsQuerySchema>;

/* -------------------------------- vision board -------------------------------- */

/** One text-based goal anchor per user ("hayal/hedef panosu"); upsert (idempotent per user). */
/**
 * Province plate code, zero-padded: 01–81. Rejects "00" and anything above 81, so a malformed
 * client value fails here instead of becoming a dangling FK at insert time.
 */
export const cityCodeSchema = z.string().regex(/^(0[1-9]|[1-7]\d|8[01])$/);

/**
 * `targetCityCode` is the normalized map selection; `targetCity` stays as the free-text fallback
 * for goals the province list can't express. A university is only meaningful alongside its city,
 * so the pair is enforced here — and the service additionally verifies the university really
 * belongs to that city (this schema can't know, and the client is not trusted).
 */
export const upsertVisionSchema = z
  .object({
    goalTitle: z.string().trim().min(1).max(120),
    targetCityCode: cityCodeSchema.nullish(),
    targetCity: z.string().trim().min(1).max(80).nullish(),
    targetUniversityId: z.string().uuid().nullish(),
    targetTitleId: z.string().uuid().nullish(),
    targetInstitutionId: z.string().uuid().nullish(),
    careerGroup: z.enum(CAREER_GROUPS).nullish(),
    motivation: z.string().trim().min(1).max(500).nullish(),
  })
  .refine((v) => !v.targetUniversityId || Boolean(v.targetCityCode), {
    message: "university_requires_city",
    path: ["targetCityCode"],
  });
export type UpsertVisionInput = z.infer<typeof upsertVisionSchema>;

/* -------------------------------- mock exams -------------------------------- */

export const mockExamSubjectInputSchema = z.object({
  subjectRef: z.string().trim().min(1).max(80),
  correct: z.coerce.number().int().min(0).max(500),
  wrong: z.coerce.number().int().min(0).max(500),
  blank: z.coerce.number().int().min(0).max(500),
});

export const createMockExamSchema = z
  .object({
    examId: z.string().uuid(),
    takenAt: z.string().datetime({ offset: true }).optional(),
    publisherName: z.string().trim().min(1).max(120).optional(),
    subjects: z.array(mockExamSubjectInputSchema).min(1).max(20),
  })
  .refine(
    (data) => new Set(data.subjects.map((s) => s.subjectRef)).size === data.subjects.length,
    { message: "duplicate_subject_ref" },
  );
export type CreateMockExamInput = z.infer<typeof createMockExamSchema>;

export const updateMockExamSchema = z
  .object({
    takenAt: z.string().datetime({ offset: true }),
    publisherName: z.string().trim().min(1).max(120).nullable(),
    subjects: z.array(mockExamSubjectInputSchema).min(1).max(20),
  })
  .refine(
    (data) => new Set(data.subjects.map((subject) => subject.subjectRef)).size === data.subjects.length,
    { message: "duplicate_subject_ref" },
  );
export type UpdateMockExamInput = z.infer<typeof updateMockExamSchema>;

export const analysisQuerySchema = z.object({
  examId: z.string().uuid().optional(),
});
export type AnalysisQuery = z.infer<typeof analysisQuerySchema>;

export const listMockExamsQuerySchema = paginationQuerySchema.extend({
  examId: z.string().uuid().optional(),
});
export type ListMockExamsQuery = z.infer<typeof listMockExamsQuerySchema>;


/** Active-exam scope for the completed weekly review. */
export const weeklyReviewQuerySchema = z.object({
  examId: z.string().uuid(),
});
export type WeeklyReviewQuery = z.infer<typeof weeklyReviewQuerySchema>;

