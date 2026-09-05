import { randomUUID } from "node:crypto";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  SUBSCRIPTION_PROVIDER_SPONSOR,
  SubscriptionStatus,
  type CheckoutSession,
  type EntitlementDto,
  type PlanDto,
  type PromotionIneligibleReason,
  type PromotionOfferView,
  type PromotionOffersView,
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
import {
  PromotionsService,
  toOfferView,
  type PromotionUserContext,
  type ResolvedOffer,
} from "../../promotions/application/promotions.service";
import { StreakService } from "../../coaching/application/streak.service";
import { EntitlementService, hasLostAccess } from "./entitlement.service";
import { FeaturePolicyService } from "./feature-policy.service";

/** Identity-owned fields the promotion rules need; the controller crosses that seam, not us. */
export interface CheckoutUser {
  id: string;
  email: string;
  createdAt: Date;
  orgId?: string | null;
}

/** A code the user typed that did not stick must fail loudly, never fall back to the list price. */
const PROMOTION_ERROR_BY_REASON: Partial<Record<PromotionIneligibleReason, ErrorCode>> = {
  DISABLED: ErrorCode.PROMOTION_DISABLED,
  NOT_FOUND: ErrorCode.PROMOTION_NOT_FOUND,
  EXPIRED: ErrorCode.PROMOTION_EXPIRED,
  EXHAUSTED: ErrorCode.PROMOTION_EXHAUSTED,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** A domain event to publish after the webhook transaction commits. */
interface DomainEmit {
  topic: string;
  payload: object;
}

/** Post-commit side-effects of a webhook apply (never run inside the tx → rollback emits nothing). */
export interface WebhookSideEffects {
  emits: DomainEmit[];
  invoice?: {
    sub: SubscriptionRow;
    event: ProviderEvent;
    plan: PlanRow | undefined;
    /** Price agreed at checkout — the invoice must show what was charged, not the list price. */
    expectedMinor: number;
  };
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
    private readonly promotions: PromotionsService,
    private readonly streaks: StreakService,
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
    // Depends on `sub`, so it cannot join the Promise.all above.
    const redemption = sub ? await this.promotions.findActiveForSubscription(sub.id) : undefined;
    return {
      subscription: sub ? toSubscriptionDto(sub) : null,
      entitlement,
      features,
      discount: redemption
        ? {
            listPriceMinor: redemption.listPriceMinor,
            discountMinor: redemption.discountMinor,
            chargedPriceMinor: redemption.chargedPriceMinor,
            periodsRemaining: redemption.periodsRemaining,
          }
        : null,
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
  /** Build the signals promotion rules read. Every one is payments- or identity-owned. */
  private async promotionContext(
    user: CheckoutUser,
    hadAnySubscription: boolean,
    latest: SubscriptionRow | undefined,
  ): Promise<PromotionUserContext> {
    return {
      userId: user.id,
      orgId: user.orgId ?? null,
      userCreatedAt: user.createdAt,
      hadAnySubscription,
      // DERIVED, not `latest.status`: nothing writes EXPIRED except the provider's cancel webhook,
      // so a subscription that simply lapsed still reads ACTIVE and the raw status would miss
      // exactly the users WIN_BACK exists for. `hasRunOut` is the same rule the sweeper uses.
      lostPremiumAccess: hasLostAccess(latest ?? null, new Date()),
    };
  }

  /**
   * Studied days for an ACTIVE_DAYS rule. Passed as a thunk so it only runs when a live rule needs
   * it — most checkouts never touch coaching at all. `daily_activity` is coaching-owned, so this
   * goes through its public service; payments never queries that table.
   */
  private activeDatesSupplier(userId: string) {
    return (windowDays: number) => this.streaks.listActiveDatesSince(userId, windowDays);
  }

  /**
   * A code the user typed that did not stick is an error, not a silent fallback to the list price —
   * on the preview AND at checkout, so the message they see while typing is the one that would
   * have stopped the purchase. Localized by the API; the client just displays it.
   */
  private rejectCode(reason: PromotionIneligibleReason | null): never {
    throw new DomainError(
      (reason && PROMOTION_ERROR_BY_REASON[reason]) ?? ErrorCode.PROMOTION_NOT_ELIGIBLE,
      HttpStatus.UNPROCESSABLE_ENTITY,
      reason ? { reason } : undefined,
    );
  }

  /** Per-plan price after promotions. Advisory: checkout re-resolves and re-checks under locks. */
  async resolveOffers(
    user: CheckoutUser,
    code?: string,
    locale?: string,
  ): Promise<PromotionOffersView> {
    const [planRows, hadAny, latest] = await Promise.all([
      this.plansRepo.findActive(),
      this.subsRepo.hasAnyForUser(user.id),
      this.subsRepo.findLatestForUser(user.id),
    ]);
    const resolved = await this.promotions.resolveOffers({
      context: await this.promotionContext(user, hadAny, latest),
      plans: planRows.map((row) => ({ id: row.id, name: row.name, priceMinor: row.priceMinor })),
      activeDates: this.activeDatesSupplier(user.id),
      code,
      locale,
    });
    const entries = Object.values(resolved.offers);
    if (code && !entries.some((offer) => offer.promotionId)) {
      this.rejectCode(entries[0]?.reason ?? null);
    }
    const offers: PromotionOffersView["offers"] = {};
    for (const [planId, offer] of Object.entries(resolved.offers)) {
      offers[planId] = toOfferView(offer);
    }
    return { offers, available: resolved.available };
  }

  /**
   * The best discount a lapsed subscriber would get by coming back now, or null.
   *
   * Narrow seam for the win-back notification: a listener must not have to assemble a checkout
   * context. Returns null unless the user genuinely lost access AND a promotion applies, so the
   * caller can stay silent rather than send a commercial message with nothing behind it.
   */
  async findWinBackOffer(userId: string): Promise<PromotionOfferView | null> {
    const [planRows, latest] = await Promise.all([
      this.plansRepo.findActive(),
      this.subsRepo.findLatestForUser(userId),
    ]);
    // hasLostAccess, not hasRunOut: by the time the win-back event fires the row is already
    // EXPIRED, which the sweeper's narrower predicate deliberately ignores.
    if (!latest || !hasLostAccess(latest, new Date())) return null;

    const resolved = await this.promotions.resolveOffers({
      context: {
        userId,
        orgId: null,
        // A lapsed subscriber can never satisfy NEW_USER — `hadAnySubscription` short-circuits it —
        // so the exact signup date cannot change the outcome and we skip the identity round trip.
        userCreatedAt: latest.createdAt,
        hadAnySubscription: true,
        lostPremiumAccess: true,
      },
      plans: planRows.map((row) => ({ id: row.id, name: row.name, priceMinor: row.priceMinor })),
      activeDates: this.activeDatesSupplier(userId),
    });

    let best: ResolvedOffer | null = null;
    for (const offer of Object.values(resolved.offers)) {
      if (!offer.promotionId || offer.discountMinor <= 0) continue;
      if (!best || offer.discountMinor > best.discountMinor) best = offer;
    }
    return best ? toOfferView(best) : null;
  }

  async checkout(
    user: CheckoutUser,
    planId: string,
    code?: string,
  ): Promise<CheckoutSession> {
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
        // Release the promotion seat that abandoned checkout was holding before the row goes.
        await this.promotions.voidForSubscription(open.id);
        await this.subsRepo.deleteById(open.id);
      } else if (open.provider === SUBSCRIPTION_PROVIDER_SPONSOR) {
        // A coach's seat must never stand between a student and their own subscription. The
        // student did not choose the seat and may lose it whenever the coach ends the link, so
        // "you already have a subscription" would be both untrue and a trap. Retire it and let
        // the purchase through — the seat's own revoke path is then a no-op (nothing open left).
        await this.subsRepo.expireSponsorship(open.id, new Date());
      } else {
        throw new DomainError(ErrorCode.PAYMENT_ALREADY_SUBSCRIBED, HttpStatus.CONFLICT);
      }
    }

    const hadAny = await this.subsRepo.hasAnyForUser(user.id);
    const withTrial = !hadAny && plan.trialDays > 0;

    const latest = await this.subsRepo.findLatestForUser(user.id);
    const offers = await this.promotions.resolveOffers({
      context: await this.promotionContext(user, hadAny, latest),
      plans: [{ id: plan.id, name: plan.name, priceMinor: plan.priceMinor }],
      activeDates: this.activeDatesSupplier(user.id),
      code,
    });
    const offer = offers.offers[plan.id]!;
    // Silently charging the list price after the user asked for a specific code would break the
    // pre-purchase disclosure they are about to consent to.
    if (code && !offer.promotionId) this.rejectCode(offer.reason);

    const appUrl = this.config.get("APP_URL", { infer: true });
    const { checkoutUrl, providerRef } = await this.provider.createCheckout({
      userId: user.id,
      userEmail: user.email,
      plan: {
        id: plan.id,
        priceMinor: plan.priceMinor,
        chargeAmountMinor: offer.chargedPriceMinor,
        renewalAmountMinor: offer.renewalPriceMinor,
        discountPeriods: offer.summary?.appliesToPeriods ?? 0,
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
      // One commit: a redemption without a subscription would hold a promotion seat forever, and a
      // subscription without one would renew at the list price the user never agreed to.
      // The provider call above stays OUTSIDE — external HTTP must never run inside a transaction.
      await withServiceContext(this.db, async (tx) => {
        const sub = await this.subsRepo.create(
          {
            userId: user.id,
            planId: plan.id,
            status: initialStatus,
            provider: this.provider.provider,
            providerRef,
            trialEndsAt,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
          tx,
        );
        await this.promotions.reserve({
          tx,
          offer,
          userId: user.id,
          orgId: user.orgId ?? null,
          subscriptionId: sub.id,
        });
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
        // The discount stops being provisional once the provider confirms the checkout.
        await this.promotions.markApplied(sub.id, tx);
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
        // The price frozen at checkout — NOT plan.priceMinor, which the admin may have edited
        // since, and which on a discounted subscription would overstate both the append-only
        // ledger (and every revenue stat derived from it) and the e-Arşiv invoice.
        const redemption = await this.promotions.findActiveForSubscription(sub.id, tx);
        const expectedMinor = redemption?.chargedPriceMinor ?? plan?.priceMinor ?? 0;
        await this.eventsRepo.appendTransaction(
          {
            subscriptionId: sub.id,
            userId: sub.userId,
            type: TxType.RENEWAL,
            amountMinor: event.amountMinor ?? expectedMinor,
            currency: plan?.currency ?? "TRY",
            status: TxStatus.SUCCEEDED,
            providerEventId: event.eventId,
            raw: event,
          },
          tx,
        );
        // Burn one covered charge; at zero the next renewal falls back to the list price.
        // Guarded inside the repository, so a replayed webhook cannot double-decrement.
        if (redemption) await this.promotions.consumePeriod(sub.id, tx);
        return {
          emits: [
            {
              topic: PaymentsEventTopic.SUBSCRIPTION_ACTIVATED,
              payload: new SubscriptionActivated(sub.userId, sub.id, sub.planId),
            },
          ],
          invoice: { sub, event, plan, expectedMinor },
        };
      }
      case "payment_failed": {
        await this.subsRepo.update(sub.id, { status: SubscriptionStatus.PAST_DUE }, tx);
        // A failed charge does NOT consume a discount period — only a succeeded one does.
        const failedFor = await this.promotions.findActiveForSubscription(sub.id, tx);
        await this.eventsRepo.appendTransaction(
          {
            subscriptionId: sub.id,
            userId: sub.userId,
            type: TxType.RENEWAL,
            amountMinor:
              event.amountMinor ?? failedFor?.chargedPriceMinor ?? plan?.priceMinor ?? 0,
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
      await this.issueInvoiceSafely(
        effects.invoice.sub,
        effects.invoice.event,
        effects.invoice.plan,
        effects.invoice.expectedMinor,
      );
    }
  }

  /** Invoice failures must never break webhook processing (provider would retry). */
  private async issueInvoiceSafely(
    sub: SubscriptionRow,
    event: ProviderEvent,
    plan: PlanRow | undefined,
    expectedMinor: number,
  ): Promise<void> {
    const amountMinor = event.amountMinor ?? expectedMinor;
    // `expectedMinor` is floored by MIN_CHARGE_MINOR on any discounted subscription, so a
    // promotion can never make this branch swallow an invoice that is legally required.
    if (!amountMinor) return; // nothing charged
    try {
      await this.invoices.issueForCharge({
        userId: sub.userId,
        userEmail: "", // resolved by the real integrator via identity lookup later
        amountMinor,
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
    sponsored: row.provider === SUBSCRIPTION_PROVIDER_SPONSOR,
  };
}
