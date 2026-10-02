import { sql } from "drizzle-orm";
import { check, index, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { plans, subscriptions, users } from "./schema";

/** Payments owns trial abuse prevention. Keyed fingerprints survive identity erasure. */
export const phoneTrialClaims = pgTable("phone_trial_claims", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneFingerprint: text("phone_fingerprint").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  planId: text("plan_id").notNull().references(() => plans.id),
  code: text("code"),
  status: text("status").notNull().default("PENDING"),
  providerRef: text("provider_ref"),
  checkoutUrl: text("checkout_url"),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("phone_trial_claims_fingerprint_unique").on(t.phoneFingerprint),
  uniqueIndex("phone_trial_claims_pending_user_unique").on(t.userId).where(sql`${t.status} = 'PENDING'`),
  uniqueIndex("phone_trial_claims_subscription_unique").on(t.subscriptionId),
  index("phone_trial_claims_expiry_idx").on(t.expiresAt),
  check("phone_trial_claims_status_check", sql`${t.status} in ('PENDING', 'CONSUMED')`),
  check("phone_trial_claims_expiry_check", sql`(${t.status} = 'PENDING' and ${t.expiresAt} is null and ${t.consumedAt} is null) or (${t.status} = 'CONSUMED' and ${t.expiresAt} is not null and ${t.consumedAt} is not null)`),
  pgPolicy("phone_trial_claims_service", {
    for: "all",
    using: sql`current_setting('app.role', true) = 'SERVICE'`,
    withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
  }),
]).enableRLS();
