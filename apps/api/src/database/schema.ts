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
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
  varchar,
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("jobs_status_run_at_idx").on(t.status, t.runAt)],
);

/* ============================== W0 · identity ==============================
 * users / organizations / coach_students (org+coach-ready from day one — §10)
 * refresh_tokens (rotation + reuse detection) · email_tokens (verify/reset)
 * user_auth_accounts (external auth provider identities)
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
    username: text("username"),
    avatarStorageKey: text("avatar_storage_key"),
    /** Public profile identity (community surface) — short self-description + a personal link. */
    bio: text("bio"),
    website: text("website"),
    /** Multi-role (§9/§11): e.g. ORG_ADMIN + COACH. Values = UserRole enum. */
    roles: text("roles")
      .array()
      .notNull()
      .default(sql`'{STUDENT}'::text[]`),
    organizationId: uuid("organization_id").references(() => organizations.id),
    /** Minimal onboarding; deep diagnosis comes with coaching (W2). */
    examType: text("exam_type"),
    examDate: date("exam_date"),
    /** Daily focus goal in minutes (/study-session progress + XP quest); null = no goal set. */
    dailyFocusGoalMinutes: integer("daily_focus_goal_minutes"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    /** KVKK consent timestamp — signup is rejected without consent (§7/§9). */
    kvkkAcceptedAt: timestamp("kvkk_accepted_at", {
      withTimezone: true,
    }).notNull(),
    /** ACTIVE | SUSPENDED | BANNED (graduated enforcement — §9). */
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_unique_idx").on(sql`lower(${t.email})`),
    uniqueIndex("users_username_unique_idx").on(sql`lower(${t.username})`),
  ],
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("email_tokens_hash_idx").on(t.tokenHash),
    index("email_tokens_user_type_idx").on(t.userId, t.type),
  ],
);

export const userAuthAccounts = pgTable(
  "user_auth_accounts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    providerEmail: text("provider_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_auth_accounts_provider_subject_idx").on(
      t.provider,
      t.providerSubject,
    ),
    uniqueIndex("user_auth_accounts_user_provider_idx").on(
      t.userId,
      t.provider,
    ),
    index("user_auth_accounts_user_idx").on(t.userId),
  ],
);

/** Verification email resend attempts — counted for admin-tunable self-service rate limits. */
export const emailVerificationResendAttempts = pgTable(
  "email_verification_resend_attempts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("email_verification_resend_attempts_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
  ],
);

/* ===================== W1 · content =====================
 * Exam calendar + (later) knowledge center. Reference data — public read,
 * editorial/service write. Trust metadata on every event (guardrail §4 #1).
 * `family` matches identity `users.examType` (KPSS | YKS | LGS); `variant` holds
 * sub-types (LISANS | ONLISANS | ORTAOGRETIM) for KPSS seed rows.
 * ========================================================================= */

/** An exam instance (e.g. KPSS Lisans 2026). Global when orgId is null (§4 #7). */
export const exams = pgTable(
  "exams",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** KPSS | YKS | LGS — matches users.examType. */
    family: text("family").notNull(),
    /** KPSS sub-type (LISANS | ONLISANS | ORTAOGRETIM), nullable for non-KPSS rows. */
    variant: text("variant"),
    netRule: jsonb("net_rule").notNull(),
    /** Editorial override when multiple exams share a family (countdown selection). */
    isCurrent: boolean("is_current").notNull().default(false),
    orgId: uuid("org_id").references(() => organizations.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("exams_slug_unique_idx").on(t.slug),
    index("exams_family_idx").on(t.family),
  ],
);

/** A dated editorial event for an exam (EXAM_DATE first; more types later). */
export const examEvents = pgTable(
  "exam_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    /** EXAM_DATE | APPLICATION_START | … (ExamEventType). */
    type: text("type").notNull(),
    eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    verifiedBy: text("verified_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("exam_events_exam_type_unique_idx").on(t.examId, t.type),
    index("exam_events_exam_type_idx").on(t.examId, t.type),
  ],
);

/** Editorial knowledge-center article (A-layer). Public when publishedAt is set. */
export const infoArticles = pgTable(
  "info_articles",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    bodyFormat: text("body_format").notNull().default("MARKDOWN"),
    authorName: text("author_name"),
    authorTitle: text("author_title"),
    authorBio: text("author_bio"),
    coverImageKey: text("cover_image_key"),
    coverImageAlt: text("cover_image_alt"),
    coverImageWidth: integer("cover_image_width"),
    coverImageHeight: integer("cover_image_height"),
    /** KPSS | YKS | LGS — matches users.examType. */
    family: text("family").notNull(),
    /** InfoArticleCategory constant. */
    category: text("category").notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    verifiedBy: text("verified_by").notNull(),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    /** pgvector — content only; populated by W3 after ArticlePublished (§4 #6). */
    embedding: vector("embedding", { dimensions: 1536 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("info_articles_slug_unique_idx").on(t.slug),
    index("info_articles_family_category_idx").on(t.family, t.category),
  ],
);

/** Global subject taxonomy (e.g. Tarih, Matematik). */
export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("subjects_slug_unique_idx").on(t.slug)],
);

