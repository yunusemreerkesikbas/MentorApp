import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { paymentTransactions, paymentWebhookEvents, plans, subscriptions } from "../../../database/schema";
import { SubscriptionStatus } from "@mentor/types";
import type { TxStatus, TxType } from "../domain/payments.constants";

export type PlanRow = typeof plans.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;

const TERMINAL = [SubscriptionStatus.EXPIRED];

@Injectable()
export class PlansRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Public catalog — the `plans` table has no RLS. */
  async findActive(): Promise<PlanRow[]> {
    return this.db.select().from(plans).where(eq(plans.isActive, true));
  }

  async findById(id: string): Promise<PlanRow | undefined> {
    const rows = await this.db.select().from(plans).where(eq(plans.id, id)).limit(1);
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

  async findByProviderRef(providerRef: string): Promise<SubscriptionRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
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

  async update(
    id: string,
    patch: Partial<typeof subscriptions.$inferInsert>,
  ): Promise<SubscriptionRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(subscriptions)
        .set(patch)
        .where(eq(subscriptions.id, id))
        .returning();
      return rows[0];
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
  async recordWebhookOnce(input: {
    provider: string;
    eventId: string;
    type: string;
    payload: unknown;
  }): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
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

  /** Crash-safety rollback of the idempotency record when applying the event failed (F1). */
  async deleteWebhookRecord(provider: string, eventId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .delete(paymentWebhookEvents)
        .where(
          and(eq(paymentWebhookEvents.provider, provider), eq(paymentWebhookEvents.eventId, eventId)),
        );
    });
  }

  /** Append-only charge ledger (never updated, never deleted — §3). */
  async appendTransaction(input: {
    subscriptionId: string;
    userId: string;
    type: TxType;
    amountMinor: number;
    currency: string;
    status: TxStatus;
    providerEventId: string;
    raw?: unknown;
  }): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
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
}
