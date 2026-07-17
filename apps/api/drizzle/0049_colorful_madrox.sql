CREATE TABLE "coach_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_conversations" ADD CONSTRAINT "coach_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_conversations_user_last_idx" ON "coach_conversations" USING btree ("user_id","last_message_at");--> statement-breakpoint
-- Threads land on an existing single-rolling-conversation model: add the column nullable, backfill
-- one conversation per user that already has messages, then enforce NOT NULL.
ALTER TABLE "coach_messages" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
INSERT INTO "coach_conversations" ("user_id", "title", "created_at", "last_message_at")
SELECT
  m.user_id,
  coalesce(
    left(
      (SELECT u.content FROM "coach_messages" u
       WHERE u.user_id = m.user_id AND u.role = 'USER'
       ORDER BY u.created_at ASC LIMIT 1),
      60
    ),
    'Sohbet'
  ),
  min(m.created_at),
  max(m.created_at)
FROM "coach_messages" m
GROUP BY m.user_id;--> statement-breakpoint
UPDATE "coach_messages" m
SET "conversation_id" = c.id
FROM "coach_conversations" c
WHERE c.user_id = m.user_id AND m.conversation_id IS NULL;--> statement-breakpoint
ALTER TABLE "coach_messages" ALTER COLUMN "conversation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_conversation_id_coach_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."coach_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_messages_conversation_created_idx" ON "coach_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
-- ===================== RLS (coach_conversations — per-user behavioral data) =====================
ALTER TABLE "coach_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coach_conversations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY coach_conversations_self_or_service ON "coach_conversations"
  FOR ALL
  USING (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  );