/** Exam ↔ subject link (question count + display order). */
export const examSubjects = pgTable(
  "exam_subjects",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    questionCount: integer("question_count"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("exam_subjects_pair_idx").on(t.examId, t.subjectId)],
);

/** Topic taxonomy scoped by parent subject. */
export const topics = pgTable(
  "topics",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("topics_subject_slug_unique_idx").on(t.subjectId, t.slug),
  ],
);

/** Exam ↔ topic link (display order; mirrors exam_subjects). */
export const examTopics = pgTable(
  "exam_topics",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("exam_topics_pair_idx").on(t.examId, t.topicId)],
);

/* ===================== W2 · coaching =====================
 * Daily loop (plan tasks · Pomodoro/study sessions · daily activity · streak) +
 * mood check-in (rule-based). All tables are user-scoped behavioral data — RLS
 * enabled+forced with a per-user policy (app.user_id GUC) in the 0002 migration.
 *
 * Cross-track seams (no FK, no cross-module JOIN — workstreams §3):
 *  - plan_tasks.subject / study_sessions.subject are SOFT refs → content subject taxonomy.
 *  - "Which exam" is identity-owned (users.examType); the countdown date is read from
 *    content (ContentPort), never re-stored here and never from users.examDate (plan §6 #5).
 * Streak is read-time derived for MVP (no cron); daily_activity is the activity ledger.
 * ========================================================================= */

/** A single planned study item for a day (today's plan). */
export const planTasks = pgTable(
  "plan_tasks",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskDate: date("task_date").notNull(),
    title: text("title").notNull(),
    /** Nullable SOFT ref → content subject slug/name (no FK). */
    subject: text("subject"),
    /** PENDING | DONE (PlanTaskStatus). */
    status: text("status").notNull().default("PENDING"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("plan_tasks_user_date_idx").on(t.userId, t.taskDate)],
);

/** A Pomodoro/focus session (start → complete/abandon). */
export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /** "25_5" | "50_10" | "custom" (SessionPreset). */
    preset: text("preset").notNull(),
    /** User-chosen focus length when preset is custom; null for fixed presets. */
    plannedFocusMinutes: integer("planned_focus_minutes"),
    actualFocusSeconds: integer("actual_focus_seconds").notNull().default(0),
    /** Nullable SOFT ref → content subject. */
    subject: text("subject"),
    /** Optional link to the plan task this session was started from (roadmap §259). */
    planTaskId: uuid("plan_task_id").references(() => planTasks.id, {
      onDelete: "set null",
    }),
    /** Post-session micro check-in: subjective effort/mood 1-3 (😩😐🙂); null until captured. */
    sessionMood: integer("session_mood"),
    /** Optional post-session "what challenged you" free-text signal for the AI; null when blank. */
    struggleNote: text("struggle_note"),
    /** Premium AI session reflection cache (one per session; cleared when feedback changes). */
    aiReflection: text("ai_reflection"),
    aiModel: text("ai_model"),
    aiReflectedAt: timestamp("ai_reflected_at", { withTimezone: true }),
    /** Cached plan-task suggestion from session reflection ({title, subject}); null when none. */
    aiSuggestedTask: jsonb("ai_suggested_task"),
    /** IN_PROGRESS | COMPLETED | ABANDONED (StudySessionStatus). */
    status: text("status").notNull().default("IN_PROGRESS"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("study_sessions_user_started_idx").on(t.userId, t.startedAt)],
);

/** Per-day activity ledger — the source for read-time streak derivation. */
export const dailyActivity = pgTable(
  "daily_activity",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityDate: date("activity_date").notNull(),
    hasSession: boolean("has_session").notNull().default(false),
    tasksDone: integer("tasks_done").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("daily_activity_user_date_unique_idx").on(
      t.userId,
      t.activityDate,
    ),
  ],
);

