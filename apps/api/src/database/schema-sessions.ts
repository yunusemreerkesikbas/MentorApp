import { sql } from "drizzle-orm";
import { index, pgPolicy, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./schema";

/** Permanently revocable refresh family, including all future descendants. */
export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("org_id").references(() => organizations.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("auth_sessions_user_idx").on(table.userId),
  pgPolicy("auth_sessions_owner", {
    for: "all",
    using: sql`${table.userId}::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE'`,
    withCheck: sql`${table.userId}::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE'`,
  }),
]).enableRLS();
