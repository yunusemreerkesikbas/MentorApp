import { sql } from "drizzle-orm";
import { index, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";
import { authSessions } from "./schema-sessions";

/** Short-lived, single-use proof of password confirmation for an explicit provider link. */
export const googleLinkIntents = pgTable("google_link_intents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => authSessions.id, { onDelete: "cascade" }),
  nonceHash: text("nonce_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("google_link_intents_nonce_idx").on(t.nonceHash),
  index("google_link_intents_user_session_idx").on(t.userId, t.sessionId),
  pgPolicy("google_link_intents_owner", {
    for: "all",
    using: sql`${t.userId}::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE'`,
    withCheck: sql`${t.userId}::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE'`,
  }),
]).enableRLS();