/** Per-user streak snapshot/cache (current is derived on read; longest is a high-water mark). */
export const streakState = pgTable(
  "streak_state",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currentStreak: integer("current_streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    freezeTokens: integer("freeze_tokens").notNull().default(2),
    lastActiveDate: date("last_active_date"),
    /** "YYYY-MM" — monthly freeze-token reset key. */
    freezeMonth: text("freeze_month"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("streak_state_user_unique_idx").on(t.userId)],
);

/**
 * Coin-purchased streak freezes — one immutable row per bridged calendar day (economy
 * streak-rescue sink). Purchased dates bridge unconditionally in the streak derivation and
 * never consume the monthly free-token allowance.
 */
export const streakFreezes = pgTable(
  "streak_freezes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The missed calendar day this freeze bridges (yyyy-mm-dd). */
    date: date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("streak_freezes_user_date_unique_idx").on(t.userId, t.date),
  ],
);

/**
 * One gentle mood check-in per day (1..5). `struggleNote` is an OPTIONAL, user-typed subjective
 * signal ("bugün seni en çok zorlayan konu") — never AI-generated. The `ai*` columns cache the
 * premium AI-adaptive reflection (one per day; regenerated in place). Free tier reads only the
 * rule-based encouragement (§4 #5) — the AI reflection is premium-only.
 */
export const moodCheckins = pgTable(
  "mood_checkins",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkinDate: date("checkin_date").notNull(),
    mood: smallint("mood").notNull(),
    struggleNote: text("struggle_note"),
    aiReflection: text("ai_reflection"),
    aiModel: text("ai_model"),
    aiReflectedAt: timestamp("ai_reflected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("mood_checkins_user_date_unique_idx").on(
      t.userId,
      t.checkinDate,
    ),
  ],
);

/**
 * Vision/goal board ("hayal/hedef panosu") — one text-based goal anchor per user (W2). Free tier
 * reads the goal + reuses the existing countdown; the AI motivation note (ai_note) is premium-only
 * (§4 #5), regenerated in place when the goal/motivation changes.
 */
export const visionBoards = pgTable(
  "vision_boards",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalTitle: text("goal_title").notNull(),
    targetCity: text("target_city"),
    motivation: text("motivation"),
    aiNote: text("ai_note"),
    aiModel: text("ai_model"),
    aiNoteAt: timestamp("ai_note_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("vision_boards_user_unique_idx").on(t.userId)],
);

/** A deneme (mock exam) attempt — per-user behavioral data. */
export const mockExams = pgTable(
  "mock_exams",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SOFT ref → content.exams (no FK). */
    examId: uuid("exam_id").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    /** Server-computed total net (stored for trend queries). */
    totalNet: numeric("total_net", { precision: 7, scale: 2 }).notNull(),
    /** Optional publisher label entered by the user (Brans, Limit, etc.). */
    publisherName: varchar("publisher_name", { length: 120 }),
    /**
     * Cached premium AI-adaptive "ghost" (geçmiş-ben) progress narration for THIS attempt vs the
     * user's own past (premium-only; null for free / not yet generated). Naturally invalidated when
     * a newer attempt becomes the latest.
     */
    aiGhostNarration: text("ai_ghost_narration"),
    aiGhostModel: text("ai_ghost_model"),
    aiGhostAt: timestamp("ai_ghost_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("mock_exams_user_taken_idx").on(t.userId, t.takenAt)],
);

/** Per-subject breakdown for a mock exam. */
export const mockExamSubjects = pgTable(
  "mock_exam_subjects",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    mockExamId: uuid("mock_exam_id")
      .notNull()
      .references(() => mockExams.id, { onDelete: "cascade" }),
    /** SOFT ref → content subject slug. */
    subjectRef: text("subject_ref").notNull(),
    correct: integer("correct").notNull(),
    wrong: integer("wrong").notNull(),
    blank: integer("blank").notNull(),
    /** Server-computed net for this subject. */
    net: numeric("net", { precision: 6, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("mock_exam_subjects_mock_idx").on(t.mockExamId),
    uniqueIndex("mock_exam_subjects_pair_idx").on(t.mockExamId, t.subjectRef),
  ],
);

/** Premium photo → subject classification rows (vision, categorize-not-solve §4 #2). */
export const mockExamPhotoCategorizations = pgTable(
  "mock_exam_photo_categorizations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mockExamId: uuid("mock_exam_id")
      .notNull()
      .references(() => mockExams.id, { onDelete: "cascade" }),
    subjectRef: text("subject_ref").notNull(),
    /** Nullable for legacy and subject-only classifications. */
    topicRef: text("topic_ref"),
    storageKey: text("storage_key").notNull(),
    clientRequestId: uuid("client_request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("mock_exam_photo_cat_user_created_idx").on(t.userId, t.createdAt),
    index("mock_exam_photo_cat_mock_idx").on(t.mockExamId),
    uniqueIndex("mock_exam_photo_cat_client_req_idx").on(
      t.userId,
      t.clientRequestId,
      t.subjectRef,
    ),
  ],
);

/* ===================== W4 · payments =====================
 * Subscription billing (§7): plan catalog, subscriptions (state machine),
 * append-only charge ledger, idempotent webhook event log. Money = integer
 * minor units (kuruş) — never float. Renewal charging is provider-side
 * (iyzico subscription product) → our system is webhook-driven (no cron).
 * RLS (0003 migration): subscriptions/transactions self-read + SERVICE-write;
 * webhook events SERVICE-only.
 * ========================================================================= */

/** Plan catalog. PLACEHOLDER prices (Phase-0 WTP research pending — roadmap §12). */
export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // e.g. 'premium-monthly'
  name: text("name").notNull(),
  periodMonths: integer("period_months").notNull(),
  /** VAT-inclusive price in kuruş. */
  priceMinor: integer("price_minor").notNull(),
  currency: text("currency").notNull().default("TRY"),
  trialDays: integer("trial_days").notNull().default(7),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Subscription state machine: TRIALING|ACTIVE|PAST_DUE|CANCELED|EXPIRED.
 * Partial unique index (0003 migration): one non-terminal subscription per user.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    status: text("status").notNull().default("TRIALING"),
    provider: text("provider").notNull(), // FAKE | IYZICO
    providerRef: text("provider_ref"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("subscriptions_user_idx").on(t.userId)],
);

/** Append-only charge ledger (§3 ledger discipline): rows are never updated/deleted. */
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(), // TRIAL_START | RENEWAL | REFUND
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("TRY"),
    status: text("status").notNull(), // SUCCEEDED | FAILED | REFUNDED
    providerEventId: text("provider_event_id").notNull(),
    raw: jsonb("raw")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_tx_provider_event_idx").on(t.providerEventId),
    index("payment_tx_user_idx").on(t.userId),
  ],
);

