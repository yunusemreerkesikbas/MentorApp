import { randomUUID } from "node:crypto";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  SubscriptionStatus,
  type CheckoutSession,
  type EntitlementDto,
  type PlanDto,
  type SubscriptionDto,
  type SubscriptionView,
} from "@mentor/types";
import { DomainError, NotFoundError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { AdminUpdatePlanInput } from "@mentor/validation";
import { isUniqueViolation } from "../../../common/errors/postgres-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import type { Env } from "../../../config/env.validation";
import { INVOICE_PORT, type InvoicePort } from "../../../shared/ports/invoice.port";
import {
  PAYMENTS_PORT,
  type PaymentsPort,
  type ProviderEvent,
} from "../../../shared/ports/payments.port";
import { GRACE_PERIOD_DAYS, TxStatus, TxType } from "../domain/payments.constants";
import {
  PaymentFailed,
  PaymentRefunded,
  PaymentsEventTopic,
  SubscriptionActivated,
  SubscriptionCanceled,
} from "../domain/payments.events";
import {
  PaymentEventsRepository,
  PlansRepository,
  SubscriptionsRepository,
  type PlanRow,
  type SubscriptionRow,
} from "../infrastructure/payments.repositories";
import { EntitlementService } from "./entitlement.service";
import { FeaturePolicyService } from "./feature-policy.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A domain event to publish after the webhook transaction commits. */
interface DomainEmit {
  topic: string;
  payload: object;
}

/** Post-commit side-effects of a webhook apply (never run inside the tx → rollback emits nothing). */
export interface WebhookSideEffects {
  emits: DomainEmit[];
  invoice?: { sub: SubscriptionRow; event: ProviderEvent; plan: PlanRow | undefined };
}

/** One billing-ledger row as exposed to the admin (no raw provider payload). */
export interface PaymentTransactionDto {
  id: string;
  type: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface AdminPlanDto {
  id: string;
  name: string;
  periodMonths: number;
  priceMinor: number;
  currency: "TRY";
  trialDays: number;
  isActive: boolean;
}

/** Admin-facing subscription overview for a user (W6: read state + refund history). */
export interface AdminSubscriptionView {
  subscription: SubscriptionDto | null;
  plan: PlanDto | null;
  entitlement: EntitlementDto;
  transactions: PaymentTransactionDto[];
}

/** Result of an admin refund — the refreshed view + audit-relevant detail (L3). */
export interface RefundResult {
  view: AdminSubscriptionView;
  subscriptionId: string;
  amountMinor: number;
  remainingAfter: number;
}

/** Admin metrics: subscription + revenue snapshot (W6). Money in minor units (kuruş). */
export interface SubscriptionStats {
  byStatus: {
    trialing: number;
    active: number;
    pastDue: number;
    canceled: number;
    expired: number;
    total: number;
  };
  revenueMinor30d: number; // Σ successful renewals, last 30 days (trailing revenue, not normalized MRR)
  refundedMinor: number; // Σ refunds, last 30 days
  payingSubscriptions: number;
  /** payingSubscriptions / total subscriptions (honest "reached paid" ratio, not full trial funnel). */
  conversionRate: number;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly plansRepo: PlansRepository,
    private readonly subsRepo: SubscriptionsRepository,
    private readonly eventsRepo: PaymentEventsRepository,
    private readonly entitlement: EntitlementService,
    private readonly featurePolicy: FeaturePolicyService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService<Env, true>,
    @Inject(PAYMENTS_PORT) private readonly provider: PaymentsPort,
    @Inject(INVOICE_PORT) private readonly invoices: InvoicePort,
  ) {}

  async listPlans(): Promise<PlanDto[]> {
    const rows = await this.plansRepo.findActive();
    const purchaseEnabled = this.config.get("PAYMENTS_PROVIDER", { infer: true }) !== "disabled";
    return rows.map((row) => toPlanDto(row, purchaseEnabled));
  }

  async listAllPlans(): Promise<AdminPlanDto[]> {
    const rows = await this.plansRepo.findAll();
    return rows.map(toAdminPlanDto);
  }

  async getAdminPlan(id: string): Promise<AdminPlanDto> {
    const row = await this.plansRepo.findById(id);
    if (!row) throw new NotFoundError("Plan");
    return toAdminPlanDto(row);
  }

  async updatePlan(id: string, patch: AdminUpdatePlanInput): Promise<AdminPlanDto> {
    const existing = await this.plansRepo.findById(id);
    if (!existing) throw new NotFoundError("Plan");
    const updated = await this.plansRepo.update(id, patch);
    if (!updated) throw new NotFoundError("Plan");
    return toAdminPlanDto(updated);
  }

  async getView(userId: string, rolesHint?: string[]): Promise<SubscriptionView> {
    const [sub, entitlement, features] = await Promise.all([
      this.subsRepo.findOpenForUser(userId),
      this.entitlement.getEntitlement(userId, rolesHint),
      this.featurePolicy.listPolicies(),
    ]);
    return {
      subscription: sub ? toSubscriptionDto(sub) : null,
      entitlement,
      features,
    };
  }

  /**
   * Admin (W6): a user's subscription + entitlement + recent billing ledger (incl. refunds).
   * Read-only; consumed by the role-gated admin controller.
   */
  async getAdminView(userId: string): Promise<AdminSubscriptionView> {
    const view = await this.getView(userId);
    const plan = view.subscription
      ? await this.plansRepo.findById(view.subscription.planId)
      : undefined;
    const txs = await this.eventsRepo.listForUserAdmin(userId, 50);
    return {
      subscription: view.subscription,
      plan: plan
        ? toPlanDto(
            plan,
            this.config.get("PAYMENTS_PROVIDER", { infer: true }) !== "disabled",
          )
        : null,
      entitlement: view.entitlement,
      transactions: txs.map(toTxDto),
    };
  }

  /** Admin metrics (W6): subscription counts + 30-day revenue/refunds + conversion. Read-only. */
  async getSubscriptionStats(): Promise<SubscriptionStats> {
    const since30 = new Date(Date.now() - 30 * DAY_MS);
    const [byStatus, revenueMinor30d, refundedMinor, payingSubscriptions] = await Promise.all([
      this.subsRepo.countByStatus(),
      this.eventsRepo.sumRenewalSince(since30),
      this.eventsRepo.sumRefundedSince(since30),
      this.eventsRepo.countPayingSubscriptions(),
    ]);
    const conversionRate = byStatus.total > 0 ? payingSubscriptions / byStatus.total : 0;
    return { byStatus, revenueMinor30d, refundedMinor, payingSubscriptions, conversionRate };
  }

  /**
   * Admin (W6): refund of the user's last successful charge. Calls the provider refund API (fake:
   * deterministic no-op; iyzico: real refund) BEFORE appending a negative-amount REFUND row to the
   * append-only ledger (§3) — a provider failure aborts the record. Never touches the original
   * charge, and does NOT change entitlement (use {@link cancel} to end access). Capped to the
   * remaining refundable amount (last charge − prior refunds).
   */
  async refundLastCharge(
    userId: string,
    amountMinor: number,
    reason: string,
    actorId: string,
  ): Promise<RefundResult> {
    // Stable idempotency key for the whole refund: passed to the provider (dedupes retries) and
    // stored as the ledger providerEventId, so a retried refund maps to one provider operation.
    const idempotencyKey = `admin-refund:${randomUUID()}`;
    // Atomic: read → lock the subscription → re-read cap → provider refund → append, all in ONE
    // service tx. The FOR UPDATE lock serializes concurrent refunds on the same subscription so the
    // cap can't be raced (TOCTOU). The provider call sits inside the tx so its failure rolls back
    // the ledger row (admin-only, single-row lock, rare — an acceptable hold across the call).
    const result = await withServiceContext(this.db, async (tx) => {
      const charges = await this.eventsRepo.listForUserAdmin(userId, 200, tx);
      const lastCharge = charges.find(
        (t) => t.type === TxType.RENEWAL && t.status === TxStatus.SUCCEEDED && t.amountMinor > 0,
      );
      if (!lastCharge) {
        throw new DomainError(ErrorCode.PAYMENT_REFUND_NO_CHARGE, HttpStatus.CONFLICT, { userId });
      }

      const sub = await this.subsRepo.lockById(lastCharge.subscriptionId, tx);

      // Re-read AFTER acquiring the lock so a concurrent refund that committed first is counted.
      const locked = await this.eventsRepo.listForUserAdmin(userId, 200, tx);
      const refundedSoFar = locked
        .filter((t) => t.type === TxType.REFUND && t.subscriptionId === lastCharge.subscriptionId)
        .reduce((sum, t) => sum + Math.abs(t.amountMinor), 0);
      const remaining = lastCharge.amountMinor - refundedSoFar;
      if (amountMinor > remaining) {
        throw new DomainError(ErrorCode.PAYMENT_REFUND_EXCEEDS_CHARGE, HttpStatus.BAD_REQUEST, {
          amountMinor,
          remaining,
        });
      }

      // Move the money provider-side first; a provider error throws → tx rolls back, no ledger row.
      const providerRef = sub?.providerRef;
      const { refundRef } = providerRef
        ? await this.provider.refund(providerRef, amountMinor, idempotencyKey)
        : { refundRef: null };

      await this.eventsRepo.appendTransaction(
        {
          subscriptionId: lastCharge.subscriptionId,
          userId,
          type: TxType.REFUND,
          amountMinor: -amountMinor,
          currency: lastCharge.currency,
          status: TxStatus.REFUNDED,
          providerEventId: idempotencyKey,
          raw: { reason, actorId, refundRef },
        },
        tx,
      );

      return { subscriptionId: lastCharge.subscriptionId, remainingAfter: remaining - amountMinor };
    });

    // Post-commit (same discipline as webhook side-effects): a rolled-back refund emits nothing.
    this.events.emit(
      PaymentsEventTopic.PAYMENT_REFUNDED,
      new PaymentRefunded(userId, result.subscriptionId, amountMinor),
    );

    return {
      view: await this.getAdminView(userId),
      subscriptionId: result.subscriptionId,
      amountMinor,
      remainingAfter: result.remainingAfter,
    };
  }

  /**
   * Start checkout (§7): one open subscription per user; trial only ONCE per user —
   * a returning (expired) subscriber re-subscribes without a trial.
   */
  async checkout(user: { id: string; email: string }, planId: string): Promise<CheckoutSession> {
    if (this.config.get("PAYMENTS_PROVIDER", { infer: true }) === "disabled") {
      throw new DomainError(ErrorCode.PAYMENT_DISABLED, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const plan = await this.plansRepo.findById(planId);
    if (!plan || !plan.isActive) throw new NotFoundError();

    const open = await this.subsRepo.findOpenForUser(user.id);
    if (open) {
      // An abandoned, never-confirmed INCOMPLETE checkout must not lock the user out forever —
      // discard it and let this checkout proceed. Any granting status is a real open subscription.
      if (open.status === SubscriptionStatus.INCOMPLETE) {
        await this.subsRepo.deleteById(open.id);
      } else {
        throw new DomainError(ErrorCode.PAYMENT_ALREADY_SUBSCRIBED, HttpStatus.CONFLICT);
      }
    }

    const hadAny = await this.subsRepo.hasAnyForUser(user.id);
    const withTrial = !hadAny && plan.trialDays > 0;

    const appUrl = this.config.get("APP_URL", { infer: true });
    const { checkoutUrl, providerRef } = await this.provider.createCheckout({
      userId: user.id,
      userEmail: user.email,
      plan: {
        id: plan.id,
        priceMinor: plan.priceMinor,
        currency: plan.currency,
        periodMonths: plan.periodMonths,
        trialDays: withTrial ? plan.trialDays : 0,
      },
      returnUrl: `${appUrl}/abonelik/sonuc`,
    });

    const now = new Date();
    const trialEndsAt = withTrial ? new Date(now.getTime() + plan.trialDays * DAY_MS) : null;
    const periodEnd = withTrial ? trialEndsAt! : addMonths(now, plan.periodMonths);

    // Verification gate (§7): a provider with a hosted payment page (iyzico) creates an INCOMPLETE
    // row that grants NO premium until its checkout_completed webhook activates it — an abandoned
    // page must not grant access. The fake provider completes instantly, so it is granted its
    // status right away. INCOMPLETE still records the intended trial/period for the activation step.
    const initialStatus = this.provider.instantCheckout
      ? withTrial
        ? SubscriptionStatus.TRIALING
        : SubscriptionStatus.ACTIVE
      : SubscriptionStatus.INCOMPLETE;
    try {
      await this.subsRepo.create({
        userId: user.id,
        planId: plan.id,
        status: initialStatus,
        provider: this.provider.provider,
        providerRef,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
    } catch (err) {
      // Concurrent double-checkout hit the partial-unique index (one open sub per user)
      // → same stable code as the pre-check (review F3; mirrors the signup race fix).
      if (isUniqueViolation(err)) {
        throw new DomainError(ErrorCode.PAYMENT_ALREADY_SUBSCRIBED, HttpStatus.CONFLICT);
      }
      throw err;
    }

    return { checkoutUrl };
  }

  /** Self-serve cancel (§7): renewal stops; access until period end. Idempotent. */
  async cancel(userId: string, rolesHint?: string[]): Promise<SubscriptionView> {
    const sub = await this.subsRepo.findOpenForUser(userId);
    if (!sub) throw new NotFoundError();

    if (!sub.cancelAtPeriodEnd) {
      if (sub.providerRef) await this.provider.cancel(sub.providerRef);
      await this.subsRepo.update(sub.id, {
        status: SubscriptionStatus.CANCELED,
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      });
      this.events.emit(
        PaymentsEventTopic.SUBSCRIPTION_CANCELED,
        new SubscriptionCanceled(userId, sub.id, true),
      );
    }
    return this.getView(userId, rolesHint);
  }

  /**
   * Apply a verified, deduplicated provider event to the state machine within the
   * caller's transaction (`tx`). Side-effects that must NOT happen on rollback —
   * domain-event emits + invoice issuance — are returned for the caller to run AFTER
   * commit (see WebhookService), keeping the DB mutation atomic with the idempotency record.
   */
  async applyProviderEvent(event: ProviderEvent, tx: DatabaseTx): Promise<WebhookSideEffects> {
    const none: WebhookSideEffects = { emits: [] };
    const sub = await this.subsRepo.findByProviderRef(event.providerRef, tx);
    if (!sub) {
      // Unknown ref: log loudly; never 500 the provider (it would retry forever).
      this.logger.warn(`webhook for unknown providerRef=${event.providerRef} (${event.type})`);
      return none;
    }
    const plan = await this.plansRepo.findById(sub.planId, tx);

    switch (event.type) {
      case "checkout_completed": {
        // Verification gate: activate an INCOMPLETE row once the provider confirms the checkout.
        // Idempotent — a row that already advanced past INCOMPLETE is left untouched. The row's
        // trialEndsAt (set at checkout-init) decides trial vs paid activation.
        if (sub.status !== SubscriptionStatus.INCOMPLETE) return none;
        const isTrial = sub.trialEndsAt != null && sub.trialEndsAt.getTime() > Date.now();
        await this.subsRepo.update(
          sub.id,
          { status: isTrial ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE },
          tx,
        );
        return {
          emits: [
            {
              topic: PaymentsEventTopic.SUBSCRIPTION_ACTIVATED,
              payload: new SubscriptionActivated(sub.userId, sub.id, sub.planId),
            },
          ],
        };
      }
      case "trial_started": {
        await this.eventsRepo.appendTransaction(
          {
            subscriptionId: sub.id,
            userId: sub.userId,
            type: TxType.TRIAL_START,
            amountMinor: 0,
            currency: plan?.currency ?? "TRY",
            status: TxStatus.SUCCEEDED,
            providerEventId: event.eventId,
          },
          tx,
        );
        return none;
      }
      case "payment_succeeded": {
        const now = new Date();
        // Extend from the later of now / current period end so a late renewal webhook
        // never shortens already-paid time (review #2).
        const periodEnd = nextPeriodEnd(now, sub.currentPeriodEnd, plan?.periodMonths ?? 1);
        await this.subsRepo.update(
          sub.id,
          {
            status: sub.cancelAtPeriodEnd ? SubscriptionStatus.CANCELED : SubscriptionStatus.ACTIVE,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
          tx,
        );
        await this.eventsRepo.appendTransaction(
          {
            subscriptionId: sub.id,
            userId: sub.userId,
            type: TxType.RENEWAL,
            amountMinor: event.amountMinor ?? plan?.priceMinor ?? 0,
            currency: plan?.currency ?? "TRY",
            status: TxStatus.SUCCEEDED,
            providerEventId: event.eventId,
            raw: event,
          },
          tx,
        );
        return {
          emits: [
            {
              topic: PaymentsEventTopic.SUBSCRIPTION_ACTIVATED,
              payload: new SubscriptionActivated(sub.userId, sub.id, sub.planId),
            },
          ],
          invoice: { sub, event, plan },
        };
      }
      case "payment_failed": {
        await this.subsRepo.update(sub.id, { status: SubscriptionStatus.PAST_DUE }, tx);
        await this.eventsRepo.appendTransaction(
          {
            subscriptionId: sub.id,
            userId: sub.userId,
            type: TxType.RENEWAL,
            amountMinor: event.amountMinor ?? plan?.priceMinor ?? 0,
            currency: plan?.currency ?? "TRY",
            status: TxStatus.FAILED,
            providerEventId: event.eventId,
            raw: event,
          },
          tx,
        );
        const base = sub.currentPeriodEnd ?? new Date();
        return {
          emits: [
            {
              topic: PaymentsEventTopic.PAYMENT_FAILED,
              payload: new PaymentFailed(
                sub.userId,
                sub.id,
                new Date(base.getTime() + GRACE_PERIOD_DAYS * DAY_MS),
              ),
            },
          ],
        };
      }
      case "subscription_canceled": {
        await this.subsRepo.update(
          sub.id,
          {
            status: SubscriptionStatus.EXPIRED,
            canceledAt: sub.canceledAt ?? new Date(),
          },
          tx,
        );
        return {
          emits: [
            {
              topic: PaymentsEventTopic.SUBSCRIPTION_CANCELED,
              payload: new SubscriptionCanceled(sub.userId, sub.id, false),
            },
          ],
        };
      }
    }
    return none;
  }

  /** Run the post-commit side-effects returned by {@link applyProviderEvent}. */
  async runSideEffects(effects: WebhookSideEffects): Promise<void> {
    for (const e of effects.emits) this.events.emit(e.topic, e.payload);
    if (effects.invoice) {
      await this.issueInvoiceSafely(effects.invoice.sub, effects.invoice.event, effects.invoice.plan);
    }
  }

  /** Invoice failures must never break webhook processing (provider would retry). */
  private async issueInvoiceSafely(
    sub: SubscriptionRow,
    event: ProviderEvent,
    plan: PlanRow | undefined,
  ): Promise<void> {
    if (!event.amountMinor && !plan?.priceMinor) return; // nothing charged
    try {
      await this.invoices.issueForCharge({
        userId: sub.userId,
        userEmail: "", // resolved by the real integrator via identity lookup later
        amountMinor: event.amountMinor ?? plan?.priceMinor ?? 0,
        currency: plan?.currency ?? "TRY",
        description: plan?.name ?? sub.planId,
        providerEventId: event.eventId,
      });
    } catch (err) {
      this.logger.error(`invoice issue failed for evt=${event.eventId}: ${String(err)}`);
    }
  }
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Next period end for a renewal: extend from the LATER of `now` and the current period end,
 * so a late-arriving renewal webhook never shortens already-paid time (review #2). A first
 * charge (no prior period, or an expired one) extends from `now`.
 */
export function nextPeriodEnd(now: Date, currentPeriodEnd: Date | null, months: number): Date {
  const base = currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime() ? currentPeriodEnd : now;
  return addMonths(base, months);
}

function toPlanDto(row: PlanRow, purchaseEnabled: boolean): PlanDto {
  return {
    id: row.id,
    name: row.name,
    periodMonths: row.periodMonths,
    priceMinor: row.priceMinor,
    currency: row.currency as "TRY",
    trialDays: row.trialDays,
    purchaseEnabled,
  };
}

function toAdminPlanDto(row: PlanRow): AdminPlanDto {
  return {
    id: row.id,
    name: row.name,
    periodMonths: row.periodMonths,
    priceMinor: row.priceMinor,
    currency: row.currency as "TRY",
    trialDays: row.trialDays,
    isActive: row.isActive,
  };
}

function toTxDto(
  row: Awaited<ReturnType<PaymentEventsRepository["listForUserAdmin"]>>[number],
): PaymentTransactionDto {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSubscriptionDto(row: SubscriptionRow): SubscriptionDto {
  return {
    id: row.id,
    planId: row.planId,
    status: row.status as SubscriptionDto["status"],
    startedAt: row.createdAt.toISOString(),
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    currentPeriodStart: row.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  };
}
