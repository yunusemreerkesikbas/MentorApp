import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./schema";

/** Ads owns approvals; question IDs are logical references across the forum boundary. */
export const adQuestionReviews = pgTable("ad_question_reviews", {
  questionId: uuid("question_id").primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  contentRevision: text("content_revision").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
}, () => [pgPolicy("ad_question_reviews_service", {
  for: "all",
  using: sql`current_setting('app.role', true) = 'SERVICE'`,
  withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
})]).enableRLS();
