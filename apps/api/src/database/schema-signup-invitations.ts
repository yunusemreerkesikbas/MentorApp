import { sql } from "drizzle-orm";
import { index, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./schema";

export type InvitationRole = "student" | "coach";
export type InvitationStatus = "waiting" | "invited";

/** Invite-only signup list: one row per email, `waiting` until an admin invites it. */
export const signupInvitations = pgTable(
  "signup_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Lower-cased + trimmed by the caller (shared emailSchema). */
    email: text("email").notNull(),
    role: text("role").$type<InvitationRole>().notNull(),
    status: text("status").$type<InvitationStatus>().notNull(),
    locale: text("locale").$type<"tr" | "en">().notNull().default("tr"),
    organizationId: uuid("organization_id").references(() => organizations.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("signup_invitations_email_uq").on(table.email),
    index("signup_invitations_status_created_idx").on(table.status, table.createdAt),
    pgPolicy("signup_invitations_service", {
      for: "all",
      using: sql`current_setting('app.role', true) = 'SERVICE'`,
      withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
    }),
  ],
).enableRLS();
