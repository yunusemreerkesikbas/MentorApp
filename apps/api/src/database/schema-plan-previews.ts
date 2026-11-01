import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CoachPlanAdaptationDto } from "@mentor/types";
import { organizations, users } from "./schema";

/** AI owns generated previews; the append-only Coin debit remains Economy-owned. */
export const aiPlanPreviews = pgTable(
  "ai_plan_previews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientRequestId: uuid("client_request_id").notNull(),
    inputHash: text("input_hash").notNull(),
    locale: text("locale").notNull(),
    status: text("status")
      .$type<"RUNNING" | "GENERATED" | "READY" | "FAILED">()
      .notNull(),
    cost: integer("cost").notNull(),
    response: jsonb("response").$type<CoachPlanAdaptationDto>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ai_plan_previews_request_uq").on(t.userId, t.clientRequestId),
    index("ai_plan_previews_user_time_idx").on(t.userId, t.createdAt),
    pgPolicy("ai_plan_previews_service", {
      for: "all",
      using: sql`current_setting('app.role', true) = 'SERVICE'`,
      withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
    }),
  ],
).enableRLS();
