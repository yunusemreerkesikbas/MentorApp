import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./schema";

/** Legacy table name; Ads owns scoped approvals with logical Forum thread references. */
export const adQuestionReviews = pgTable("ad_question_reviews", {
  questionId: uuid("question_id").primaryKey(),
  contentType: text("content_type").notNull().default("QUESTION"),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  contentRevision: text("content_revision").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  communityContentRevision: text("community_content_revision"),
  communityReviewedBy: uuid("community_reviewed_by").references(() => users.id, { onDelete: "set null" }),
  communityReviewedAt: timestamp("community_reviewed_at", { withTimezone: true }),
}, () => [pgPolicy("ad_question_reviews_service", {
  for: "all",
  using: sql`current_setting('app.role', true) = 'SERVICE'`,
  withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
})]).enableRLS();
