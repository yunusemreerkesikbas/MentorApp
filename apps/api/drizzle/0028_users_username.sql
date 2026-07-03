ALTER TABLE "users" ADD COLUMN "username" text;
ALTER TABLE "users" ADD CONSTRAINT "users_username_format_check" CHECK ("username" IS NULL OR "username" ~ '^[a-z0-9_]{3,24}$');
CREATE UNIQUE INDEX "users_username_unique_idx" ON "users" (lower("username"));
