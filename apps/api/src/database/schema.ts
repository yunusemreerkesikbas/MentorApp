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
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
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
    /**
     * KPSS guide level (LISANS | ONLISANS | ORTAOGRETIM); null for every other family.
     *
     * Unconstrained text, like `examType` and `exams.family` — the enum lives in `@mentor/types`
     * and is enforced at the API edge, so a new variant never needs a migration.
     */
    examVariant: text("exam_variant"),
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

/**
 * Official public holidays — editorial reference data, same trust contract as `exam_events`
 * (guardrail §4 #1: official information is verified content, never derived or AI-generated).
 *
 * Seeded per country and year rather than computed: the religious holidays follow the Hijri
 * calendar and their exact dates — plus any bridge days — come from an official announcement.
 */
export const publicHolidays = pgTable(
  "public_holidays",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** ISO 3166-1 alpha-2; "TR" today, org-ready for later markets. */
    country: varchar("country", { length: 2 }).notNull().default("TR"),
    holidayDate: date("holiday_date").notNull(),
    name: text("name").notNull(),
    /** FULL | HALF — HALF covers the bayram arifesi afternoon (PublicHolidayKind). */
    kind: text("kind").notNull().default("FULL"),
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
    uniqueIndex("public_holidays_country_date_unique_idx").on(t.country, t.holidayDate),
    index("public_holidays_country_date_idx").on(t.country, t.holidayDate),
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

/**
 * Turkish provinces — global geo reference for the goal map. Keyed by plate code ("01".."81"):
 * it is stable, already zero-padded, and every Turkish user recognises it, so no surrogate id.
 * No trust metadata: province names and plate codes are not the kind of fact that goes stale.
 */
export const cities = pgTable("cities", {
  code: varchar("code", { length: 2 }).primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** GeoRegion — one of the seven geographic regions; groups the accessible province list. */
  region: text("region").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Universities per province — editorial reference data imported once a year from the YÖK/ÖSYM
 * listing, never scraped at runtime. Trust metadata is mandatory (§1): the UI shows a
 * "source + last verified" badge.
 *
 * Deliberately stops here (roadmap §1 "B layer"): no programs/departments, no base scores,
 * no quotas. Adding those means an annual import obligation and accuracy liability the product
 * decided against — a `programs` table can hang off this one later if that decision changes.
 */
export const universities = pgTable(
  "universities",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    cityCode: varchar("city_code", { length: 2 })
      .notNull()
      .references(() => cities.code, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** UniversityKind — STATE | FOUNDATION | FOUNDATION_VOCATIONAL. */
    kind: text("kind").notNull(),
    /** Null when the source didn't state it — never inferred. */
    foundedYear: integer("founded_year"),
    websiteUrl: text("website_url"),
    /**
     * Main-campus coordinates, geocoded once from OpenStreetMap and stored — never looked up at
     * runtime. Nullable on purpose: a university without a fix is listed but gets no map pin,
     * rather than being dropped or pinned somewhere invented.
     */
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("universities_slug_unique_idx").on(t.slug),
    index("universities_city_idx").on(t.cityCode),
  ],
);

/**
 * Higher-education programs from the ÖSYM guide — what you can actually study where.
 *
 * Keyed by the 9-digit ÖSYM program code: it is unique across both guides, stable year to year,
 * and printed on every official document, so there is no reason to mint a surrogate id.
 *
 * `quota` and `guideYear` describe THIS year's offering. Last year's cutoff lives in
 * `program_scores` — the same guide row carries both, and conflating them would report a 2026
 * quota as if it were 2025 data.
 */
export const programs = pgTable(
  "programs",
  {
    code: varchar("code", { length: 9 }).primaryKey(),
    universityId: uuid("university_id")
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    /** Denormalized faculty/school name straight from the guide — no faculty table earns its keep. */
    faculty: text("faculty").notNull(),
    /** Verbatim, including the (İngilizce) / (Burslu) / (KKTC Uyruklu) suffixes that make it distinct. */
    name: text("name").notNull(),
    /** LISANS | ONLISANS */
    level: text("level").notNull(),
    durationYears: smallint("duration_years").notNull(),
    /** SAY | EA | SÖZ | DİL (lisans) · TYT (önlisans) */
    scoreType: text("score_type").notNull(),
    /** Seats offered in `guideYear`. Always stated in the guide. */
    quota: integer("quota").notNull(),
    guideYear: smallint("guide_year").notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("programs_university_idx").on(t.universityId),
    index("programs_level_idx").on(t.level),
  ],
);

/**
 * Placement results per program per year — one row per (program, year).
 *
 * A separate table on purpose: the product wants to show 2026 next to 2025 once it lands, and a
 * bare `min_score` column on `programs` would have to be overwritten each year, destroying exactly
 * the comparison it is meant to support.
 *
 * Both figures are nullable: ~13% of programs have no cutoff (new programs, unfilled quotas, the
 * KKTC rows), where the guide prints "----" rather than a number. Null means "not placed", never zero.
 */
export const programScores = pgTable(
  "program_scores",
  {
    programCode: varchar("program_code", { length: 9 })
      .notNull()
      .references(() => programs.code, { onDelete: "cascade" }),
    scoreYear: smallint("score_year").notNull(),
    minScore: numeric("min_score", { precision: 9, scale: 5 }),
    successRank: integer("success_rank"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("program_scores_program_year_idx").on(t.programCode, t.scoreYear),
  ],
);

/**
 * One published edition of a reference dataset — a KPSS placement round, a YKS guide year.
 *
 * Reference data used to be implicitly "whatever is loaded right now": `kpss_postings.round` was a
 * label repeated on 1.1k rows that no query filtered by, so seeding a second round would have
 * silently doubled every count on the map. The dataset row makes the edition an entity, so a
 * period can be selected, labelled, and kept alongside its predecessors instead of overwriting them.
 *
 * Deliberately separate from `programCatalogDatasets` for now: that one is wired into the
 * preference simulation's `datasetVersion` reconciliation, and folding it in belongs with the
 * `programs` multi-year migration rather than ahead of it.
 *
 * `descriptionTr`/`descriptionEn` carry the source note the UI shows beside the data. Storing the
 * sentence rather than composing it from parts is what makes each dataset independently editable —
 * a new round can explain its own scope without a code change.
 */
export const referenceDatasets = pgTable(
  "reference_datasets",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** KPSS | YKS | LGS — matches `users.examType`. */
    examFamily: text("exam_family").notNull(),
    /** KPSS_POSTINGS | YKS_PROGRAMS — which dataset within the family. */
    kind: text("kind").notNull(),
    /** Human-facing edition label, e.g. "2026-1" (KPSS round) or "2026" (YKS guide year). */
    period: text("period").notNull(),
    /**
     * Numeric ordering key, e.g. 20261. `period` is text and sorting it lexicographically puts
     * "2026-10" before "2026-2" — the bug the old `findLatestRound` carried.
     */
    sortKey: integer("sort_key").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    descriptionTr: text("description_tr"),
    descriptionEn: text("description_en"),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reference_datasets_kind_period_idx").on(t.kind, t.period),
    // At most one current edition per dataset — the fallback when no period is requested.
    uniqueIndex("reference_datasets_current_kind_idx")
      .on(t.kind)
      .where(sql`${t.isCurrent} = true`),
  ],
);

/**
 * Civil-service titles ("kadro unvanı") — MÜHENDİS, AVUKAT, VHKİ, KÜTÜPHANECİ…
 *
 * This is the KPSS goal anchor. Unlike the institution list below, titles barely move between
 * placement rounds: they are the permanent job names of the public service, so "Konya'da VHKİ
 * olmak" stays a valid goal long after any particular vacancy is gone.
 */
export const titles = pgTable("titles", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  source: text("source").notNull(),
  sourceUrl: text("source_url").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Public institutions that appear in the imported placement round.
 *
 * NOT a catalogue of every public body in Turkey — it is whoever posted a vacancy in the rounds we
 * have imported, which is why it is a secondary filter and never a required choice. A user whose
 * dream institution simply did not hire this round must still be able to set a goal.
 */
export const institutions = pgTable("institutions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  source: text("source").notNull(),
  sourceUrl: text("source_url").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One vacancy row from a KPSS placement guide — (institution × title × province) for one round.
 *
 * Explicitly round-scoped: `round` is part of the identity of every row and is shown in the UI, so
 * the map says "2026-1 döneminde bu ilde N ilan" rather than implying a standing state of the
 * world. Cheap to keep whole (~1.1k rows per round) and the only thing that can tell the map which
 * institutions are actually present in a province.
 *
 * Placement scores are deliberately absent: showing "how many are hired" is a fact, predicting
 * "will my score be enough" is the placement simulation the product decided against (roadmap §1).
 */
export const kpssPostings = pgTable(
  "kpss_postings",
  {
    /**
     * ÖSYM's own row code, printed in the guide. Unique *within* a round only — which is why it
     * is half of the key rather than all of it. As a bare PK, importing a later round whose codes
     * happened to overlap would have silently overwritten the earlier one.
     */
    osymCode: varchar("osym_code", { length: 12 }).notNull(),
    /** The placement round this row belongs to. Every posting query starts here. */
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => referenceDatasets.id, { onDelete: "cascade" }),
    /** LISANS | ONLISANS | ORTAOGRETIM — which guide the row came from. */
    educationLevel: text("education_level").notNull(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    cityCode: varchar("city_code", { length: 2 })
      .notNull()
      .references(() => cities.code, { onDelete: "restrict" }),
    /** İLÇE — free text; districts are not modelled as entities. */
    district: text("district"),
    /** MEMUR | SÖZLEŞMELİ PERSONEL | KİT SÖZLEŞMELİ PERSONEL */
    employmentType: text("employment_type").notNull(),
    /** HİZMET SINIFI — GİH, TH, AH, SH… */
    serviceClass: text("service_class"),
    grade: smallint("grade"),
    /** ADET — how many people are taken for this row. */
    quota: integer("quota").notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: "kpss_postings_pkey",
      columns: [t.datasetId, t.osymCode],
    }),
    // Every read is "this round, this province" — the composite leads with the round for that.
    index("kpss_postings_dataset_city_idx").on(t.datasetId, t.cityCode),
    index("kpss_postings_title_idx").on(t.titleId),
    index("kpss_postings_institution_idx").on(t.institutionId),
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
    /** Wall-clock start on `task_date`; NULL = all-day item (every pre-calendar row). */
    startTime: time("start_time"),
    /** Wall-clock end; requires `start_time` and must be later (plan_tasks_time_range_chk). */
    endTime: time("end_time"),
    /** Optional free-text note shown in the calendar event preview. */
    description: text("description"),
    /** Structural cross-module provenance; no FK to AI/forum tables. */
    originType: text("origin_type"),
    originRefId: uuid("origin_ref_id"),
    originMeta: jsonb("origin_meta").$type<
      | {
          threadId: string;
          intent: "PLAN" | "NEXT_STEP" | "STUDY_METHOD" | "STRATEGY";
          zoneType: "CHAT" | "QA";
        }
      | { coachMessageId: string }
    >(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("plan_tasks_user_date_idx").on(t.userId, t.taskDate),
    uniqueIndex("plan_tasks_ai_coach_origin_idx")
      .on(t.originRefId)
      .where(sql`${t.originType} = 'AI_COACH'`),
    check(
      "plan_tasks_origin_consistency_chk",
      sql`(
        (${t.originType} is null and ${t.originRefId} is null and ${t.originMeta} is null)
        or
        (${t.originType} in ('COMMUNITY_COACH', 'AI_COACH') and ${t.originRefId} is not null and ${t.originMeta} is not null)
      )`,
    ),
  ],
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
    aiLocale: varchar("ai_locale", { length: 5 }),
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
    aiLocale: varchar("ai_locale", { length: 5 }),
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
    /**
     * Normalized map selection. `target_city` (below) stays as the free-text fallback for rows
     * written before the map existed and for goals the province list can't express (abroad,
     * "not listed"). Read rule: prefer the code, fall back to the text.
     * ON DELETE SET NULL on both FKs — dropping a reference row must never delete a user's goal.
     */
    targetCityCode: varchar("target_city_code", { length: 2 }).references(
      () => cities.code,
      { onDelete: "set null" },
    ),
    targetCity: text("target_city"),
    targetUniversityId: uuid("target_university_id").references(
      () => universities.id,
      { onDelete: "set null" },
    ),
    /**
     * KPSS side of the goal. `target_title_id` is the anchor (permanent civil-service title);
     * `target_institution_id` is an optional narrower whose list is round-scoped, so it must never
     * be required. YKS uses `target_university_id` above; the exam type decides which apply.
     */
    targetTitleId: uuid("target_title_id").references(() => titles.id, {
      onDelete: "set null",
    }),
    targetInstitutionId: uuid("target_institution_id").references(
      () => institutions.id,
      { onDelete: "set null" },
    ),
    /** CareerGroup — one of ten broad fields; drives the mascot variant. */
    careerGroup: text("career_group"),
    motivation: text("motivation"),
    /**
     * The collage document the user designs on `/hedef/pano` — `{ version, status, frame,
     * background, items[] }`, shape owned by `visionBoardDocSchema` (@mentor/validation).
     * `null` = the user has a goal but has never opened the board.
     *
     * One jsonb column rather than a `vision_board_items` table: the items are only ever read and
     * written as a whole document, so rows would buy nothing but joins. Written ONLY by
     * `updateBoard` — never by the goal upsert, whose AI-note invalidation must not fire when
     * somebody drags a sticker.
     * ponytail: `status` lives inside the document; promote it to a column when a query needs it.
     */
    board: jsonb("board"),
    aiNote: text("ai_note"),
    aiModel: text("ai_model"),
    aiLocale: varchar("ai_locale", { length: 5 }),
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
    aiNarrationLocale: varchar("ai_narration_locale", { length: 5 }),
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

/**
 * Mistake notebook ("yanlış defteri") — one row per wrong answer the user chose to keep.
 *
 * These are columns, not another jsonb document, because two queries need them: the review job
 * scans `next_review_at`, and the analysis tab aggregates `error_type`. Placement on the page is
 * the other half and *does* stay in jsonb — see `mistakeNotebookPages`.
 *
 * `mock_exam_id` is nullable and ON DELETE SET NULL on purpose: most mistakes are caught while
 * studying, not in a mock exam, and deleting an exam must not delete the lessons drawn from it.
 */
export const mistakeNotebookEntries = pgTable(
  "mistake_notebook_entries",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SOFT ref → content.exams (no FK), same rule as `mockExams`. */
    examId: uuid("exam_id").notNull(),
    mockExamId: uuid("mock_exam_id").references(() => mockExams.id, {
      onDelete: "set null",
    }),
    /** R2 key under `notebook/{userId}/`. Null = a text-only entry, which is allowed. */
    storageKey: text("storage_key"),
    /** SOFT refs → content subject/topic slugs; both null until the user (or vision) labels it. */
    subjectRef: text("subject_ref"),
    topicRef: text("topic_ref"),
    /** `NOTEBOOK_ERROR_TYPES`. Text, not a pg enum — the list is append-only and config-like. */
    errorType: text("error_type").notNull(),
    note: text("note"),
    /** ACTIVE | HEALED | ARCHIVED. */
    status: text("status").notNull().default("ACTIVE"),
    reviewCount: integer("review_count").notNull().default(0),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    /**
     * Null once the entry leaves the rotation (HEALED/ARCHIVED). Keeping the exit condition in the
     * same column the due query filters on means that query stays a single index scan.
     */
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    /**
     * OWN | COMMUNITY. Where the question came from — never what the entry means: a community
     * question only enters the book with the user's own "I could not do this either", so it counts
     * toward the weakness map exactly like the rest. Anything they merely wanted to keep belongs in
     * the forum's own bookmarks, not here, or the map starts describing other people's gaps.
     */
    source: text("source").notNull().default("OWN"),
    /**
     * SOFT ref → forum threads, deliberately without a FK: threads belong to another bounded
     * context and a database edge would couple coaching's table to forum's. A deleted thread leaves
     * an id that reads as "no thread", the same rule `exam_id` follows.
     */
    communityThreadId: uuid("community_thread_id"),
    /** Set by the `forum.answer.accepted` listener — the card has a verified answer waiting. */
    communityAnsweredAt: timestamp("community_answered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("mistake_notebook_due_idx").on(t.userId, t.nextReviewAt),
    index("mistake_notebook_thread_idx").on(t.communityThreadId),
    index("mistake_notebook_user_created_idx").on(t.userId, t.createdAt),
    index("mistake_notebook_user_subject_idx").on(t.userId, t.subjectRef),
    index("mistake_notebook_mock_idx").on(t.mockExamId),
  ],
);

/**
 * One row per notebook page. Unlike the vision board's single document per user, a notebook grows
 * without bound — saving one page must not rewrite the whole book, and turning to a page must not
 * ship every other page's items.
 *
 * `doc` shape is owned by `notebookPageDocSchema` (@mentor/validation): `{ version, paper, items }`
 * where an item is an entry reference, a sticker or a text block. Entry *content* is never in here.
 */
export const mistakeNotebookPages = pgTable(
  "mistake_notebook_pages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pageIndex: integer("page_index").notNull(),
    doc: jsonb("doc").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("mistake_notebook_pages_user_idx").on(t.userId, t.pageIndex)],
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
    /** Optional idempotency key for event-backed notifications. */
    dedupeKey: text("dedupe_key"),
    /** Structured resource metadata; literal legacy notifications keep this null. */
    data: jsonb("data").$type<Record<string, unknown>>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    linkUrl: text("link_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("user_notifications_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("user_notifications_user_dedupe_idx")
      .on(t.userId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
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
    /** Structural provenance only; never stores forum content or third-party identity data. */
    originType: text("origin_type"),
    /** Cross-module reference by value; intentionally no forum FK. */
    originRefId: uuid("origin_ref_id"),
    /** { intent, tagSlug }; no thread title/body/comment/profile data. */
    originMeta: jsonb("origin_meta").$type<{
      intent: "PLAN" | "NEXT_STEP" | "STUDY_METHOD" | "STRATEGY";
      tagSlug: string;
    }>(),
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

/* --- Transparent mentor preferences. This private profile is user-only; it is never exposed to
 * teacher/coach/org/support surfaces. `organization_id` is future tenancy metadata, not an access
 * grant. The memory consent gate controls both learning and prompt injection. */
export const coachProfiles = pgTable(
  "coach_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    calibrationStatus: text("calibration_status")
      .notNull()
      .default("NOT_STARTED"),
    memoryConsent: text("memory_consent").notNull().default("PENDING"),
    supportPreference: text("support_preference"),
    directnessPreference: text("directness_preference"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "coach_profiles_values_chk",
      sql`(
        ${t.calibrationStatus} in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')
        and ${t.memoryConsent} in ('PENDING', 'GRANTED', 'DECLINED')
        and (${t.supportPreference} is null or ${t.supportPreference} in ('EMOTIONAL', 'BALANCED', 'ACTION'))
        and (${t.directnessPreference} is null or ${t.directnessPreference} in ('GENTLE', 'BALANCED', 'DIRECT'))
      )`,
    ),
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
    /** PII-minimal context snapshot available when a COACH reply was generated. */
    personalizationContext: jsonb("personalization_context"),
    /** Explicit source selected by the user for this turn; revalidated on regenerate. */
    requestContext: jsonb("request_context").$type<{
      mockExamId?: string;
      articleSlug?: string;
    }>(),
    /** Backend-validated, single proposed action on a COACH row. */
    action: jsonb("action"),
    actionStatus: text("action_status"),
    /** Result reference such as the created AI_COACH plan task. */
    actionResultRefId: uuid("action_result_ref_id"),
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
    check(
      "coach_messages_action_consistency_chk",
      sql`(
        (${t.action} is null and ${t.actionStatus} is null and ${t.actionResultRefId} is null)
        or
        (${t.action} is not null and ${t.actionStatus} in ('PROPOSED', 'ACCEPTED', 'COMPLETED', 'CANCELLED'))
      )`,
    ),
  ],
);

/* --- Allowlisted cross-thread memory facts. The model may propose a fact, but the backend stores
 * only normalized key/value data. CHAT facts point at the exact USER message and cascade with it;
 * USER_EDIT facts detach from the original conversation lifecycle. */
export const coachMemoryFacts = pgTable(
  "coach_memory_facts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    source: text("source").notNull(),
    sourceMessageId: uuid("source_message_id").references(
      () => coachMessages.id,
      { onDelete: "cascade" },
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("coach_memory_facts_user_updated_idx").on(t.userId, t.updatedAt),
    uniqueIndex("coach_memory_facts_user_key_idx").on(t.userId, t.key),
    check(
      "coach_memory_facts_source_consistency_chk",
      sql`(
        (${t.source} = 'CHAT' and ${t.sourceMessageId} is not null)
        or
        (${t.source} = 'USER_EDIT' and ${t.sourceMessageId} is null)
      )`,
    ),
    check(
      "coach_memory_facts_key_chk",
      sql`${t.key} in ('STUDY_TIME', 'RESPONSE_PREFERENCE', 'CHALLENGE_CATEGORY', 'PRIORITY_SUBJECT')`,
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

/** Curated discovery tags. Public reads are active-only; staff mutations are audited. */
export const forumTags = pgTable(
  "forum_tags",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").notNull(),
    nameTr: text("name_tr").notNull(),
    nameEn: text("name_en").notNull(),
    examType: text("exam_type"),
    /** ForumCoachIntent; null keeps the tag outside the community→coach pilot. */
    coachIntent: text("coach_intent").$type<
      "PLAN" | "NEXT_STEP" | "STUDY_METHOD" | "STRATEGY"
    >(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_tags_slug_idx").on(t.slug),
    index("forum_tags_active_exam_idx").on(t.isActive, t.examType),
  ],
);

/** Member-proposed tags remain separate from the curated pool until staff review. */
export const forumTagSuggestions = pgTable(
  "forum_tag_suggestions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    requestedName: text("requested_name").notNull(),
    normalizedSlug: text("normalized_slug").notNull(),
    status: text("status").notNull().default("PENDING"),
    suggestedBy: uuid("suggested_by").references(() => users.id, { onDelete: "set null" }),
    resolvedTagId: uuid("resolved_tag_id").references(() => forumTags.id, {
      onDelete: "set null",
    }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "forum_tag_suggestions_status_check",
      sql`${t.status} in ('PENDING', 'APPROVED', 'REJECTED')`,
    ),
    uniqueIndex("forum_tag_suggestions_pending_slug_idx")
      .on(t.normalizedSlug)
      .where(sql`${t.status} = 'PENDING'`),
    index("forum_tag_suggestions_status_created_idx").on(t.status, t.createdAt),
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
    /** Discovery ordering anchor, updated transactionally when the thread receives activity. */
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Null until the author changes title/body/tags. */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    /** Time-bounded editorial curation. Null means not manually featured. */
    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    featuredBy: uuid("featured_by").references(() => users.id),
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
    index("forum_threads_discovery_activity_idx").on(t.lastActivityAt, t.id),
    index("forum_threads_featured_idx")
      .on(t.featuredUntil)
      .where(sql`${t.featuredUntil} is not null`),
    index("forum_threads_zone_pinned_idx")
      .on(t.zoneId)
      .where(sql`${t.isPinned}`),
  ],
);

/** At most three active curated tags per thread (limit enforced in the service transaction). */
export const forumThreadTags = pgTable(
  "forum_thread_tags",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => forumThreads.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => forumTags.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_thread_tags_unique_idx").on(t.threadId, t.tagId),
    index("forum_thread_tags_tag_thread_idx").on(t.tagId, t.threadId),
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
    /** Null until the author changes the post body. */
    editedAt: timestamp("edited_at", { withTimezone: true }),
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

/** One positive helpful vote per user/target. QA uses THREAD for questions and POST for answers. */
export const forumHelpfulVotes = pgTable(
  "forum_helpful_votes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** THREAD | POST */
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    value: smallint("value").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_helpful_votes_unique_idx").on(t.targetType, t.targetId, t.userId),
    index("forum_helpful_votes_target_idx").on(t.targetType, t.targetId),
  ],
);

/** One reaction per (post, user). Selecting another emoji replaces the current reaction. */
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
    uniqueIndex("forum_post_reactions_unique_idx").on(t.postId, t.userId),
    index("forum_post_reactions_post_idx").on(t.postId),
  ],
);

/** One reaction per (thread, user). Emoji is constrained to FORUM_REACTION_EMOJIS in app. */
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
    uniqueIndex("forum_reactions_unique_idx").on(t.threadId, t.userId),
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

/** W3 · Premium dashboard greeting — at most one LLM call per (user, day, locale). */
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
    locale: varchar("locale", { length: 5 }).notNull().default("tr"),
    greeting: text("greeting").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ai_daily_greetings_user_date_locale_idx").on(
      t.userId,
      t.greetingDate,
      t.locale,
    ),
  ],
);

/* ==================== YKS preference simulation pilot ====================
 * Content-owned editorial catalogue/campus records are global reference data.
 * Coaching-owned scenarios are per-user behavioral data and are RLS-scoped.
 * Tables are appended here to respect the shared-schema workstream rule.
 * ======================================================================== */

export const programCatalogDatasets = pgTable(
  "program_catalog_datasets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    examType: text("exam_type").notNull(),
    version: varchar("version", { length: 80 }).notNull(),
    guideYear: smallint("guide_year").notNull(),
    placementYear: smallint("placement_year").notNull(),
    officialPreferenceLimit: smallint("official_preference_limit").notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("program_catalog_datasets_version_idx").on(t.version),
    uniqueIndex("program_catalog_datasets_active_exam_idx")
      .on(t.examType)
      .where(sql`${t.isActive} = true`),
    check("program_catalog_datasets_years_chk", sql`${t.guideYear} >= ${t.placementYear}`),
    check("program_catalog_datasets_limit_chk", sql`${t.officialPreferenceLimit} > 0`),
  ],
);

export const campusExperiences = pgTable(
  "campus_experiences",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    universityId: uuid("university_id")
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    coverageStatus: text("coverage_status").notNull(),
    renderMode: text("render_mode").notNull(),
    initialLatitude: numeric("initial_latitude", { precision: 9, scale: 6 }).notNull(),
    initialLongitude: numeric("initial_longitude", { precision: 9, scale: 6 }).notNull(),
    initialAltitude: numeric("initial_altitude", { precision: 10, scale: 2 }).notNull(),
    initialHeading: numeric("initial_heading", { precision: 6, scale: 2 }).notNull(),
    initialTilt: numeric("initial_tilt", { precision: 5, scale: 2 }).notNull(),
    initialRange: numeric("initial_range", { precision: 10, scale: 2 }).notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    isEnabled: boolean("is_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("campus_experiences_university_idx").on(t.universityId),
    check(
      "campus_experiences_coverage_chk",
      sql`${t.coverageStatus} IN ('PHOTOREALISTIC', 'TERRAIN_ONLY', 'UNKNOWN')`,
    ),
    check(
      "campus_experiences_render_mode_chk",
      sql`${t.renderMode} IN ('PHOTOREALISTIC', 'HYBRID')`,
    ),
    check(
      "campus_experiences_enabled_verified_chk",
      sql`${t.isEnabled} = false OR ${t.coverageStatus} <> 'UNKNOWN'`,
    ),
  ],
);

export const campusPois = pgTable(
  "campus_pois",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    campusExperienceId: uuid("campus_experience_id")
      .notNull()
      .references(() => campusExperiences.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 120 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    titleTr: text("title_tr").notNull(),
    titleEn: text("title_en").notNull(),
    summaryTr: text("summary_tr").notNull(),
    summaryEn: text("summary_en").notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6 }).notNull(),
    longitude: numeric("longitude", { precision: 9, scale: 6 }).notNull(),
    altitude: numeric("altitude", { precision: 10, scale: 2 }).notNull(),
    heading: numeric("heading", { precision: 6, scale: 2 }).notNull(),
    tilt: numeric("tilt", { precision: 5, scale: 2 }).notNull(),
    range: numeric("range", { precision: 10, scale: 2 }).notNull(),
    position: smallint("position").notNull(),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("campus_pois_experience_slug_idx").on(t.campusExperienceId, t.slug),
    uniqueIndex("campus_pois_experience_position_idx").on(
      t.campusExperienceId,
      t.position,
    ),
    check("campus_pois_position_chk", sql`${t.position} > 0`),
  ],
);

