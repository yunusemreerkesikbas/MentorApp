-- APP-042: mistake notebook ("yanlış defteri") — entries + page layout documents.
--
-- Hand-written for the reason 0074 and 0075 record: `drizzle-kit generate` still diffs against a
-- snapshot taken before 0074 was hand-written, so it re-emits every 0074 statement (dataset_id, the
-- composite primary key, the indexes) on top of a database that already has them and the generated
-- file fails on migrate. It also cannot emit the RLS below.
--
-- Split rationale: `mistake_notebook_entries` holds what the student SAID about a mistake, because
-- two queries need it as columns — the review job scans `next_review_at`, the analysis tab
-- aggregates `error_type`. `mistake_notebook_pages` holds only WHERE things sit on the page, which
-- nothing queries into, so it stays one jsonb per page. One row per page rather than one document
-- per user (the vision board's shape): a notebook grows without bound, and saving one page must not
-- rewrite the whole book.

CREATE TABLE "mistake_notebook_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "exam_id" uuid NOT NULL,
  "mock_exam_id" uuid,
  "storage_key" text,
  "subject_ref" text,
  "topic_ref" text,
  "error_type" text NOT NULL,
  "note" text,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "review_count" integer DEFAULT 0 NOT NULL,
  "last_reviewed_at" timestamp with time zone,
  "next_review_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "mistake_notebook_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "page_index" integer NOT NULL,
  "doc" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "mistake_notebook_entries"
  ADD CONSTRAINT "mistake_notebook_entries_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- SET NULL, not cascade: most mistakes are caught while studying rather than in a mock exam, and
-- deleting an exam entry must never delete the lessons the user drew from it.
ALTER TABLE "mistake_notebook_entries"
  ADD CONSTRAINT "mistake_notebook_entries_mock_exam_id_mock_exams_id_fk"
  FOREIGN KEY ("mock_exam_id") REFERENCES "public"."mock_exams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_notebook_pages"
  ADD CONSTRAINT "mistake_notebook_pages_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- The due scan is (user_id, next_review_at); NULL sorts out of range so healed/archived rows leave
-- the index range without a status predicate.
CREATE INDEX "mistake_notebook_due_idx" ON "mistake_notebook_entries" ("user_id","next_review_at");--> statement-breakpoint
CREATE INDEX "mistake_notebook_user_created_idx" ON "mistake_notebook_entries" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "mistake_notebook_user_subject_idx" ON "mistake_notebook_entries" ("user_id","subject_ref");--> statement-breakpoint
CREATE INDEX "mistake_notebook_mock_idx" ON "mistake_notebook_entries" ("mock_exam_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mistake_notebook_pages_user_idx" ON "mistake_notebook_pages" ("user_id","page_index");--> statement-breakpoint

CREATE TRIGGER mistake_notebook_entries_set_updated_at BEFORE UPDATE ON "mistake_notebook_entries"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER mistake_notebook_pages_set_updated_at BEFORE UPDATE ON "mistake_notebook_pages"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ============== RLS (per-user behavioral data — same shape as mock_exams) ==============
ALTER TABLE "mistake_notebook_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mistake_notebook_entries" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY mistake_notebook_entries_self_or_service ON "mistake_notebook_entries"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
ALTER TABLE "mistake_notebook_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mistake_notebook_pages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY mistake_notebook_pages_self_or_service ON "mistake_notebook_pages"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );
