import { z } from "zod";
import { isoDateSchema } from "./coaching.js";
import { paginationQuerySchema } from "./pagination.js";

export const createMentorshipFollowupSchema = z.object({
  operationId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  privateNote: z.string().trim().min(1).max(2000).nullable().default(null),
  sharedDecision: z.string().trim().min(1).max(2000).nullable().default(null),
  followUpDate: isoDateSchema.nullable().default(null),
  replacesId: z.string().uuid().nullable().default(null),
}).strict();
export type CreateMentorshipFollowupInput = z.infer<typeof createMentorshipFollowupSchema>;

export const updateMentorshipFollowupSchema = z.object({
  version: z.number().int().positive(),
  followUpDate: isoDateSchema.nullable().optional(),
  status: z.enum(["COMPLETED", "CANCELLED"]).optional(),
}).strict().refine((value) => value.followUpDate !== undefined || value.status !== undefined, { message: "empty" });
export type UpdateMentorshipFollowupInput = z.infer<typeof updateMentorshipFollowupSchema>;

export const respondMentorshipFollowupSchema = z.object({
  version: z.number().int().positive(),
  response: z.enum(["ACCEPTED", "CHANGE_REQUESTED"]),
}).strict();
export type RespondMentorshipFollowupInput = z.infer<typeof respondMentorshipFollowupSchema>;

export const listMentorshipFollowupsQuerySchema = paginationQuerySchema.extend({
  studentId: z.string().uuid().optional(),
  view: z.enum(["ALL", "ACTIONABLE"]).default("ALL"),
});
export type ListMentorshipFollowupsQuery = z.infer<typeof listMentorshipFollowupsQuerySchema>;
export const mentorshipFollowupParamSchema = z.object({ followupId: z.string().uuid() });
export const mentorshipStudentFollowupParamSchema = mentorshipFollowupParamSchema.extend({ studentId: z.string().uuid() });
