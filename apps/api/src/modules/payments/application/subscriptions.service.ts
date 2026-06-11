import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  SubscriptionStatus,
  type CheckoutSession,
  type PlanDto,
  type SubscriptionDto,
  type SubscriptionView,
} from "@mentor/types";
import { DomainError, NotFoundError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation } from "../../../common/errors/postgres-error";
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

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly plansRepo: PlansRepository,
    private readonly subsRepo: SubscriptionsRepository,
    private readonly eventsRepo: PaymentEventsRepository,
    private readonly entitlement: EntitlementService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService<Env, true>,
    @Inject(PAYMENTS_PORT) private readonly provider: PaymentsPort,
    @Inject(INVOICE_PORT) private readonly invoices: InvoicePort,
  ) {}

  async listPlans(): Promise<PlanDto[]> {
    const rows = await this.plansRepo.findActive();
    return rows.map(toPlanDto);
  }

  async getView(userId: string, rolesHint?: string[]): Promise<SubscriptionView> {
    const sub = await this.subsRepo.findOpenForUser(userId);
    return {
      subscription: sub ? toSubscriptionDto(sub) : null,
      // EntitlementService owns the STAFF short-circuit + state machine.
      entitlement: await this.entitlement.getEntitlement(userId, rolesHint),
    };
  }

  /**
   * Start checkout (§7): one open subscription per user; trial only ONCE per user —
   * a returning (expired) subscriber re-subscribes without a trial.
   */
  async checkout(user: { id: string; email: string }, planId: string): Promise<CheckoutSession> {
    const plan = await this.plansRepo.findById(planId);
    if (!plan || !plan.isActive) throw new NotFoundError();

    const open = await this.subsRepo.findOpenForUser(user.id);
    if (open) throw new DomainError(ErrorCode.PAYMENT_ALREADY_SUBSCRIBED, HttpStatus.CONFLICT);

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

    try {
      // NOTE (review F2 — iyzico verification gate): with the FAKE provider checkout completes
      // instantly, so starting at TRIALING/ACTIVE here is correct. When the iyzico adapter is
      // verified, this must start as an INCOMPLETE row and only the provider's
      // checkout-completed webhook may activate it (an abandoned payment page must NOT
      // grant premium). Tracked in devnote 0015.
      await this.subsRepo.create({
        userId: user.id,
        planId: plan.id,
        status: withTrial ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
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

  /** Apply a verified, deduplicated provider event to the state machine. */
  async applyProviderEvent(event: ProviderEvent): Promise<void> {
    const sub = await this.subsRepo.findByProviderRef(event.providerRef);
    if (!sub) {
      // Unknown ref: log loudly; never 500 the provider (it would retry forever).
      this.logger.warn(`webhook for unknown providerRef=${event.providerRef} (${event.type})`);
      return;
    }
    const plan = await this.plansRepo.findById(sub.planId);

    switch (event.type) {
      case "trial_started": {
        await this.eventsRepo.appendTransaction({
          subscriptionId: sub.id,
          userId: sub.userId,
          type: TxType.TRIAL_START,
          amountMinor: 0,
          currency: plan?.currency ?? "TRY",
          status: TxStatus.SUCCEEDED,
          providerEventId: event.eventId,
        });
        return;
      }
      case "payment_succeeded": {
        const now = new Date();
        const periodEnd = addMonths(now, plan?.periodMonths ?? 1);
        await this.subsRepo.update(sub.id, {
          status: sub.cancelAtPeriodEnd ? SubscriptionStatus.CANCELED : SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        });
        await this.eventsRepo.appendTransaction({
          subscriptionId: sub.id,
          userId: sub.userId,
          type: TxType.RENEWAL,
          amountMinor: event.amountMinor ?? plan?.priceMinor ?? 0,
          currency: plan?.currency ?? "TRY",
          status: TxStatus.SUCCEEDED,
          providerEventId: event.eventId,
          raw: event,
        });
        await this.issueInvoiceSafely(sub, event, plan);
        this.events.emit(
          PaymentsEventTopic.SUBSCRIPTION_ACTIVATED,
          new SubscriptionActivated(sub.userId, sub.id, sub.planId),
        );
        return;
      }
      case "payment_failed": {
        await this.subsRepo.update(sub.id, { status: SubscriptionStatus.PAST_DUE });
        await this.eventsRepo.appendTransaction({
          subscriptionId: sub.id,
          userId: sub.userId,
          type: TxType.RENEWAL,
          amountMinor: event.amountMinor ?? plan?.priceMinor ?? 0,
          currency: plan?.currency ?? "TRY",
          status: TxStatus.FAILED,
          providerEventId: event.eventId,
          raw: event,
        });
        const base = sub.currentPeriodEnd ?? new Date();
        this.events.emit(
          PaymentsEventTopic.PAYMENT_FAILED,
          new PaymentFailed(sub.userId, sub.id, new Date(base.getTime() + GRACE_PERIOD_DAYS * DAY_MS)),
        );
        return;
      }
      case "subscription_canceled": {
        await this.subsRepo.update(sub.id, {
          status: SubscriptionStatus.EXPIRED,
          canceledAt: sub.canceledAt ?? new Date(),
        });
        this.events.emit(
          PaymentsEventTopic.SUBSCRIPTION_CANCELED,
          new SubscriptionCanceled(sub.userId, sub.id, false),
        );
        return;
      }
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

function toPlanDto(row: PlanRow): PlanDto {
  return {
    id: row.id,
    name: row.name,
    periodMonths: row.periodMonths,
    priceMinor: row.priceMinor,
    currency: row.currency as "TRY",
    trialDays: row.trialDays,
  };
}

function toSubscriptionDto(row: SubscriptionRow): SubscriptionDto {
  return {
    id: row.id,
    planId: row.planId,
    status: row.status as SubscriptionDto["status"],
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  };
}
