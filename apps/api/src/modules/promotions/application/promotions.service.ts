import { HttpStatus, Injectable } from "@nestjs/common";
import type { AdminCreatePromotionInput, AdminUpdatePromotionInput } from "@mentor/validation";
import {
  PromotionRedemptionStatus,
  type PromotionDiscountType,
  type PromotionIneligibleReason,
  type PromotionOfferView,
  PromotionRuleType,
  type PromotionSummary,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { DatabaseTx } from "../../../database/drizzle";
import { advertisedDiscountValue, computeDiscount } from "../domain/promotion-price";
import { evaluateRule, type PromotionRuleContext } from "../domain/promotion-rule";
import {
  PromotionRepository,
  type NewPromotion,
  type PromotionRow,
} from "../infrastructure/promotion.repository";
import {
  PromotionRedemptionRepository,
  type PromotionRedemptionRow,
} from "../infrastructure/promotion-redemption.repository";

/** Everything the caller (payments) must supply — this module never reads another context's tables. */
export interface PromotionUserContext {
  userId: string;
  orgId: string | null;
  userCreatedAt: Date;
  /** Has the user EVER had a subscription row? Same signal payments uses for trial-once. */
  hadAnySubscription: boolean;
  /** Had a subscription and no longer has premium — the WIN_BACK signal. Derived by payments. */
  lostPremiumAccess: boolean;
}

/**
 * Widest window an ACTIVE_DAYS rule may ask for — mirrors the `windowDays` bound in
 * `@mentor/validation`. Fetching this once covers every live rule, so no candidate needs its own
 * query, and 90 date strings for one user is nothing.
 */
export const MAX_ACTIVITY_WINDOW_DAYS = 90;

export interface PromotionPlanInput {
  id: string;
  /** Display name — a promotion states which PLANS it covers, never a price. */
  name: string;
  priceMinor: number;
}

export interface ResolveOffersInput {
  context: PromotionUserContext;
  plans: readonly PromotionPlanInput[];
  /** Supplied by the user. Absent → only code-less (automatic) promotions are considered. */
  code?: string;
  locale?: string;
  now?: Date;
  /**
   * Studied days, fetched lazily: called at most once per resolve, and ONLY when a live rule
   * actually needs them. Checkout is the money path — an ACTIVE_DAYS-free catalog must not pay for
   * a query nobody reads. Supplied by the caller so this module still imports no other context.
   */
  activeDates?: (windowDays: number) => Promise<readonly string[]>;
}

/** Internal result — carries the promotion id the view must not expose. */
export interface ResolvedOffer {
  planId: string;
  listPriceMinor: number;
  discountMinor: number;
  chargedPriceMinor: number;
  renewalPriceMinor: number;
  promotionId: string | null;
  summary: PromotionSummary | null;
  reason: PromotionIneligibleReason | null;
}

export interface ResolvedOffers {
  offers: Record<string, ResolvedOffer>;
  available: PromotionSummary[];
}

/**
 * The user-facing half of a promotion.
 *
 * Two fields are deliberately NOT copies of the row. `discountValue` is what checkout will really
 * apply (clamped), because a surface that advertises the admin's raw entry can promise a discount
 * the user never gets. `planNames` states the SCOPE instead of a price: a price would presuppose
 * a plan the user has not chosen and would be outright wrong for a `planIds`-scoped campaign.
 */
function toSummary(
  row: PromotionRow,
  locale: string | undefined,
  maxPercent: number,
  plans: readonly PromotionPlanInput[],
): PromotionSummary {
  const covered = row.planIds === null ? plans : plans.filter((p) => row.planIds!.includes(p.id));
  return {
    id: row.id,
    code: row.code,
    label: locale === "en" ? row.labelEn : row.labelTr,
    eyebrow: (locale === "en" ? row.eyebrowEn : row.eyebrowTr) ?? null,
    description: (locale === "en" ? row.descriptionEn : row.descriptionTr) ?? null,
    discountType: row.discountType as PromotionDiscountType,
    discountValue: advertisedDiscountValue(
      row.discountType as PromotionDiscountType,
      row.discountValue,
      maxPercent,
      covered.map((p) => p.priceMinor),
    ),
    planNames: row.planIds === null ? null : covered.map((p) => p.name),
    appliesToPeriods: row.appliesToPeriods,
    endsAt: row.endsAt?.toISOString() ?? null,
  };
}

export function toOfferView(offer: ResolvedOffer): PromotionOfferView {
  return {
    planId: offer.planId,
    listPriceMinor: offer.listPriceMinor,
    discountMinor: offer.discountMinor,
    chargedPriceMinor: offer.chargedPriceMinor,
    renewalPriceMinor: offer.renewalPriceMinor,
    promotion: offer.summary,
    reason: offer.reason,
  };
}

@Injectable()
export class PromotionsService {
  constructor(
    private readonly promotionsRepo: PromotionRepository,
    private readonly redemptionsRepo: PromotionRedemptionRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  /**
   * Advisory price resolution — drives the paywall and seeds checkout. The AUTHORITATIVE quota
   * check happens again inside {@link reserve}, under locks, in the checkout transaction. Same
   * split as ads: `getRewardOffer` advises, `createRewardSession` decides.
   */
  async resolveOffers(input: ResolveOffersInput): Promise<ResolvedOffers> {
    const now = input.now ?? new Date();
    let activity: Promise<readonly string[]> | null = null;
    const ruleContextFor = async (
      candidates: readonly PromotionRow[],
    ): Promise<PromotionRuleContext> => {
      const needsActivity =
        input.activeDates !== undefined &&
        candidates.some((row) => row.ruleType === PromotionRuleType.ACTIVE_DAYS);
      if (needsActivity) activity ??= input.activeDates!(MAX_ACTIVITY_WINDOW_DAYS);
      return {
        now,
        userCreatedAt: input.context.userCreatedAt,
        hadAnySubscription: input.context.hadAnySubscription,
        lostPremiumAccess: input.context.lostPremiumAccess,
        activeDates: needsActivity ? await activity! : [],
      };
    };

    const enabled = await this.config.get("promotions.enabled");
    if (!enabled) return this.listPrices(input.plans, input.code ? "DISABLED" : null);

    // Needed by both branches below: the waiting-coupon list advertises a magnitude too, and it
    // has to be the clamped one there as well.
    const maxPercent = await this.config.get("promotions.max_percent");

    const { candidates, rejection } = await this.findCandidates(input.code, now);
    if (rejection) return this.listPrices(input.plans, rejection);
    if (candidates.length === 0) {
      return {
        ...this.listPrices(input.plans, null),
        available: await this.available(input, now, maxPercent, ruleContextFor),
      };
    }

    const ruleContext = await ruleContextFor(candidates);

    // ponytail: quota counts run per candidate, un-cached. The live catalog is a handful of rows;
    // add a single grouped count if the candidate list ever grows past a page.
    const eligible: PromotionRow[] = [];
    let lastReason: PromotionIneligibleReason | null = null;
    for (const promotion of candidates) {
      const reason = await this.disqualify(promotion, ruleContext, input.context.userId);
      if (reason) {
        lastReason = reason;
        continue;
      }
      eligible.push(promotion);
    }

    const offers: Record<string, ResolvedOffer> = {};
    for (const plan of input.plans) {
      offers[plan.id] = this.bestOfferForPlan(
        plan,
        input.plans,
        eligible,
        maxPercent,
        input.locale,
        // A reason is only shown when the user typed a code and it did not stick.
        input.code ? lastReason ?? "PLAN_MISMATCH" : null,
      );
    }
    return { offers, available: await this.available(input, now, maxPercent, ruleContextFor) };
  }

  /**
   * Coded promotions the user already qualifies for. Surfacing them keeps the coupon code in the
   * DATA — the welcome modal renders whatever the admin created instead of hardcoding "HOSGELDIN".
   * Skipped when the user supplied a code: they are already looking at one.
   */
  private async available(
    input: ResolveOffersInput,
    now: Date,
    maxPercent: number,
    ruleContextFor: (candidates: readonly PromotionRow[]) => Promise<PromotionRuleContext>,
  ): Promise<PromotionSummary[]> {
    if (input.code) return [];
    const coded = await this.promotionsRepo.findLiveCoded(now);
    if (coded.length === 0) return [];

    const ruleContext = await ruleContextFor(coded);
    const summaries: PromotionSummary[] = [];
    for (const promotion of coded) {
      if (await this.disqualify(promotion, ruleContext, input.context.userId)) continue;
      summaries.push(toSummary(promotion, input.locale, maxPercent, input.plans));
    }
    return summaries;
  }

  /**
   * Freeze the agreed price. MUST run inside the caller's checkout transaction so the redemption
   * and the subscription row commit together — a redemption without a subscription would hold a
   * seat forever, and a subscription without one would charge the list price.
   */
  async reserve(params: {
    tx: DatabaseTx;
    offer: ResolvedOffer;
    userId: string;
    orgId: string | null;
    subscriptionId: string;
  }): Promise<PromotionRedemptionRow | null> {
    const { tx, offer, userId, orgId, subscriptionId } = params;
    if (!offer.promotionId || offer.discountMinor <= 0) return null;

    const promotion = await this.promotionsRepo.findById(offer.promotionId, tx);
    if (!promotion || !promotion.isActive) {
      throw new DomainError(ErrorCode.PROMOTION_NOT_FOUND, HttpStatus.CONFLICT);
    }

    // Lock order is promotion-then-user everywhere, so concurrent reservations cannot deadlock.
    // The promotion lock is what makes the GLOBAL cap safe: two different users racing for the
    // last seat would otherwise both read `used = max - 1`.
    await this.redemptionsRepo.acquirePromotionLock(promotion.id, tx);
    await this.redemptionsRepo.acquireUserLock(userId, tx);

    // Sequential, never Promise.all: one pg client owns the transaction.
    if (promotion.maxRedemptions !== null) {
      const used = await this.redemptionsRepo.countForPromotion(promotion.id, tx);
      if (used >= promotion.maxRedemptions) {
        throw new DomainError(ErrorCode.PROMOTION_EXHAUSTED, HttpStatus.CONFLICT);
      }
    }
    const mine = await this.redemptionsRepo.countForUser(promotion.id, userId, tx);
    if (mine >= promotion.maxRedemptionsPerUser) {
      throw new DomainError(ErrorCode.PROMOTION_NOT_ELIGIBLE, HttpStatus.CONFLICT, {
        reason: "USER_LIMIT_REACHED",
      });
    }

    return this.redemptionsRepo.create(
      {
        orgId,
        promotionId: promotion.id,
        userId,
        subscriptionId,
        planId: offer.planId,
        listPriceMinor: offer.listPriceMinor,
        discountMinor: offer.discountMinor,
        chargedPriceMinor: offer.chargedPriceMinor,
        periodsRemaining: promotion.appliesToPeriods,
        status: PromotionRedemptionStatus.RESERVED,
      },
      tx,
    );
  }

  /** The discount still covering this subscription's next charge, if any. */
  findActiveForSubscription(
    subscriptionId: string,
    exec?: DatabaseTx,
  ): Promise<PromotionRedemptionRow | undefined> {
    return this.redemptionsRepo.findActiveForSubscription(subscriptionId, exec);
  }

  /** Provider confirmed the checkout: RESERVED → APPLIED. Idempotent (compare-and-set). */
  async markApplied(subscriptionId: string, tx: DatabaseTx): Promise<void> {
    const row = await this.redemptionsRepo.findForSubscription(subscriptionId, tx);
    if (!row) return;
    await this.redemptionsRepo.setStatus(
      row.id,
      PromotionRedemptionStatus.RESERVED,
      PromotionRedemptionStatus.APPLIED,
      tx,
    );
  }

  /**
   * Consume one covered charge. Returns the periods left afterwards, or null when nothing was
   * consumed (no discount, or a replayed webhook that already decremented).
   */
  async consumePeriod(subscriptionId: string, tx: DatabaseTx): Promise<number | null> {
    const row = await this.redemptionsRepo.findActiveForSubscription(subscriptionId, tx);
    if (!row) return null;
    return this.redemptionsRepo.consumePeriod(row.id, tx);
  }

  /** Abandoned checkout: release the seat but keep the row for the audit trail. */
  voidForSubscription(subscriptionId: string, exec?: DatabaseTx): Promise<void> {
    return this.redemptionsRepo.voidForSubscription(subscriptionId, exec);
  }

  // -------------------------------------------------------------- admin (W6)

  async listAdmin(): Promise<AdminPromotionDto[]> {
    const [rows, counts] = await Promise.all([
      this.promotionsRepo.listAll(),
      this.redemptionsRepo.countsByPromotion(),
    ]);
    return rows.map((row) => toAdminDto(row, counts.get(row.id) ?? 0));
  }

  async getAdmin(id: string): Promise<AdminPromotionDto | null> {
    const row = await this.promotionsRepo.findById(id);
    if (!row) return null;
    return toAdminDto(row, await this.redemptionsRepo.countForPromotion(id));
  }

  async createAdmin(
    input: AdminCreatePromotionInput,
    actorUserId: string,
  ): Promise<AdminPromotionDto> {
    await this.assertPeriodsAllowed(input.appliesToPeriods);
    // The zod schema guarantees every required column is present on the create path.
    const row = await this.promotionsRepo.create({
      ...(toRowPatch(input) as NewPromotion),
      createdBy: actorUserId,
    });
    return toAdminDto(row, 0);
  }

  async updateAdmin(
    id: string,
    input: AdminUpdatePromotionInput,
  ): Promise<AdminPromotionDto | null> {
    await this.assertPeriodsAllowed(input.appliesToPeriods);
    const row = await this.promotionsRepo.update(id, {
      ...toRowPatch(input),
      updatedAt: new Date(),
    });
    if (!row) return null;
    return toAdminDto(row, await this.redemptionsRepo.countForPromotion(id));
  }

  /**
   * The zod bound is only a rail; the real ceiling lives in config so it can be raised the day the
   * payment adapter can bill a multi-period intro price — no migration, no deploy.
   */
  private async assertPeriodsAllowed(periods: number | undefined): Promise<void> {
    if (periods === undefined) return;
    const max = await this.config.get("promotions.max_discount_periods");
    if (periods > max) {
      throw new DomainError(ErrorCode.PROMOTION_NOT_ELIGIBLE, HttpStatus.UNPROCESSABLE_ENTITY, {
        reason: "PERIODS_ABOVE_CAP",
        max,
      });
    }
  }

  // ---------------------------------------------------------------- internals

  /** Candidate set: a typed code resolves to exactly one row, otherwise every automatic promotion. */
  private async findCandidates(
    code: string | undefined,
    now: Date,
  ): Promise<{ candidates: PromotionRow[]; rejection: PromotionIneligibleReason | null }> {
    if (!code) {
      const live = await this.promotionsRepo.findLive(now);
      return { candidates: live.filter((row) => row.code === null), rejection: null };
    }
    const row = await this.promotionsRepo.findActiveByCode(code);
    if (!row) return { candidates: [], rejection: "NOT_FOUND" };
    // findActiveByCode ignores the date window so we can tell "too early" from "too late".
    if (row.startsAt && row.startsAt > now) return { candidates: [], rejection: "NOT_STARTED" };
    if (row.endsAt && row.endsAt <= now) return { candidates: [], rejection: "EXPIRED" };
    return { candidates: [row], rejection: null };
  }

  /** null = the user qualifies. */
  private async disqualify(
    promotion: PromotionRow,
    ruleContext: PromotionRuleContext,
    userId: string,
  ): Promise<PromotionIneligibleReason | null> {
    if (
      !evaluateRule(
        promotion.ruleType as PromotionRuleType,
        (promotion.ruleParams ?? {}) as Record<string, unknown>,
        ruleContext,
      )
    ) {
      return "RULE_UNMET";
    }
    if (promotion.maxRedemptions !== null) {
      const used = await this.redemptionsRepo.countForPromotion(promotion.id);
      if (used >= promotion.maxRedemptions) return "EXHAUSTED";
    }
    const mine = await this.redemptionsRepo.countForUser(promotion.id, userId);
    if (mine >= promotion.maxRedemptionsPerUser) return "USER_LIMIT_REACHED";
    return null;
  }

  /**
   * Best single discount wins. No stacking: combining promotions needs a precedence model that
   * nobody has asked for, and it makes the legal disclosure ("ilk ay X, sonra Y") ambiguous.
   */
  private bestOfferForPlan(
    plan: PromotionPlanInput,
    plans: readonly PromotionPlanInput[],
    eligible: readonly PromotionRow[],
    maxPercent: number,
    locale: string | undefined,
    reasonWhenNone: PromotionIneligibleReason | null,
  ): ResolvedOffer {
    let best: { promotion: PromotionRow; discountMinor: number; chargedPriceMinor: number } | null =
      null;

    for (const promotion of eligible) {
      if (promotion.planIds !== null && !promotion.planIds.includes(plan.id)) continue;
      const breakdown = computeDiscount(
        plan.priceMinor,
        promotion.discountType as PromotionDiscountType,
        promotion.discountValue,
        maxPercent,
      );
      if (breakdown.discountMinor <= 0) continue;
      if (!best || breakdown.discountMinor > best.discountMinor) {
        best = {
          promotion,
          discountMinor: breakdown.discountMinor,
          chargedPriceMinor: breakdown.chargedPriceMinor,
        };
      }
    }

    if (!best) return this.listPrice(plan, reasonWhenNone);

    return {
      planId: plan.id,
      listPriceMinor: plan.priceMinor,
      discountMinor: best.discountMinor,
      chargedPriceMinor: best.chargedPriceMinor,
      // Once the covered periods run out the plan renews at its list price.
      renewalPriceMinor: plan.priceMinor,
      promotionId: best.promotion.id,
      summary: toSummary(best.promotion, locale, maxPercent, plans),
      reason: null,
    };
  }

  private listPrice(
    plan: PromotionPlanInput,
    reason: PromotionIneligibleReason | null,
  ): ResolvedOffer {
    return {
      planId: plan.id,
      listPriceMinor: plan.priceMinor,
      discountMinor: 0,
      chargedPriceMinor: plan.priceMinor,
      renewalPriceMinor: plan.priceMinor,
      promotionId: null,
      summary: null,
      reason,
    };
  }

  private listPrices(
    plans: readonly PromotionPlanInput[],
    reason: PromotionIneligibleReason | null,
  ): ResolvedOffers {
    const offers: Record<string, ResolvedOffer> = {};
    for (const plan of plans) offers[plan.id] = this.listPrice(plan, reason);
    return { offers, available: [] };
  }
}

/** Admin-facing shape. Kept here (not @mentor/types) — only the admin panel consumes it. */
export interface AdminPromotionDto {
  id: string;
  code: string | null;
  name: string;
  labelTr: string;
  labelEn: string;
  eyebrowTr: string | null;
  eyebrowEn: string | null;
  descriptionTr: string | null;
  descriptionEn: string | null;
  ruleType: string;
  ruleParams: Record<string, unknown>;
  discountType: string;
  discountValue: number;
  appliesToPeriods: number;
  planIds: string[] | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  isActive: boolean;
  /** Non-voided redemptions — what the global cap actually counts. */
  redeemedCount: number;
  createdAt: string;
}

function toAdminDto(row: PromotionRow, redeemedCount: number): AdminPromotionDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    labelTr: row.labelTr,
    labelEn: row.labelEn,
    eyebrowTr: row.eyebrowTr,
    eyebrowEn: row.eyebrowEn,
    descriptionTr: row.descriptionTr,
    descriptionEn: row.descriptionEn,
    ruleType: row.ruleType,
    ruleParams: (row.ruleParams ?? {}) as Record<string, unknown>,
    discountType: row.discountType,
    discountValue: row.discountValue,
    appliesToPeriods: row.appliesToPeriods,
    planIds: row.planIds,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    maxRedemptions: row.maxRedemptions,
    maxRedemptionsPerUser: row.maxRedemptionsPerUser,
    isActive: row.isActive,
    redeemedCount,
    createdAt: row.createdAt.toISOString(),
  };
}

/** ISO strings on the wire become Dates in the row; keys the caller omitted stay untouched. */
function toRowPatch(
  input: AdminCreatePromotionInput | AdminUpdatePromotionInput,
): Partial<NewPromotion> {
  const { startsAt, endsAt, ...rest } = input;
  const patch = { ...rest } as Partial<NewPromotion>;
  if ("startsAt" in input) patch.startsAt = startsAt ? new Date(startsAt) : null;
  if ("endsAt" in input) patch.endsAt = endsAt ? new Date(endsAt) : null;
  return patch;
}
