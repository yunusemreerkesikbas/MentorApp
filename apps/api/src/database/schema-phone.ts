import { sql } from "drizzle-orm";
import { index, integer, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./schema";
import { authSessions } from "./schema-sessions";

/** Identity-only short-lived challenges. No plaintext OTP is persisted. */
export const phoneVerifications = pgTable("phone_verifications", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("org_id").references(() => organizations.id),
  sessionId: uuid("session_id").notNull().references(() => authSessions.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  phoneKey: text("phone_key").notNull(),
  previousPhoneNumber: text("previous_phone_number"),
  purpose: text("purpose").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  resendAvailableAt: timestamp("resend_available_at", { withTimezone: true }).notNull(),
  sendStatus: text("send_status").notNull().default("PENDING"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  usedAt: timestamp("used_at", { withTimezone: true }),
  invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("phone_verifications_user_created_idx").on(t.userId, t.createdAt),
  index("phone_verifications_expiry_idx").on(t.expiresAt),
  pgPolicy("phone_verifications_service", {
    for: "all", using: sql`current_setting('app.role', true) = 'SERVICE'`,
    withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
  }),
]).enableRLS();

/** Short-lived abuse accounting survives account erasure; identifiers are keyed fingerprints. */
export const phoneOtpAttempts = pgTable("phone_otp_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  accountKey: text("account_key").notNull(),
  phoneKey: text("phone_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("phone_otp_attempts_account_idx").on(t.accountKey, t.kind, t.createdAt),
  index("phone_otp_attempts_phone_idx").on(t.phoneKey, t.kind, t.createdAt),
  index("phone_otp_attempts_created_idx").on(t.kind, t.createdAt),
  pgPolicy("phone_otp_attempts_service", {
    for: "all", using: sql`current_setting('app.role', true) = 'SERVICE'`,
    withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
  }),
]).enableRLS();