/** Webhook idempotency belt: (provider, eventId) unique — a replayed event is a no-op. */
export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload")
      .notNull()
      .default(sql`'{}'::jsonb`),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_webhook_provider_event_idx").on(t.provider, t.eventId),
  ],
);

/* ===================== W5 · notifications =====================
 * Web push subscriptions, user notification preferences, delivery dedupe log.
 * RLS: user-scoped self access (0007 migration). Jobs table is platform-level (no RLS).
 * ========================================================================= */

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_unique_idx").on(t.endpoint),
    index("push_subscriptions_user_idx").on(t.userId),
  ],
);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  pushEnabled: boolean("push_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Idempotent delivery log — prevents duplicate daily reminders etc. */
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // EMAIL | PUSH
    template: text("template").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_deliveries_dedupe_idx").on(
      t.userId,
      t.channel,
      t.template,
      t.dedupeKey,
    ),
  ],
);

/** In-app notification inbox — user-visible, browsable, markable as read. RLS: user-scoped. */
export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // NotificationCategory: COACH | PLAN | CONTENT
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    linkUrl: text("link_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("user_notifications_user_created_idx").on(t.userId, t.createdAt),
  ],
);

/* ================================ W6 · admin ================================
 * admin_audit_log: every admin mutation (who/what/when) — append-only (§9), never
 * updated, never deleted. Written by AdminAuditInterceptor in SERVICE context.
 * RLS: SERVICE/ADMIN only (admin services run cross-user in service context).
 *
 * NOTE — economy seam (NOT built in this slice): the light economy lands later as an
 * append-only `ledger_entries` (XP ≠ Coin, coin is non-monetary/capped — §3/§4) plus
 * invite/quest tables. Reserved here so the schema stays org/ledger-ready from day one.
 * ========================================================================= */

/** Append-only admin action trail (§9). `before`/`after` capture sensitive diffs (roles). */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** The admin who performed the action (req.user.id). */
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    /** Stable action key, e.g. "staff.assign" / "staff.revoke". */
    action: text("action").notNull(),
    /** What kind of entity was acted on, e.g. "user" (null for non-targeted actions). */
    targetType: text("target_type"),
    targetId: text("target_id"),
    /** Optional value snapshots for sensitive mutations (e.g. roles before/after). */
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("admin_audit_log_created_at_idx").on(t.createdAt),
    index("admin_audit_log_action_idx").on(t.action),
  ],
);

/**
 * Config registry overrides (§9 + engineering-principles §2/§8). The catalog (keys, Zod schemas,
 * defaults) lives in code (`common/config/config.catalog.ts`); this table stores only the
 * admin-set OVERRIDE for a key. Effective value = override ?? catalog default. Feature flags are
 * boolean-typed catalog entries. RLS: SERVICE/ADMIN only. Edits are audited (admin_audit_log).
 */
