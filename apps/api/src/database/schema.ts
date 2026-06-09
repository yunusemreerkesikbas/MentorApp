/**
 * Drizzle schema (§11 conceptual data model).
 *
 * Design rules:
 *  - org_id / coach-ready from day one (Phase 2/3 won't break — §10).
 *  - Economy = append-only LedgerEntry (added with the economy module); balance = sum of rows.
 *  - pgvector is content only (added with the content module); not behavioral data (§8).
 *  - Trust metadata mandatory on InfoArticle (added with the content module — §1).
 *
 * Base step ships only the `jobs` table (queue substrate). Feature tables arrive with their modules.
 */
import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Background jobs (JobQueuePort MVP substrate). The Cron worker (Phase 7) polls
 * rows where status='PENDING' AND run_at <= now(). Handlers must be idempotent.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    payload: jsonb("payload")
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastError: text("last_error"),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("jobs_status_run_at_idx").on(t.status, t.runAt)],
);

/* ============================== W0 · identity ==============================
 * users / organizations / coach_students (org+coach-ready from day one — §10)
 * refresh_tokens (rotation + reuse detection) · email_tokens (verify/reset)
 * RLS: enabled+forced via the 0001 migration; access via withUserContext /
 * withServiceContext (database/rls.ts).
 * ========================================================================= */

/** Tenant umbrella (B2B Phase 2) — schema-ready, unused in MVP. */
export const organizations = pgTable("organizations", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  seatLimit: integer("seat_limit"),
  settings: jsonb("settings")
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    /** Multi-role (§9/§11): e.g. ORG_ADMIN + COACH. Values = UserRole enum. */
    roles: text("roles")
      .array()
      .notNull()
      .default(sql`'{STUDENT}'::text[]`),
    organizationId: uuid("organization_id").references(() => organizations.id),
    /** Minimal onboarding; deep diagnosis comes with coaching (W2). */
    examType: text("exam_type"),
    examDate: date("exam_date"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    /** KVKK consent timestamp — signup is rejected without consent (§7/§9). */
    kvkkAcceptedAt: timestamp("kvkk_accepted_at", { withTimezone: true }).notNull(),
    /** ACTIVE | SUSPENDED | BANNED (graduated enforcement — §9). */
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique_idx").on(sql`lower(${t.email})`)],
);

/** Coach↔student link (§11) — schema-ready for Phase 2 BYOS/marketplace, unused in MVP. */
export const coachStudents = pgTable(
  "coach_students",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    coachId: uuid("coach_id")
      .notNull()
      .references(() => users.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    /** PENDING | ACTIVE | ENDED (double opt-in — §9). */
    status: text("status").notNull().default("PENDING"),
    /** INVITE | MARKETPLACE (§11). */
    source: text("source").notNull().default("INVITE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("coach_students_pair_idx").on(t.coachId, t.studentId)],
);

/**
 * Refresh tokens: opaque 256-bit secrets — only the sha256 hash is stored.
 * Rotation: each refresh revokes the old row and issues a new one in the same `family`.
 * Reuse detection: presenting an already-revoked token revokes the whole family (theft assumption).
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    familyId: uuid("family_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("refresh_tokens_hash_idx").on(t.tokenHash),
    index("refresh_tokens_user_idx").on(t.userId),
    index("refresh_tokens_family_idx").on(t.familyId),
  ],
);

/** One-time email tokens (VERIFY_EMAIL | RESET_PASSWORD) — hash stored, single use. */
export const emailTokens = pgTable(
  "email_tokens",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("email_tokens_hash_idx").on(t.tokenHash),
    index("email_tokens_user_type_idx").on(t.userId, t.type),
  ],
);
