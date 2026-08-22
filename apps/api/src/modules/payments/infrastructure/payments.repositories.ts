import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, notInArray, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { paymentTransactions, paymentWebhookEvents, plans, subscriptions } from "../../../database/schema";
import { SubscriptionStatus } from "@mentor/types";
import type { TxStatus, TxType } from "../domain/payments.constants";

export type PlanRow = typeof plans.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;

/**
 * Webhook-path methods accept an optional caller transaction so record + state-apply +
 * ledger run atomically in ONE service-context tx (see WebhookService). Without a `tx`,
 * each method opens its own `withServiceContext` as before (other callers unchanged).
 */
type Exec = DatabaseTx;
function onServiceTx<T>(
  db: Database,
  tx: Exec | undefined,
  fn: (tx: Exec) => Promise<T>,
): Promise<T> {
  return tx ? fn(tx) : withServiceContext(db, fn);
}

const TERMINAL = [SubscriptionStatus.EXPIRED];

@Injectable()
export class PlansRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Public catalog — the `plans` table has no RLS. */
  async findActive(): Promise<PlanRow[]> {
    return this.db.select().from(plans).where(eq(plans.isActive, true));
  }

  /** `plans` has no RLS → reads via the caller tx (webhook path) or the pool directly. */
  async findById(id: string, tx?: Exec): Promise<PlanRow | undefined> {
    const exec = tx ?? this.db;
    const rows = await exec.select().from(plans).where(eq(plans.id, id)).limit(1);
    return rows[0];
  }

  async findAll(): Promise<PlanRow[]> {
    return this.db.select().from(plans);
  }

  async update(
    id: string,
    patch: {
      name?: string;
      priceMinor?: number;
      trialDays?: number;
      isActive?: boolean;
    },
  ): Promise<PlanRow | undefined> {
    const rows = await this.db
      .update(plans)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(plans.id, id))
      .returning();
    return rows[0];
  }
}