export const configOverrides = pgTable("config_overrides", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ============================== W6 · economy ==============================
 * Light economy (§3): XP (reputation, never spent) + Coin (non-monetary, capped, → AI right).
 * append-only LEDGER — balance = sum of rows, NEVER a single number, NEVER updated/deleted (§4 #3).
 * Coin reversibility (forum, Phase 2): status PENDING→CONFIRMED/REVERSED; spendable coin = CONFIRMED.
 * RLS: self-read + SERVICE/ADMIN; insert SERVICE/ADMIN; no UPDATE/DELETE policy ⇒ immutable.
 * ========================================================================= */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** XP | COIN (Currency). */
    unit: text("unit").notNull(),
    /** Signed minor unit: + earn, - spend/revert. */
    amount: integer("amount").notNull(),
    /** Action key, e.g. "admin.manual-adjust", "invite.converted", "quest.onboarding". */
    reason: text("reason").notNull(),
    /** PENDING | CONFIRMED | REVERSED (LedgerStatus). Spendable coin = CONFIRMED only. */
    status: text("status").notNull().default("CONFIRMED"),
    /** Idempotency / provenance: a grant for (refType,refId) is applied at most once. */
    refType: text("ref_type"),
    refId: text("ref_id"),
    note: text("note"),
    /** Admin/actor for manual adjustments (null for system grants). */
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ledger_entries_user_unit_idx").on(t.userId, t.unit),
    index("ledger_entries_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("ledger_entries_ref_unique_idx")
      .on(t.refType, t.refId)
      .where(sql`${t.refId} is not null`),
  ],
);

/* --- Invite (§3 light economy slice 2a): davet → dönüşürse coin -------------
 * One stable code per inviter. A user can be invited at most once (unique). Reward fires only on
 * the invited user's subscription activation (forward-only) — see economy InviteEventsListener.
 * RLS: invites self-read (inviter) + SERVICE/ADMIN; redemptions SERVICE/ADMIN. */
export const invites = pgTable(
  "invites",
  {
    inviterUserId: uuid("inviter_user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("invites_code_unique_idx").on(t.code)],
);

export const inviteRedemptions = pgTable(
  "invite_redemptions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    inviterUserId: uuid("inviter_user_id")
      .notNull()
      .references(() => users.id),
    /** A user can be invited at most once (anti-abuse). */
    invitedUserId: uuid("invited_user_id")
      .notNull()
      .references(() => users.id),
    code: text("code").notNull(),
    /** PENDING → CONVERTED (on the invited user's subscription activation). */
    status: text("status").notNull().default("PENDING"),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("invite_redemptions_invited_unique_idx").on(t.invitedUserId),
    index("invite_redemptions_inviter_idx").on(t.inviterUserId),
  ],
);

/* --- Quests (§3 light economy): completed quest → XP/Coin (capped where needed, idempotent).
 * One row per (user, quest, period) recorded on completion; the reward is a ledger entry
 * (refType="quest", refId=row id). Evaluated by the economy QuestService.
 * RLS: self-read (the user) + SERVICE/ADMIN; eval/grant run in SERVICE context. */
export const userQuestProgress = pgTable(
  "user_quest_progress",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Stable quest id from the static catalog (e.g. "onboarding.profile-setup"). */
    questId: text("quest_id").notNull(),
    /** "once" for one-shot onboarding quests; yyyy-mm-dd for daily ritual quests. */
    periodKey: text("period_key").notNull().default("once"),
    status: text("status").notNull().default("COMPLETED"),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_quest_progress_user_quest_period_unique_idx").on(
      t.userId,
      t.questId,
      t.periodKey,
    ),
    index("user_quest_progress_user_idx").on(t.userId),
  ],
);

/* --- AI usage metering (W3, §7 cost cap): one row per LLM call. Powers the premium daily
 * rate-limit + (later) the metrics LLM-cost KPI. NOT chat history (single-turn, stateless).
 * §4 #6: stores token/cost meta only — never the prompt/reply text or any PII.
 * RLS: self-read + SERVICE/ADMIN; writes run in SERVICE context. */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    /** Which AI feature produced this call (chat/vision/mood/...); null on pre-labeling rows. */
    feature: text("feature"),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    /** Estimated cost in micro-USD (integer; per-call cost is far below 1 minor unit). */
    costMicros: integer("cost_micros").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_usage_user_created_idx").on(t.userId, t.createdAt)],
);

