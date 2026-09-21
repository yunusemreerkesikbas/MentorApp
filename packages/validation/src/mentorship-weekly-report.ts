import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const mentorshipWeeklyPreviewQuerySchema = z.object({
  weekStart: isoDate.optional(),
});

const mentorshipWeeklySourceSchema = z.object({
  weekStart: isoDate,
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

export const MENTORSHIP_COACH_CONTEXT_MAX_LENGTH = 500;
export const mentorshipWeeklyBriefSchema = mentorshipWeeklySourceSchema.extend({
  coachContext: z.string().trim().max(MENTORSHIP_COACH_CONTEXT_MAX_LENGTH).optional(),
});

export const finalizeMentorshipWeeklyReportSchema =
  mentorshipWeeklySourceSchema.extend({
    operationId: z.string().uuid(),
    coachEvaluation: z.string().trim().max(1200).nullable().optional(),
    replacesId: z.string().uuid().nullable().optional(),
  });

export const listMentorshipWeeklyReportsSchema = paginationQuerySchema;

export const mentorshipWeeklyReportParamSchema = z.object({
  studentId: z.string().uuid(),
  reportId: z.string().uuid(),
});

export type FinalizeMentorshipWeeklyReportInput = z.infer<
  typeof finalizeMentorshipWeeklyReportSchema
>;
