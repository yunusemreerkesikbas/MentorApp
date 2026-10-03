import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SUBSCRIPTION_PROVIDER_SPONSOR, SubscriptionStatus, type CheckoutSession } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation, uniqueConstraint } from "../../../common/errors/postgres-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { PAYMENTS_PORT, type PaymentsPort } from "../../../shared/ports/payments.port";
import { UsersService } from "../../identity/application/users.service";
import { PromotionsService, type ResolvedOffer } from "../../promotions/application/promotions.service";
import { CheckoutRejectedError } from "../domain/checkout-rejected.error";
import { PaymentsEventTopic, SubscriptionExpired } from "../domain/payments.events";
import { SubscriptionsRepository, type PlanRow, type SubscriptionRow } from "../infrastructure/payments.repositories";
import { PhoneTrialService } from "./phone-trial.service";
import type { CheckoutUser } from "./subscriptions.service";

interface CheckoutInput {
  user: CheckoutUser;
  plan: PlanRow;
  offer: ResolvedOffer;
  withTrial: boolean;
  useTrial?: boolean;
  code?: string;
  returnUrl: string;
}

/** Reserve both paid and trial intent under the same Identity lock, before external HTTP. */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly subscriptions: SubscriptionsRepository,
    private readonly promotions: PromotionsService,
    private readonly trials: PhoneTrialService,
    @Inject(PAYMENTS_PORT) private readonly provider: PaymentsPort,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  async resume(userId: string, plan: PlanRow, code?: string, useTrial?: boolean): Promise<CheckoutSession | null> {
    return withServiceContext(this.db, async (tx) => {
      if (!(await this.users.lockActiveAccount(userId, tx))) this.pending();
      const trial = await this.trials.resume(userId, plan.id, code, useTrial, tx);
      if (trial) return trial;
      const sub = await this.subscriptions.findOpenForUser(userId, tx);
      return sub?.status === SubscriptionStatus.INCOMPLETE ? this.resumeSubscription(sub, plan.id, code, useTrial) : null;
    });
  }

  async start(input: CheckoutInput): Promise<CheckoutSession> {
    const reserved = await this.reserve(input);
    if ("checkoutUrl" in reserved) return reserved;
    const { sub, claimId } = reserved;
    const { user, plan, offer, returnUrl, withTrial } = input;
    let result: Awaited<ReturnType<PaymentsPort["createCheckout"]>>;
    try {
      result = await this.provider.createCheckout({
        userId: user.id, userEmail: user.email,
        plan: { id: plan.id, priceMinor: plan.priceMinor, chargeAmountMinor: offer.chargedPriceMinor,
          renewalAmountMinor: offer.renewalPriceMinor, discountPeriods: offer.summary?.appliesToPeriods ?? 0,
          currency: plan.currency, periodMonths: plan.periodMonths, trialDays: withTrial ? plan.trialDays : 0 },
        returnUrl,
      });
    } catch (error) {
      if (error instanceof CheckoutRejectedError) {
        const removed = await withServiceContext(this.db, async (tx) => {
          // A signed activation may arrive while the request is in flight. Never discard it.
          const current = await this.subscriptions.lockById(sub.id, tx);
          if (current?.status !== SubscriptionStatus.INCOMPLETE) return false;
          await this.promotions.voidForSubscription(sub.id, tx);
          if (claimId) await this.trials.release(claimId, tx);
          await this.subscriptions.deleteById(sub.id, tx);
          return true;
        });
        // Existing lifecycle listeners re-evaluate sponsorship after the checkout obstruction ends.
        if (removed) this.events.emit(PaymentsEventTopic.SUBSCRIPTION_EXPIRED, new SubscriptionExpired(user.id, sub.id, plan.id));
        throw error;
      }
      // A timeout may have created a charge. Keep the intended subscription and promotion hold.
      this.logger.error({ message: "Checkout outcome requires reconciliation", subscriptionId: sub.id });
      this.pending();
    }

    await withServiceContext(this.db, async (tx) => {
      // Activation webhooks lock subscription before checking Identity. Keep the same order here.
      const current = await this.subscriptions.lockById(sub.id, tx);
      if (!current) this.pending();
      if (!(await this.users.lockActiveAccount(user.id, tx))) this.pending();
      if (current.status === SubscriptionStatus.INCOMPLETE && claimId) {
        await this.trials.saveCheckout(claimId, result, user.id, tx);
        if (this.provider.instantCheckout) await this.trials.consume(sub.id, tx);
      }
      await this.subscriptions.update(sub.id, {
        providerRef: result.providerRef, checkoutUrl: result.checkoutUrl,
        ...(current.status === SubscriptionStatus.INCOMPLETE && this.provider.instantCheckout
          ? { status: withTrial ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE } : {}),
      }, tx);
    });
    return { checkoutUrl: result.checkoutUrl };
  }

  private async reserve(input: CheckoutInput): Promise<CheckoutSession | { sub: SubscriptionRow; claimId?: string }> {
    const { user, plan, offer, withTrial, useTrial, code } = input;
    try {
      return await withServiceContext(this.db, async (tx) => {
        if (!(await this.users.lockActiveAccount(user.id, tx))) this.pending();
        // Advisory reads in the controller service may be stale. Only these locked reads decide.
        const resumed = await this.trials.resume(user.id, plan.id, code, useTrial, tx);
        if (resumed) return resumed;
        const open = await this.subscriptions.findOpenForUser(user.id, tx);
        if (open?.status === SubscriptionStatus.INCOMPLETE) return this.resumeSubscription(open, plan.id, code, useTrial);
        if (open && open.provider !== SUBSCRIPTION_PROVIDER_SPONSOR) {
          throw new DomainError(ErrorCode.PAYMENT_ALREADY_SUBSCRIBED, HttpStatus.CONFLICT);
        }
        const claim = withTrial ? await this.trials.reserve(user.id, plan.id, code, tx) : undefined;
        if (open) await this.subscriptions.expireSponsorship(open.id, new Date(), tx);
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + plan.periodMonths);
        const trialEndsAt = withTrial ? new Date(now.getTime() + plan.trialDays * 86_400_000) : null;
        const sub = await this.subscriptions.create({
          userId: user.id, planId: plan.id, provider: this.provider.provider,
          status: SubscriptionStatus.INCOMPLETE, trialEndsAt, checkoutCode: code ?? null,
          currentPeriodStart: now, currentPeriodEnd: trialEndsAt ?? periodEnd,
        }, tx);
        if (claim) await this.trials.bind(claim.id, sub.id, user.id, tx);
        await this.promotions.reserve({ tx, offer, userId: user.id, orgId: user.orgId ?? null, subscriptionId: sub.id });
        return { sub, claimId: claim?.id };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const constraint = uniqueConstraint(error);
        if (constraint === "phone_trial_claims_pending_user_unique") this.pending();
        if (constraint === "phone_trial_claims_fingerprint_unique") {
          throw new DomainError(ErrorCode.PAYMENT_TRIAL_UNAVAILABLE, HttpStatus.CONFLICT);
        }
        throw new DomainError(ErrorCode.PAYMENT_ALREADY_SUBSCRIBED, HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  private resumeSubscription(sub: SubscriptionRow, planId: string, code?: string, useTrial?: boolean): CheckoutSession {
    if (sub.planId !== planId || (sub.checkoutCode ?? null) !== (code ?? null) || !sub.checkoutUrl
      || (useTrial !== undefined && Boolean(sub.trialEndsAt) !== useTrial)) this.pending();
    return { checkoutUrl: sub.checkoutUrl };
  }

  private pending(): never { throw new DomainError(ErrorCode.PAYMENT_TRIAL_PENDING, HttpStatus.CONFLICT); }
}
