import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const serviceOnly = () => pgPolicy("storage_service_only", {
  for: "all",
  using: sql`current_setting('app.role', true) = 'SERVICE'`,
  withCheck: sql`current_setting('app.role', true) = 'SERVICE'`,
});

/** One durable allowance per application database, never per process or deployment name. */
export const storageBudgetState = pgTable("storage_budget_state", {
  id: integer("id").primaryKey().default(1),
  scopeFingerprint: text("scope_fingerprint"),
  activeInitializationId: uuid("active_initialization_id"),
  status: text("status").notNull().default("UNINITIALIZED"),
  storedBytes: bigint("stored_bytes", { mode: "number" }).notNull().default(0),
  /** Null preserves unknown usage when upgrading an already-used bounded scope. */
  transferBytes: bigint("transfer_bytes", { mode: "number" }),
  classA: integer("class_a").notNull().default(0),
  classB: integer("class_b").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("storage_budget_singleton", sql`${t.id} = 1`),
  check("storage_budget_status", sql`${t.status} in ('UNINITIALIZED', 'VERIFYING', 'READY', 'BLOCKED')`),
  check("storage_budget_nonnegative", sql`${t.storedBytes} >= 0 and ${t.classA} >= 0 and ${t.classB} >= 0`),
  check("storage_transfer_nonnegative", sql`${t.transferBytes} >= 0`),
  serviceOnly(),
]).enableRLS();

/** Original charges are immutable; each pending attempt is finalized at most once. */
export const storageReservations = pgTable("storage_reservations", {
  id: uuid("id").primaryKey(),
  kind: text("kind").notNull(),
  initializationId: uuid("initialization_id"),
  key: text("storage_key"),
  reservedBytes: integer("reserved_bytes").notNull().default(0),
  reservedTransferBytes: bigint("reserved_transfer_bytes", { mode: "number" }),
  classA: integer("class_a").notNull().default(0),
  classB: integer("class_b").notNull().default(0),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
}, (t) => [
  index("storage_reservations_key_idx").on(t.key),
  index("storage_reservations_initialization_idx").on(t.initializationId),
  check("storage_reservation_kind", sql`${t.kind} in ('put', 'copy', 'read', 'list', 'delete', 'initialization')`),
  check("storage_reservation_status", sql`${t.status} in ('PENDING', 'SUCCEEDED', 'UNCERTAIN')`),
  check("storage_reservation_charges", sql`${t.reservedBytes} >= 0 and ${t.classA} >= 0 and ${t.classB} >= 0`),
  check("storage_reservation_transfer_nonnegative", sql`${t.reservedTransferBytes} >= 0`),
  serviceOnly(),
]).enableRLS();

/** Tombstones remain: reusing an old key could race a delayed write or deletion. */
export const storageObjectManifest = pgTable("storage_object_manifest", {
  key: text("storage_key").primaryKey(),
  bytes: integer("bytes").notNull(),
  contentType: text("content_type").notNull(),
  status: text("status").notNull().default("PENDING"),
  writeReservationId: uuid("write_reservation_id").notNull().references(() => storageReservations.id),
  deletionSeen: boolean("deletion_seen").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("storage_manifest_positive_bytes", sql`${t.bytes} > 0`),
  check("storage_manifest_status", sql`${t.status} in ('PENDING', 'CONFIRMED', 'UNCERTAIN', 'DELETED')`),
  serviceOnly(),
]).enableRLS();
