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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("exams_slug_unique_idx").on(t.slug), index("exams_family_idx").on(t.family)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("exam_subjects_pair_idx").on(t.examId, t.subjectId)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    /** IN_PROGRESS | COMPLETED | ABANDONED (StudySessionStatus). */
    status: text("status").notNull().default("IN_PROGRESS"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("daily_activity_user_date_unique_idx").on(t.userId, t.activityDate)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("streak_state_user_unique_idx").on(t.userId)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("mood_checkins_user_date_unique_idx").on(t.userId, t.checkinDate)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    /**
     * Cached premium AI-adaptive "ghost" (geçmiş-ben) progress narration for THIS attempt vs the
     * user's own past (premium-only; null for free / not yet generated). Naturally invalidated when
     * a newer attempt becomes the latest.
     */
    aiGhostNarration: text("ai_ghost_narration"),
    aiGhostModel: text("ai_ghost_model"),
    aiGhostAt: timestamp("ai_ghost_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    storageKey: text("storage_key").notNull(),
    clientRequestId: uuid("client_request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payment_webhook_provider_event_idx").on(t.provider, t.eventId)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_deliveries_dedupe_idx").on(t.userId, t.channel, t.template, t.dedupeKey),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("invite_redemptions_invited_unique_idx").on(t.invitedUserId),
    index("invite_redemptions_inviter_idx").on(t.inviterUserId),
  ],
);

/* --- Onboarding quests (§3 light economy): a completed quest → coin (capped, idempotent).
 * One row per (user, quest) recorded on completion; the reward is a ledger entry
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
    status: text("status").notNull().default("COMPLETED"),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_quest_progress_user_quest_unique_idx").on(t.userId, t.questId),
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
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    /** Estimated cost in micro-USD (integer; per-call cost is far below 1 minor unit). */
    costMicros: integer("cost_micros").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_user_created_idx").on(t.userId, t.createdAt)],
);

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
    organizationId: uuid("organization_id").references(() => organizations.id),
    createdBy: uuid("created_by").references(() => users.id),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("forum_threads_zone_created_idx").on(t.zoneId, t.createdAt),
    index("forum_threads_zone_pinned_idx").on(t.zoneId).where(sql`${t.isPinned}`),
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
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    isAccepted: boolean("is_accepted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("forum_posts_thread_created_idx").on(t.threadId, t.createdAt)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_reports_unique_idx").on(t.targetType, t.targetId, t.reporterId),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("forum_moderation_actions_zone_created_idx").on(t.zoneId, t.createdAt)],
);