export const preferenceScenarios = pgTable(
  "preference_scenarios",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    examType: text("exam_type").notNull(),
    datasetVersion: varchar("dataset_version", { length: 80 }).notNull(),
    rankSay: integer("rank_say"),
    rankEa: integer("rank_ea"),
    rankSoz: integer("rank_soz"),
    rankDil: integer("rank_dil"),
    rankTyt: integer("rank_tyt"),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("preference_scenarios_user_idx").on(t.userId),
    index("preference_scenarios_org_idx").on(t.organizationId),
    check("preference_scenarios_revision_chk", sql`${t.revision} > 0`),
    check("preference_scenarios_exam_chk", sql`${t.examType} = 'YKS'`),
  ],
);

export const preferenceScenarioItems = pgTable(
  "preference_scenario_items",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => preferenceScenarios.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    programCode: varchar("program_code", { length: 9 }).notNull(),
    programName: text("program_name").notNull(),
    faculty: text("faculty").notNull(),
    level: text("level").notNull(),
    scoreType: text("score_type").notNull(),
    quota: integer("quota").notNull(),
    guideYear: smallint("guide_year").notNull(),
    placementYear: smallint("placement_year").notNull(),
    successRank: integer("success_rank"),
    universityId: uuid("university_id").notNull(),
    universityName: text("university_name").notNull(),
    cityCode: varchar("city_code", { length: 2 }).notNull(),
    cityName: text("city_name").notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("preference_scenario_items_position_idx").on(t.scenarioId, t.position),
    uniqueIndex("preference_scenario_items_program_idx").on(
      t.scenarioId,
      t.programCode,
    ),
    index("preference_scenario_items_user_idx").on(t.userId),
    check("preference_scenario_items_position_chk", sql`${t.position} > 0`),
  ],
);

