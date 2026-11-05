import { sql } from "drizzle-orm";
import { index, pgPolicy, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const aiChatQuotaAttempts = pgTable(
  "ai_chat_quota_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("ai_chat_quota_attempts_user_created_idx").on(table.userId, table.createdAt),
    pgPolicy("ai_chat_quota_attempts_service", {
      for: "all",
      using: sql`current_setting('app.role', true) = 'SERVICE'`,
      withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
    }),
  ],
).enableRLS();