/* --- AI coach conversations (W3, threads): one row per chat thread. Title is derived from the
 * first user message (no LLM). `last_message_at` drives the "Son sohbetler" list order.
 * KVKK: title is user-authored free-text — same erasure follow-up as coach_messages.
 * RLS: self-or-service (per-user behavioral data, 0001 pattern). */
export const coachConversations = pgTable(
  "coach_conversations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Bumped on every persisted exchange — the list sort key. */
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("coach_conversations_user_last_idx").on(t.userId, t.lastMessageAt),
  ],
);

/* --- AI coach chat history (W3, Faz 2 multi-turn): one row per message, scoped to a conversation
 * (thread). §4 #6: content is the user's own words / the coach reply (user-authored + generated — no
 * third-party PII). KVKK: behavioral free-text — included in the erasure follow-up (ai.md Gotchas).
 * RLS: self-or-service (per-user behavioral data, 0001 pattern). */
export const coachMessages = pgTable(
  "coach_messages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Thread this message belongs to (deleting a conversation cascades its messages). */
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => coachConversations.id, { onDelete: "cascade" }),
    /** CoachMessageRole: USER | COACH. */
    role: text("role").notNull(),
    content: text("content").notNull(),
    /** RAG source chips on COACH rows ([{title, slug, url}]); null on USER rows. */
    sources: jsonb("sources"),
    /** Authoritative countdown data card on deterministic official replies. */
    officialCountdown: jsonb("official_countdown"),
    /** LLM model that produced a COACH row; null on USER rows. */
    model: text("model"),
    /** User rating on a COACH row: 1 = 👍, -1 = 👎, null = none. */
    feedback: smallint("feedback"),
    /** Persisted coach plan-task suggestion ({title, subject}) on a COACH row; null otherwise. */
    suggestedTask: jsonb("suggested_task"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("coach_messages_user_created_idx").on(t.userId, t.createdAt),
    index("coach_messages_conversation_created_idx").on(
      t.conversationId,
      t.createdAt,
    ),
  ],
);

/* --- AI coach memory profile (W3, Faz 2): one distilled PII-free summary per user, refreshed by an
 * async job every N messages. §4 #6: goal / recurring struggles / study prefs only — never name,
 * email, contact. KVKK: behavioral free-text (erasure follow-up); user can reset via DELETE.
 * RLS: self-or-service (0001 pattern). */
export const coachMemory = pgTable("coach_memory", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  model: text("model").notNull(),
  /** Message count at which this profile was distilled — the refresh threshold guard. */
  messageCount: integer("message_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ============================== forum ==============================
 * Zone primitive (announcement/chat/qa) + scoped membership (owner/mod/member).
 * Design 2026-06-22. org_id nullable from day one; visibility PUBLIC in MVP
 * (PRIVATE reserved for Phase 2 invite/closed/mahalle). Phase 2 appends
 * threads/posts/reactions/reports/moderation_actions to this block.
 * RLS: read PUBLIC non-archived zones (any authed) + own membership rows;
 * privileged writes/member-lists run in SERVICE context (policy-checked in app).
 * ================================================================== */
export const forumZones = pgTable(
  "forum_zones",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** ZoneType: ANNOUNCEMENT | CHAT | QA */
    type: text("type").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    /** ZoneVisibility — PUBLIC in MVP; PRIVATE reserved. */
    visibility: text("visibility").notNull().default("PUBLIC"),
    /** ZoneJoinPolicy: OPEN (instant) | REQUEST (owner-approved). */
    joinPolicy: text("join_policy").notNull().default("OPEN"),
    examType: text("exam_type"),
    emoji: text("emoji"),
    organizationId: uuid("organization_id").references(() => organizations.id),
    createdBy: uuid("created_by").references(() => users.id),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_zones_slug_idx").on(t.slug),
    index("forum_zones_type_idx").on(t.type),
  ],
);

export const forumZoneMembers = pgTable(
  "forum_zone_members",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => forumZones.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** ZoneRole: OWNER | MODERATOR | MEMBER (per-zone scoped — not a platform role). */
    role: text("role").notNull().default("MEMBER"),
    /** ZoneMemberStatus: ACTIVE | PENDING. */
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_zone_members_unique_idx").on(t.zoneId, t.userId),
    index("forum_zone_members_zone_status_idx").on(t.zoneId, t.status),
  ],
);

/* Slice 2 — flat feed item (CHAT message / ANNOUNCEMENT broadcast). No `kind`: behaviour is
 * derived from the parent zone's type. Replies/QA answers (forum_posts) arrive in Slice 3.
 * Soft-delete (deleted_at) keeps the row for moderation audit; feed reads filter it out. */
