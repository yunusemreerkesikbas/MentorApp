import { HttpStatus, Injectable } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import type { WeeklyRecapOfferDto, WeeklyReviewDto } from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { DatabaseTx } from "../../../database/drizzle";
import { UsersService } from "../../identity/application/users.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { EconomyService } from "../../economy/application/economy.service";
import { DeepAnalysisService } from "../../economy/application/deep-analysis.service";
import { WeeklyRecapPurchasesService } from "../../economy/application/weekly-recap-purchases.service";
import { WeeklyRecapRepository } from "../infrastructure/weekly-recap.repository";
import { recapAllowance, recapMode, RECAP_DAY_MS } from "../domain/weekly-recap-access";
import { AiBudgetGuard } from "./ai-budget.guard";
import { WeeklyReviewCacheRepository } from "../infrastructure/weekly-review-cache.repository";

@Injectable()
export class WeeklyRecapPolicyService {
  constructor(
    private readonly config: ConfigRegistryService,
    private readonly users: UsersService,
    private readonly entitlement: EntitlementService,
    private readonly economy: EconomyService,
    private readonly deep: DeepAnalysisService,
    private readonly purchases: WeeklyRecapPurchasesService,
    private readonly reports: WeeklyRecapRepository,
    private readonly budget: AiBudgetGuard,
    private readonly i18n: I18nService,
    private readonly cache: WeeklyReviewCacheRepository,
  ) {}

  async settings() {
    const [enabled, freeEnabled, freeLimit, coinEnabled, coinLimit, days, aiEnabled, globalAi, economy, cost] = await Promise.all([
      this.config.get("coaching.weekly_recap.access_enabled"),
      this.config.get("coaching.weekly_recap.free_enabled"),
      this.config.get("coaching.weekly_recap.free_limit"),
      this.config.get("coaching.weekly_recap.coin_enabled"),
      this.config.get("coaching.weekly_recap.coin_limit"),
      this.config.get("coaching.weekly_recap.coin_window_days"),
      this.config.get("coaching.weekly_recap.ai_enabled"),
      this.config.get("ai.enabled"), this.config.get("economy.enabled"),
      this.config.get("economy.coin.deep_analysis_cost"),
    ]);
    return { enabled, freeEnabled, freeLimit, coinEnabled, coinLimit, days, aiEnabled: aiEnabled && globalAi, economy, cost };
  }

  async offer(user: RequestUser, examId: string, review: WeeklyReviewDto, tx: DatabaseTx, exceptId?: string): Promise<WeeklyRecapOfferDto> {
    const [settings, ent, me, balance, legacy] = await Promise.all([
      this.settings(), this.entitlement.getEntitlement(user.id, user.roles), this.users.getMe(user.id),
      this.economy.getSelfBalance(user.id), this.deep.isUnlocked(user.id, examId, review.period.startDate),
    ]);
    const owned = await this.reports.find(user.id, examId, review.period.startDate, tx);
    const reservations = await this.reports.reservations(user.id, tx, exceptId);
    const earnedUsed = await this.reports.earnedCount(user.id, tx);
    const history = await this.purchases.history(user.id, new Date(Date.now() - settings.days * RECAP_DAY_MS), tx);
    const allowance = recapAllowance(history.map((row) => row.at), reservations
      .filter((row) => row.source === "COIN" && row.cost > 0).map((row) => row.expiresAt), settings.coinLimit, settings.days);
    const earnedAvailable = settings.freeEnabled && earnedUsed + reservations.filter((row) => row.source === "EARNED").length < settings.freeLimit;
    const mode = owned?.status === "GENERATED" && owned.source === "PREMIUM" ? "PREMIUM"
      : owned?.status === "GENERATED" && owned.source === "COIN" && !ent.isPremium ? "COIN"
      : recapMode(owned?.status === "READY" || legacy, ent.isPremium, earnedAvailable && me.emailVerified);
    const result: WeeklyRecapOfferDto = {
      enabled: settings.enabled, examId, weekStart: review.period.startDate, endDate: review.period.endDate,
      ready: review.status === "READY", premium: ent.isPremium, mode, canOpen: true, premiumAvailable: false,
      reportId: owned?.status === "READY" ? owned.id : null,
      cost: mode === "COIN" ? owned?.status === "GENERATED" && owned.source === "COIN" ? owned.cost : settings.cost : 0,
      coinConfirmed: balance.coinConfirmed, coinLimit: settings.coinLimit, coinRemaining: allowance.remaining,
      windowDays: settings.days, nextAvailableAt: allowance.nextAvailableAt,
    };
    if (owned?.status === "READY") return result;
    const hasNarration = !!owned?.narration || !!(await this.cache.findAny(user.id, examId, review.period.startDate));
    let reason: ErrorCode | undefined;
    if (!settings.enabled) reason = ErrorCode.NOT_FOUND;
    else if (owned?.status === "RUNNING" && owned.expiresAt > new Date()) reason = ErrorCode.WEEKLY_RECAP_PROCESSING;
    else if (review.status !== "READY" && !legacy) reason = ErrorCode.COACHING_WEEKLY_REVIEW_INSUFFICIENT;
    else if (!settings.aiEnabled && !hasNarration) reason = ErrorCode.AI_DISABLED;
    else if (!hasNarration && !(await this.budget.hasCapacity())) reason = ErrorCode.AI_BUDGET_EXCEEDED;
    else if (mode === "EARNED" && (!earnedAvailable || !me.emailVerified)) reason = ErrorCode.PAYMENT_PREMIUM_REQUIRED;
    else if (mode === "COIN") {
      if (!settings.economy || !settings.coinEnabled || settings.cost <= 0) reason = ErrorCode.PAYMENT_PREMIUM_REQUIRED;
      else if (!allowance.remaining) reason = ErrorCode.WEEKLY_RECAP_LIMIT_REACHED;
      else if (balance.coinConfirmed < result.cost) reason = earnedAvailable && !me.emailVerified
        ? ErrorCode.WEEKLY_RECAP_EMAIL_REQUIRED : ErrorCode.INSUFFICIENT_COIN;
    }
    result.premiumAvailable = result.ready && !ent.isPremium && mode !== "OWNED" && settings.enabled &&
      reason !== ErrorCode.AI_DISABLED && reason !== ErrorCode.AI_BUDGET_EXCEEDED && reason !== ErrorCode.WEEKLY_RECAP_PROCESSING;
    return reason ? { ...result, canOpen: false, reason, message: this.i18n.translate(`errors.${reason}`) as string } : result;
  }

  deny(reason?: string): never {
    const code = (reason ?? ErrorCode.PAYMENT_PREMIUM_REQUIRED) as ErrorCode;
    const status = code === ErrorCode.WEEKLY_RECAP_LIMIT_REACHED ? HttpStatus.TOO_MANY_REQUESTS
      : code === ErrorCode.WEEKLY_RECAP_PROCESSING || code === ErrorCode.WEEKLY_RECAP_PRICE_CHANGED ? HttpStatus.CONFLICT
      : code === ErrorCode.AI_BUDGET_EXCEEDED ? HttpStatus.SERVICE_UNAVAILABLE
      : code === ErrorCode.AI_DISABLED || code === ErrorCode.NOT_FOUND ? HttpStatus.NOT_FOUND
      : HttpStatus.FORBIDDEN;
    throw new DomainError(code, status);
  }
}