/* ============================== forum polls ==============================
 * Optional immutable poll aggregate owned by a forum thread. Organization scope is inherited
 * through thread -> zone; voter identities remain private and are never exposed by the API.
 * ======================================================================== */
export const forumPolls = pgTable(
  "forum_polls",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => forumThreads.id, { onDelete: "cascade" }),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_polls_thread_unique_idx").on(t.threadId),
    index("forum_polls_ends_idx").on(t.endsAt),
    check("forum_polls_ends_after_created_chk", sql`${t.endsAt} > ${t.createdAt}`),
  ],
);

export const forumPollOptions = pgTable(
  "forum_poll_options",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => forumPolls.id, { onDelete: "cascade" }),
    text: varchar("text", { length: 25 }).notNull(),
    position: smallint("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_poll_options_poll_position_idx").on(t.pollId, t.position),
    uniqueIndex("forum_poll_options_poll_id_id_idx").on(t.pollId, t.id),
    check("forum_poll_options_position_chk", sql`${t.position} between 0 and 3`),
  ],
);

export const forumPollVotes = pgTable(
  "forum_poll_votes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => forumPolls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("forum_poll_votes_poll_user_idx").on(t.pollId, t.userId),
    index("forum_poll_votes_option_idx").on(t.optionId),
    foreignKey({
      name: "forum_poll_votes_poll_option_fk",
      columns: [t.pollId, t.optionId],
      foreignColumns: [forumPollOptions.pollId, forumPollOptions.id],
    }).onDelete("cascade"),
  ],
);

