import { index, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

/** Short-lived aggregate budget holds. No prompt, response, user identifier or other PII. */
export const aiBudgetReservations = pgTable(
  "ai_budget_reservations",
  {
    id: uuid("id").primaryKey(),
    amountMicros: integer("amount_micros").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_budget_reservations_expires_idx").on(table.expiresAt)],
);
