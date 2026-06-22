/**
 * Forum schemas (Phase-2 pulled into MVP) — shared FE+BE (§8). User-facing copy localized by the backend.
 */
import { z } from "zod";
import { ZoneJoinPolicy, ZoneType } from "@mentor/types";
import { paginationQuerySchema } from "./pagination.js";

/** Staff-only zone creation (curated). Slug is derived server-side, not accepted from the client. */
export const createZoneSchema = z.object({
  type: z.nativeEnum(ZoneType),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  examType: z.string().trim().max(32).optional(),
  joinPolicy: z.nativeEnum(ZoneJoinPolicy).default(ZoneJoinPolicy.OPEN),
});
export type CreateZone = z.infer<typeof createZoneSchema>;

/** Assign an external user as the zone OWNER (curated onboarding of a community leader). */
export const assignOwnerSchema = z.object({ userId: z.string().uuid() });
export type AssignOwner = z.infer<typeof assignOwnerSchema>;

/** Owner/mod decision on a pending join request. */
export const approveMemberSchema = z.object({ approve: z.boolean() });
export type ApproveMember = z.infer<typeof approveMemberSchema>;

export const zoneListQuerySchema = paginationQuerySchema.extend({
  type: z.nativeEnum(ZoneType).optional(),
  examType: z.string().trim().max(32).optional(),
});
export type ZoneListQuery = z.infer<typeof zoneListQuerySchema>;
