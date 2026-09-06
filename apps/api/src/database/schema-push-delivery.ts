import { sql } from "drizzle-orm";
import { check, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

/** Per-endpoint retry claims; external delivery occurs after the claim transaction commits. */
export const pushDeliveryClaims = pgTable("push_delivery_claims", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  template: text("template").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  endpointHash: text("endpoint_hash").notNull(),
  status: text("status").$type<"PENDING" | "DELIVERED">().notNull().default("PENDING"),
  claimToken: uuid("claim_token").notNull(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }).notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("push_delivery_claims_dedupe_idx").on(t.userId, t.template, t.dedupeKey, t.endpointHash),
  check("push_delivery_claims_status_check", sql`${t.status} in ('PENDING', 'DELIVERED')`),
  pgPolicy("push_delivery_claims_owner", {
    for: "all",
    using: sql`${t.userId}::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE'`,
    withCheck: sql`${t.userId}::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE'`,
  }),
]).enableRLS();