@Injectable()
export class SubscriptionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The user's single non-terminal subscription (partial-unique enforced in DB). */
  async findOpenForUser(userId: string): Promise<SubscriptionRow | undefined> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, userId), notInArray(subscriptions.status, TERMINAL)))
        .limit(1);
      return rows[0];
    });
  }

  /** Trial-once rule (§7): has this user EVER had a subscription row? */
  async hasAnyForUser(userId: string): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
      return rows.length > 0;
    });
  }

  async findByProviderRef(providerRef: string, tx?: Exec): Promise<SubscriptionRow | undefined> {
    return onServiceTx(this.db, tx, async (exec) => {
      const rows = await exec
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.providerRef, providerRef))
        .limit(1);
      return rows[0];
    });
  }

  async create(data: typeof subscriptions.$inferInsert): Promise<SubscriptionRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.insert(subscriptions).values(data).returning();
      return rows[0]!;
    });
  }

  /**
   * Hard-delete a subscription row. Used ONLY to discard an abandoned, never-confirmed INCOMPLETE
   * checkout so the user can retry — a deleted (vs expired) row also keeps trial-once intact, since
   * an unpaid checkout never consumed the trial.
   */
  async deleteById(id: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(subscriptions).where(eq(subscriptions.id, id));
    });
  }

  async update(
    id: string,
    patch: Partial<typeof subscriptions.$inferInsert>,
    tx?: Exec,
  ): Promise<SubscriptionRow | undefined> {
    return onServiceTx(this.db, tx, async (exec) => {
      const rows = await exec
        .update(subscriptions)
        .set(patch)
        .where(eq(subscriptions.id, id))
        .returning();
      return rows[0];
    });
  }

  /**
   * Row-lock a subscription for the duration of the caller tx (`SELECT … FOR UPDATE`).
   * Serializes concurrent admin refunds on the same subscription so the cap can't be raced.
   */
  async lockById(id: string, tx: Exec): Promise<SubscriptionRow | undefined> {
    const rows = await tx.select().from(subscriptions).where(eq(subscriptions.id, id)).for("update");
    return rows[0];
  }

  /** Admin metrics (W6) — subscription counts by status, single scan (SERVICE context). */
  async countByStatus(): Promise<{
    trialing: number;
    active: number;
    pastDue: number;
    canceled: number;
    expired: number;
    total: number;
  }> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          trialing: sql<number>`count(*) filter (where ${subscriptions.status} = 'TRIALING')::int`,
          active: sql<number>`count(*) filter (where ${subscriptions.status} = 'ACTIVE')::int`,
          pastDue: sql<number>`count(*) filter (where ${subscriptions.status} = 'PAST_DUE')::int`,
          canceled: sql<number>`count(*) filter (where ${subscriptions.status} = 'CANCELED')::int`,
          expired: sql<number>`count(*) filter (where ${subscriptions.status} = 'EXPIRED')::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(subscriptions);
      return rows[0]!;
    });
  }
}

@Injectable()
export class PaymentEventsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Idempotency belt: record the webhook event; returns false when (provider,eventId)
   * was already processed (ON CONFLICT DO NOTHING → no row returned).
   */
  async recordWebhookOnce(
    input: {
      provider: string;
      eventId: string;
      type: string;
      payload: unknown;
    },
    tx?: Exec,
  ): Promise<boolean> {
    return onServiceTx(this.db, tx, async (exec) => {
      const rows = await exec
        .insert(paymentWebhookEvents)
        .values({
          provider: input.provider,
          eventId: input.eventId,
          type: input.type,
          payload: input.payload as object,
        })
        .onConflictDoNothing()
        .returning({ id: paymentWebhookEvents.id });
      return rows.length > 0;
    });
  }

  /** Append-only charge ledger (never updated, never deleted — §3). */
  async appendTransaction(
    input: {
      subscriptionId: string;
      userId: string;
      type: TxType;
      amountMinor: number;
      currency: string;
      status: TxStatus;
      providerEventId: string;
      raw?: unknown;
    },
    tx?: Exec,
  ): Promise<void> {
    await onServiceTx(this.db, tx, async (exec) => {
      await exec
        .insert(paymentTransactions)
        .values({ ...input, raw: (input.raw ?? {}) as object })
        .onConflictDoNothing(); // providerEventId unique → replayed charge is a no-op
    });
  }

  /** Self-read for the user's billing history (W6 admin uses SERVICE context later). */
  async listForUser(userId: string) {
    return withUserContext(this.db, { userId }, async (tx) =>
      tx
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.userId, userId))
        .orderBy(desc(paymentTransactions.createdAt)),
    );
  }

  /**
   * Admin cross-user read of a user's billing history (SERVICE context; role-gated controller).
   * Accepts a caller tx so the refund use-case can read + cap + append atomically (one tx).
   */
  async listForUserAdmin(userId: string, limit = 50, tx?: Exec) {
    return onServiceTx(this.db, tx, async (exec) =>
      exec
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.userId, userId))
        .orderBy(desc(paymentTransactions.createdAt))
        .limit(limit),
    );
  }

  /** Admin metrics (W6) — Σ successful renewal revenue since `since` (minor units). SERVICE ctx. */
  async sumRenewalSince(since: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ total: sql<number>`coalesce(sum(${paymentTransactions.amountMinor}), 0)::int` })
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.type, "RENEWAL"),
            eq(paymentTransactions.status, "SUCCEEDED"),
            gte(paymentTransactions.createdAt, since),
          ),
        );
      return rows[0]?.total ?? 0;
    });
  }

  /** Admin metrics (W6) — Σ refunded amount since `since` (positive minor units). SERVICE ctx. */
  async sumRefundedSince(since: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          total: sql<number>`coalesce(sum(abs(${paymentTransactions.amountMinor})), 0)::int`,
        })
        .from(paymentTransactions)
        .where(and(eq(paymentTransactions.type, "REFUND"), gte(paymentTransactions.createdAt, since)));
      return rows[0]?.total ?? 0;
    });
  }

  /** Admin metrics (W6) — distinct subscriptions that have ever had a successful charge. SERVICE ctx. */
  async countPayingSubscriptions(): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ n: sql<number>`count(distinct ${paymentTransactions.subscriptionId})::int` })
        .from(paymentTransactions)
        .where(and(eq(paymentTransactions.type, "RENEWAL"), eq(paymentTransactions.status, "SUCCEEDED")));
      return rows[0]?.n ?? 0;
    });
  }
}
