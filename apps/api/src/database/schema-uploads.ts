import { sql } from "drizzle-orm";
import { check, index, integer, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authSessions } from "./schema-sessions";
import { organizations, users } from "./schema";

/** Storage owns tickets. Only the hash is persisted; the opaque capability is never logged. */
export const uploadTickets = pgTable("upload_tickets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenHash: text("token_hash").notNull().unique(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").references(() => organizations.id),
  sessionId: uuid("session_id").notNull().references(() => authSessions.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),
  key: text("storage_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  maxBytes: integer("max_bytes").notNull(),
  chargedBytes: integer("charged_bytes").notNull().default(0),
  status: text("status").notNull().default("ISSUED"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("upload_tickets_owner_created_idx").on(t.ownerId, t.createdAt),
  index("upload_tickets_owner_status_idx").on(t.ownerId, t.status),
  check("upload_tickets_status_check", sql`${t.status} in ('ISSUED', 'CLAIMED', 'COMPLETE', 'FAILED')`),
  check("upload_tickets_bytes_check", sql`${t.maxBytes} > 0 and ${t.chargedBytes} >= 0 and ${t.chargedBytes} <= ${t.maxBytes}`),
  pgPolicy("upload_tickets_owner", {
    for: "all",
    using: sql`${t.ownerId}::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE'`,
    withCheck: sql`${t.ownerId}::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE'`,
  }),
]).enableRLS();
