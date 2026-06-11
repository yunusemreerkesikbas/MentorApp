/**
 * Coaching schemas (W2 daily loop + mood) — shared FE+BE (§8 single validation source).
 * Field copy is NOT here: user-facing messages are localized by the backend.
 */
import { z } from "zod";
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
export const SESSION_PRESETS = ["25_5", "50_10"] as const;
export const STUDY_SESSION_STATUSES = ["IN_PROGRESS", "COMPLETED", "ABANDONED"] as const;
/** Status values allowed when finalizing a session (complete / abandon). */
export const FINAL_STUDY_SESSION_STATUSES = ["COMPLETED", "ABANDONED"] as const;

/* --------------------------------- plan tasks --------------------------------- */

export const createPlanTaskSchema = z.object({
  /** Defaults to the server's "today" when omitted. */
  taskDate: isoDateSchema.optional(),
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(80).nullish(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
});
export type CreatePlanTaskInput = z.infer<typeof createPlanTaskSchema>;

export const updatePlanTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    subject: z.string().trim().min(1).max(80).nullish(),
    status: z.enum(PLAN_TASK_STATUSES).optional(),
    sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty" });
export type UpdatePlanTaskInput = z.infer<typeof updatePlanTaskSchema>;

export const listPlanTasksQuerySchema = paginationQuerySchema.extend({
  date: isoDateSchema.optional(),
});
export type ListPlanTasksQuery = z.infer<typeof listPlanTasksQuerySchema>;

/* ------------------------------- study sessions ------------------------------- */

export const startStudySessionSchema = z.object({
  preset: z.enum(SESSION_PRESETS),
  subject: z.string().trim().min(1).max(80).nullish(),
  /** ISO datetime; defaults to server "now" when omitted. */
  startedAt: z.string().datetime({ offset: true }).optional(),
});
export type StartStudySessionInput = z.infer<typeof startStudySessionSchema>;

export const updateStudySessionSchema = z.object({
  status: z.enum(FINAL_STUDY_SESSION_STATUSES),
  actualFocusSeconds: z.coerce.number().int().min(0).max(86_400),
});
export type UpdateStudySessionInput = z.infer<typeof updateStudySessionSchema>;

/* ---------------------------------- mood -------------------------------------- */

export const createMoodCheckinSchema = z.object({
  /** 1 (very low) .. 5 (great). */
  mood: z.coerce.number().int().min(1).max(5),
});
export type CreateMoodCheckinInput = z.infer<typeof createMoodCheckinSchema>;

export const listMoodCheckinsQuerySchema = paginationQuerySchema;
export type ListMoodCheckinsQuery = z.infer<typeof listMoodCheckinsQuerySchema>;
