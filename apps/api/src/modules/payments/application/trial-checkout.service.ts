import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { SUBSCRIPTION_PROVIDER_SPONSOR, SubscriptionStatus } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation } from "../../../common/errors/postgres-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { PAYMENTS_PORT, type PaymentsPort } from "../../../shared/ports/payments.port";
import { PromotionsService, type ResolvedOffer } from "../../promotions/application/promotions.service";
import { CheckoutRejectedError } from "../domain/checkout-rejected.error";
import { SubscriptionsRepository, type PlanRow, type SubscriptionRow } from "../infrastructure/payments.repositories";
import { PhoneTrialService } from "./phone-trial.service";
import type { CheckoutUser } from "./subscriptions.service";

/** Persist the phone hold and intended subscription BEFORE the one external trial checkout call. */
@Injectable()
export class TrialCheckoutService {
  private readonly logger = new Logger(TrialCheckoutService.name);
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly subscriptions: SubscriptionsRepository,
    private readonly promotions: PromotionsService,
    private readonly trials: PhoneTrialService,
    @Inject(PAYMENTS_PORT) private readonly provider: PaymentsPort,
  ) {}

  async start(input: { user: CheckoutUser; plan: PlanRow; offer: ResolvedOffer; open?: SubscriptionRow; code?: string; returnUrl: string }) {
    const { user, plan, offer, open, code, returnUrl } = input;
    const claim = await this.trials.reserve(user.id, plan.id, code);
    let sub: SubscriptionRow;
    try {
      sub = await withServiceContext(this.db, async (tx) => {
        if (open?.status === SubscriptionStatus.INCOMPLETE) {
          await this.promotions.voidForSubscription(open.id, tx);
          await this.subscriptions.deleteById(open.id, tx);
        } else if (open?.provider === SUBSCRIPTION_PROVIDER_SPONSOR) {
          await this.subscriptions.expireSponsorship(open.id, new Date(), tx);
        }
        const now = new Date();
        const trialEndsAt = new Date(now.getTime() + plan.trialDays * 86_400_000);
        const row = await this.subscriptions.create({
          userId: user.id, planId: plan.id, provider: this.provider.provider,
          status: SubscriptionStatus.INCOMPLETE, trialEndsAt,
          currentPeriodStart: now, currentPeriodEnd: trialEndsAt,
        }, tx);
        await this.trials.bind(claim.id, row.id, user.id, tx);
        await this.promotions.reserve({ tx, offer, userId: user.id, orgId: user.orgId ?? null, subscriptionId: row.id });
        return row;
      });
    } catch (error) {
      // Nothing reached the provider, so this attempt can safely be discarded.
      await this.trials.release(claim.id);
      if (isUniqueViolation(error)) throw new DomainError(ErrorCode.PAYMENT_ALREADY_SUBSCRIBED, HttpStatus.CONFLICT);
      throw error;
    }

    let result: Awaited<ReturnType<PaymentsPort["createCheckout"]>>;
    try {
      result = await this.provider.createCheckout({
        userId: user.id, userEmail: user.email,
        plan: { id: plan.id, priceMinor: plan.priceMinor, chargeAmountMinor: offer.chargedPriceMinor,
          renewalAmountMinor: offer.renewalPriceMinor, discountPeriods: offer.summary?.appliesToPeriods ?? 0,
          currency: plan.currency, periodMonths: plan.periodMonths, trialDays: plan.trialDays },
        returnUrl,
      });
    } catch (error) {
      if (error instanceof CheckoutRejectedError) {
        await withServiceContext(this.db, async (tx) => {
          await this.promotions.voidForSubscription(sub.id, tx);
          await this.trials.release(claim.id, tx);
          await this.subscriptions.deleteById(sub.id, tx);
        });
        throw error;
      }
      // A timeout may have created a charge. Retain the hold until signed/provider evidence.
      this.logger.error({ message: "Trial checkout outcome requires reconciliation", claimId: claim.id, subscriptionId: sub.id });
      throw new DomainError(ErrorCode.PAYMENT_TRIAL_PENDING, HttpStatus.CONFLICT);
    }

    await withServiceContext(this.db, async (tx) => {
      await this.trials.saveCheckout(claim.id, result, user.id, tx);
      if (this.provider.instantCheckout) await this.trials.consume(sub.id, tx);
      await this.subscriptions.update(sub.id, { providerRef: result.providerRef,
        status: this.provider.instantCheckout ? SubscriptionStatus.TRIALING : SubscriptionStatus.INCOMPLETE }, tx);
    });
    return { checkoutUrl: result.checkoutUrl };
  }
}