/* ======================== Community · permanent achievements ========================
 * Code-owned V1 catalogue; earned rows are immutable except for `celebrated_at`.
 * Public profile reads expose only earned rows, while writes remain service-only.
 * =================================================================================== */
export const userAchievements = pgTable(
  "user_achievements",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    ruleVersion: smallint("rule_version").notNull().default(1),
    /** LIVE | BACKFILL */
    source: text("source").notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull(),
    celebratedAt: timestamp("celebrated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_achievements_user_achievement_unique_idx").on(
      t.userId,
      t.achievementId,
    ),
    index("user_achievements_user_earned_idx").on(t.userId, t.earnedAt),
    index("user_achievements_org_user_idx").on(t.orgId, t.userId),
    check("user_achievements_source_chk", sql`${t.source} in ('LIVE', 'BACKFILL')`),
    check("user_achievements_rule_version_chk", sql`${t.ruleVersion} > 0`),
  ],
);

/** Explicit, idempotent completion of a READY weekly review. Coaching owns this evidence. */
export const weeklyReviewCompletions = pgTable(
  "weekly_review_completions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    examId: uuid("exam_id").notNull(),
    weekStart: date("week_start").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("weekly_review_completions_user_exam_week_unique_idx").on(
      t.userId,
      t.examId,
      t.weekStart,
    ),
    index("weekly_review_completions_user_completed_idx").on(t.userId, t.completedAt),
  ],
);
