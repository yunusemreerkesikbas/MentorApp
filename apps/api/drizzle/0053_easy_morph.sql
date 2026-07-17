CREATE TABLE "buddy_pairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"accepted_at" timestamp with time zone,
	"requester_last_nudge_at" timestamp with time zone,
	"addressee_last_nudge_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buddy_pairs" ADD CONSTRAINT "buddy_pairs_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_pairs" ADD CONSTRAINT "buddy_pairs_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "buddy_pairs_pair_unique_idx" ON "buddy_pairs" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id"));--> statement-breakpoint
CREATE UNIQUE INDEX "buddy_pairs_requester_active_idx" ON "buddy_pairs" USING btree ("requester_id") WHERE "buddy_pairs"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "buddy_pairs_addressee_active_idx" ON "buddy_pairs" USING btree ("addressee_id") WHERE "buddy_pairs"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "buddy_pairs_addressee_status_idx" ON "buddy_pairs" USING btree ("addressee_id","status");