export const forumThreads = pgTable(
  "forum_threads",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => forumZones.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    /** QA question headline (slice 3). Null for chat/announcement. */
    title: text("title"),
    body: text("body").notNull(),
    /** ThreadStatus: OPEN | ANSWERED (QA only; chat/announcement stay OPEN). */
    status: text("status").notNull().default("OPEN"),
    /** Accepted answer's forum_posts.id (QA). No FK: avoids circular threads↔posts FK — app-enforced. */
    acceptedPostId: uuid("accepted_post_id"),
    isPinned: boolean("is_pinned").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("forum_threads_zone_created_idx").on(t.zoneId, t.createdAt),
    index("forum_threads_zone_pinned_idx")
      .on(t.zoneId)
      .where(sql`${t.isPinned}`),
  ],
);

/* Slice 3 — QA answers. Question = a `forum_threads` row in a QA zone; answers live here.
 * Soft-delete mirrors threads; `is_accepted` set when the asker accepts (one-shot). */
export const forumPosts = pgTable(
  "forum_posts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => forumThreads.id),
    /** Reply target (APP-017 recursive threads). Null = top-level comment on the thread; set = a
     * reply to another comment. Self-FK; the row still carries the root `thread_id` for zone lookup. */
    parentPostId: uuid("parent_post_id").references(
      (): AnyPgColumn => forumPosts.id,
    ),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    isAccepted: boolean("is_accepted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("forum_posts_thread_created_idx").on(t.threadId, t.createdAt),
    index("forum_posts_parent_idx").on(t.parentPostId),
  ],
);

/** One reaction per (post, user, emoji) — comment likes (APP-017). Mirrors forum_reactions. */
export const forumPostReactions = pgTable(
  "forum_post_reactions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    postId: uuid("post_id")
      .notNull()
      .references(() => forumPosts.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_post_reactions_unique_idx").on(
      t.postId,
      t.userId,
      t.emoji,
    ),
    index("forum_post_reactions_post_idx").on(t.postId),
  ],
);

/** One reaction per (thread, user, emoji). Emoji constrained to FORUM_REACTION_EMOJIS in app. */
export const forumReactions = pgTable(
  "forum_reactions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => forumThreads.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_reactions_unique_idx").on(t.threadId, t.userId, t.emoji),
    index("forum_reactions_thread_idx").on(t.threadId),
  ],
);

/* Slice 5 — moderation. Reports flag a thread/post; the zone owner/mod (or platform staff) act on
 * them. "Hide" reuses the soft-delete (deleted_at) on threads/posts; the action log is the history.
 * zone_id is denormalized so the queue can filter per zone without a join. */
export const forumReports = pgTable(
  "forum_reports",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** ModerationTargetType: THREAD | POST */
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => forumZones.id),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    /** ReportReason: SPAM | HARASSMENT | OFF_TOPIC | OTHER */
    reason: text("reason").notNull(),
    note: text("note"),
    /** ReportStatus: OPEN | RESOLVED | DISMISSED */
    status: text("status").notNull().default("OPEN"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_reports_unique_idx").on(
      t.targetType,
      t.targetId,
      t.reporterId,
    ),
    index("forum_reports_zone_status_idx").on(t.zoneId, t.status),
    index("forum_reports_status_idx").on(t.status),
  ],
);

/** Append-only moderation audit (who hid/restored/dismissed what, why). Never edited/deleted. */
export const forumModerationActions = pgTable(
  "forum_moderation_actions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    /** ROOM (zone owner/mod) | PLATFORM (staff override). */
    actorScope: text("actor_scope").notNull(),
    /** HIDE | RESTORE | DISMISS */
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => forumZones.id),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("forum_moderation_actions_zone_created_idx").on(
      t.zoneId,
      t.createdAt,
    ),
  ],
);

/* Post attachments (APP-018). Polymorphic target (THREAD | POST) like forum_reports. Phase 1 = images;
 * the `kind` column carries video/file later without a migration. author_id = uploader (ownership +
 * cleanup); position orders a gallery. width/height are client-provided (aspect-ratio, no layout shift). */
export const forumAttachments = pgTable(
  "forum_attachments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** ModerationTargetType-style: THREAD | POST */
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    /** AttachmentKind: image (video | file later). */
    kind: text("kind").notNull().default("image"),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** Original filename — set only for `kind='file'` (download-chip label); null for images. */
    fileName: text("file_name"),
    width: integer("width"),
    height: integer("height"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("forum_attachments_target_idx").on(t.targetType, t.targetId),
    index("forum_attachments_author_idx").on(t.authorId),
  ],
);

