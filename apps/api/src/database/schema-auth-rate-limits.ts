import { sql } from "drizzle-orm";
import { index, integer, pgPolicy, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/** HMAC-only keys: no IP addresses or account identifiers are retained. */
export const authRateLimits = pgTable("auth_rate_limits", {
  key: varchar("key", { length: 64 }).primaryKey(),
  hits: integer("hits").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  nextAllowedAt: timestamp("next_allowed_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("auth_rate_limits_expiry_idx").on(table.expiresAt),
  pgPolicy("auth_rate_limits_service", {
    for: "all",
    using: sql`current_setting('app.role', true) = 'SERVICE'`,
    withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
  }),
]).enableRLS();
