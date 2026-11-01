import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { WeeklyReviewDto, WeeklyReviewNarrationDto, WeeklyRecapSource } from "@mentor/types";
import { organizations, users } from "./schema";

/** AI owns the composed report; Coaching supplies its deterministic evidence through its public API. */
export const aiWeeklyRecaps = pgTable("ai_weekly_recaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
  examId: uuid("exam_id").notNull(),
  weekStart: text("week_start").notNull(),
  locale: text("locale").notNull(),
  source: text("source").$type<WeeklyRecapSource>().notNull(),
  status: text("status").$type<"RUNNING" | "GENERATED" | "READY" | "FAILED">().notNull(),
  clientRequestId: uuid("client_request_id").notNull(),
  claimId: uuid("claim_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  cost: integer("cost").notNull(),
  review: jsonb("review").$type<WeeklyReviewDto>().notNull(),
  narration: jsonb("narration").$type<WeeklyReviewNarrationDto>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("ai_weekly_recaps_identity_uq").on(t.userId, t.examId, t.weekStart),
  uniqueIndex("ai_weekly_recaps_request_uq").on(t.userId, t.clientRequestId),
  index("ai_weekly_recaps_archive_idx").on(t.userId, t.openedAt),
  pgPolicy("ai_weekly_recaps_service", {
    for: "all", using: sql`current_setting('app.role', true) = 'SERVICE'`,
    withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
  }),
]).enableRLS();