/* Minted-but-unconfirmed attachment upload keys (APP-018 orphan-cleanup). A presigned upload writes
 * the object to storage BEFORE the post is created; if the create never lands (client abandons, or a
 * post-upload create rejection), the object orphans. We record each minted key here and clear it once
 * the key is attached (see forum_attachments insert); a cron sweeps rows older than the grace window
 * → deletes the storage object + row. Storage has no LIST, so this ledger is the orphan source. */
export const forumPendingAttachments = pgTable(
  "forum_pending_attachments",
  {
    storageKey: text("storage_key").primaryKey(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("forum_pending_attachments_created_idx").on(t.createdAt)],
);

/* Per-user saved posts (APP-018 bookmarks). Polymorphic target (THREAD | POST) like forum_reports —
 * a user saves a thread (chat post / QA question) or a post (comment / QA answer). Unique per
 * (user, target); the (user, created_at) index drives the reverse-chronological "Kaydedilenler" feed. */
export const forumBookmarks = pgTable(
  "forum_bookmarks",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** ModerationTargetType: THREAD | POST */
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_bookmarks_user_target_unique_idx").on(
      t.userId,
      t.targetType,
      t.targetId,
    ),
    index("forum_bookmarks_user_created_idx").on(t.userId, t.createdAt),
  ],
);

/* Social follow graph — a one-way, public, instant follow (Twitter-style; no approval/private accounts).
 * follower_id follows followee_id. Unique per pair (idempotent toggle, like forum_bookmarks). The
 * (followee, created_at) index drives "my followers" + follower count; (follower, created_at) drives
 * "who I follow" + the cross-zone "Akış" feed's author set. Accessed in SERVICE context, own-user
 * scoped by the WHERE clause (same trust model as forum_bookmarks — no separate RLS policy). */
export const userFollows = pgTable(
  "user_follows",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id),
    followeeId: uuid("followee_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_follows_pair_unique_idx").on(t.followerId, t.followeeId),
    index("user_follows_followee_created_idx").on(t.followeeId, t.createdAt),
    index("user_follows_follower_created_idx").on(t.followerId, t.createdAt),
  ],
);

/**
 * Study-buddy 1-1 pairing (yol arkadaşı). Mutual-consent accountability partner:
 * PENDING request → ACTIVE on accept; decline/cancel/end DELETEs the row (unfollow
 * semantics — no archival state in v1). Runs in SERVICE context and is own-user
 * scoped by the WHERE clause (same trust model as `user_follows` — no RLS policy).
 * Partner card shows effort only (focus minutes/streak) — never exam results (§4).
 */
export const buddyPairs = pgTable(
  "buddy_pairs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id),
    addresseeId: uuid("addressee_id")
      .notNull()
      .references(() => users.id),
    /** PENDING | ACTIVE. */
    status: text("status").notNull().default("PENDING"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    /** Per-direction nudge cooldown anchors (4h — buddy.service constant). */
    requesterLastNudgeAt: timestamp("requester_last_nudge_at", {
      withTimezone: true,
    }),
    addresseeLastNudgeAt: timestamp("addressee_last_nudge_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One row per user pair regardless of direction.
    uniqueIndex("buddy_pairs_pair_unique_idx").on(
      sql`least(${t.requesterId}, ${t.addresseeId})`,
      sql`greatest(${t.requesterId}, ${t.addresseeId})`,
    ),
    // DB belt for one-active-buddy per user; the authoritative check is the accept tx.
    uniqueIndex("buddy_pairs_requester_active_idx")
      .on(t.requesterId)
      .where(sql`${t.status} = 'ACTIVE'`),
    uniqueIndex("buddy_pairs_addressee_active_idx")
      .on(t.addresseeId)
      .where(sql`${t.status} = 'ACTIVE'`),
    index("buddy_pairs_addressee_status_idx").on(t.addresseeId, t.status),
  ],
);

/* --- Premium weekly review narration cache (W3). Aggregated/generated text only; no raw notes. */
export const aiWeeklyReviews = pgTable(
  "ai_weekly_reviews",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    examId: uuid("exam_id").notNull(),
    weekStart: date("week_start").notNull(),
    locale: text("locale").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    narration: text("narration").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ai_weekly_reviews_user_exam_week_locale_idx").on(
      t.userId,
      t.examId,
      t.weekStart,
      t.locale,
    ),
  ],
);

/** W3 · Premium proactive daily coach greeting on /coach — at most one LLM call per (user, day). */
export const aiDailyGreetings = pgTable(
  "ai_daily_greetings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    greetingDate: date("greeting_date").notNull(),
    greeting: text("greeting").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ai_daily_greetings_user_date_idx").on(
      t.userId,
      t.greetingDate,
    ),
  ],
);
