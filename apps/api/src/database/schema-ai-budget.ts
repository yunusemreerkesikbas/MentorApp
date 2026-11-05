import { sql } from "drizzle-orm";
import { index, integer, pgPolicy, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

/** Short-lived aggregate budget holds. No prompt, response, user identifier or other PII. */
export const aiBudgetReservations = pgTable(
  "ai_budget_reservations",
  {
    id: uuid("id").primaryKey(),
    amountMicros: integer("amount_micros").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_budget_reservations_expires_idx").on(table.expiresAt),
    pgPolicy("ai_budget_reservations_service", {
      for: "all",
      using: sql`current_setting('app.role', true) = 'SERVICE'`,
      withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
    }),
  ],
).enableRLS();
