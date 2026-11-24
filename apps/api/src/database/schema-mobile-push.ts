import { sql } from "drizzle-orm";
import { check, index, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

/** Native mobile Expo Push tokens (one row per installed device token). */
export const mobilePushTokens = pgTable("mobile_push_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  platform: text("platform").$type<"ios" | "android">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("mobile_push_tokens_token_idx").on(t.token),
  index("mobile_push_tokens_user_idx").on(t.userId),
  check("mobile_push_tokens_platform_check", sql`${t.platform} in ('ios', 'android')`),
  pgPolicy("mobile_push_tokens_owner", {
    for: "all",
    using: sql`${t.userId}::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE'`,
    withCheck: sql`${t.userId}::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE'`,
  }),
]).enableRLS();
