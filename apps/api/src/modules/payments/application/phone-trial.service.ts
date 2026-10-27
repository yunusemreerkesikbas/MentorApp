import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { CheckoutSession, TrialEligibilityDto } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation } from "../../../common/errors/postgres-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { UsersService } from "../../identity/application/users.service";
import { PhoneTrialsRepository, type PhoneTrialClaim } from "../infrastructure/phone-trials.repository";
import { SubscriptionsRepository } from "../infrastructure/payments.repositories";

export function trialClaimExpiresAt(now: Date): Date {
  const expires = new Date(now);
  const day = expires.getUTCDate();
  expires.setUTCDate(1);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  const lastDay = new Date(Date.UTC(expires.getUTCFullYear(), expires.getUTCMonth() + 1, 0)).getUTCDate();
  expires.setUTCDate(Math.min(day, lastDay));
  return expires;
}

@Injectable()
export class PhoneTrialService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly users: UsersService,
    private readonly claims: PhoneTrialsRepository,
    private readonly subscriptions: SubscriptionsRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  async eligibility(userId: string): Promise<TrialEligibilityDto> {
    const phoneVerificationRequired = Boolean(await this.config.get("payments.trial.phone_verification_required"));
    const result = (eligible: boolean, reason: TrialEligibilityDto["reason"]): TrialEligibilityDto =>
      ({ eligible, reason, phoneVerificationRequired });
    if (await this.claims.findPendingForUser(userId)) return result(false, "PENDING");
    if (await this.subscriptions.hasAnyForUser(userId)) return result(false, "ACCOUNT_USED");
    if (!phoneVerificationRequired) return result(true, "AVAILABLE");
    const fingerprint = await this.users.getVerifiedPhoneFingerprint(userId);
    if (!fingerprint) return result(false, "PHONE_REQUIRED");
    const claim = await this.claims.findByFingerprint(fingerprint);
    if (claim?.status === "PENDING") return result(false, "PENDING");
    if (claim && (!claim.expiresAt || claim.expiresAt > new Date())) return result(false, "PHONE_USED");
    return result(true, "AVAILABLE");
  }

  async pendingCheckoutUrl(userId: string): Promise<string | null> {
    return (await this.claims.findPendingForUser(userId))?.checkoutUrl ?? null;
  }

  async selectTrial(userId: string, trialDays: number, useTrial: boolean | undefined, hadAny: boolean): Promise<boolean> {
    if (useTrial === false) return false;
    if (hadAny || trialDays <= 0) {
      if (useTrial === true) this.unavailable();
      return false;
    }
    const eligibility = await this.eligibility(userId);
    if (!eligibility.eligible) {
      if (eligibility.reason === "PHONE_REQUIRED") throw new DomainError(ErrorCode.AUTH_PHONE_REQUIRED, HttpStatus.FORBIDDEN);
      if (eligibility.reason === "PENDING") this.pending();
      this.unavailable();
    }
    return true;
  }

  /** Unknown holds never expire. A matching known hosted checkout is the only safe retry. */
  async resume(userId: string, planId: string, code: string | undefined, useTrial: boolean | undefined, tx?: DatabaseTx): Promise<CheckoutSession | null> {
    const pending = await this.claims.findPendingForUser(userId, tx);
    if (!pending) return null;
    if (useTrial === false || pending.planId !== planId || pending.code !== (code ?? null) || !pending.checkoutUrl) this.pending();
    return { checkoutUrl: pending.checkoutUrl };
  }

  async reserve(userId: string, planId: string, code?: string, tx?: DatabaseTx) {
    try {
      const apply = async (tx: DatabaseTx) => {
        // Identity locks/rechecks ACTIVE verification. Account and phone uniqueness then exclude
        // both same-account/different-phone and different-account/same-phone races.
        const requirePhone = await this.config.get("payments.trial.phone_verification_required");
        const fingerprint = requirePhone ? await this.users.getVerifiedPhoneFingerprint(userId, tx) : null;
        if (requirePhone && !fingerprint) throw new DomainError(ErrorCode.AUTH_PHONE_REQUIRED, HttpStatus.FORBIDDEN);
        if (!requirePhone && !(await this.users.lockActiveAccount(userId, tx))) this.unavailable();
        if (await this.subscriptions.hasAnyForUser(userId, tx)) this.unavailable();
        if (fingerprint) await this.claims.purgeFingerprint(fingerprint, new Date(), tx);
        return this.claims.reserve({ userId, phoneFingerprint: fingerprint, planId, code: code ?? null }, tx);
      };
      return await (tx ? apply(tx) : withServiceContext(this.db, apply));
    } catch (error) {
      // The caller owns rollback when reservation is part of checkout's larger transaction.
      if (tx) throw error;
      if (!isUniqueViolation(error)) throw error;
      if (await this.claims.findPendingForUser(userId)) this.pending();
      this.unavailable();
    }
  }

  async bind(id: string, subscriptionId: string, userId: string, tx: DatabaseTx): Promise<void> {
    const claim = await this.claims.findById(id, tx);
    if (claim?.userId !== userId) this.unavailable();
    await this.requireActiveClaim(claim, tx);
    if (!(await this.claims.bind(id, subscriptionId, userId, tx))) this.unavailable();
  }

  async saveCheckout(id: string, result: { providerRef: string; checkoutUrl: string }, userId: string, tx: DatabaseTx): Promise<void> {
    const claim = await this.claims.findById(id, tx);
    if (claim?.userId !== userId) this.unavailable();
    await this.requireActiveClaim(claim, tx);
    if (!(await this.claims.saveCheckout(id, result, userId, tx))) this.unavailable();
  }

  async consume(subscriptionId: string, tx: DatabaseTx): Promise<void> {
    const claim = await this.claims.findForSubscription(subscriptionId, tx);
    if (!claim?.userId) this.unavailable();
    await this.requireActiveClaim(claim, tx);
    const now = new Date();
    if (!(await this.claims.consumeForSubscription(subscriptionId, claim.userId, now, trialClaimExpiresAt(now), tx))) this.unavailable();
  }

  release(id: string, tx?: DatabaseTx) { return this.claims.release(id, tx); }
  releaseForSubscription(subscriptionId: string, tx: DatabaseTx) { return this.claims.releaseForSubscription(subscriptionId, tx); }
  detachUser(userId: string) { return this.claims.detachUser(userId); }
  purgeExpired(now = new Date()) { return this.claims.purgeExpired(now); }

  private pending(): never { throw new DomainError(ErrorCode.PAYMENT_TRIAL_PENDING, HttpStatus.CONFLICT); }
  private unavailable(): never { throw new DomainError(ErrorCode.PAYMENT_TRIAL_UNAVAILABLE, HttpStatus.CONFLICT); }

  private async requireActiveClaim(claim: Pick<PhoneTrialClaim, "userId" | "phoneFingerprint">, tx: DatabaseTx): Promise<void> {
    if (!claim.userId) this.unavailable();
    // The persisted fingerprint snapshots the requirement, independent of later config changes.
    const active = claim.phoneFingerprint !== null
      ? await this.users.getVerifiedPhoneFingerprint(claim.userId, tx)
      : await this.users.lockActiveAccount(claim.userId, tx);
    if (!active) this.unavailable();
  }
}
