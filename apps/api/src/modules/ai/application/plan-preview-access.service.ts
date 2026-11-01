import { Injectable } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import { PremiumFeatureId, type PlanPreviewAccessDto } from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { ErrorCode } from "../../../common/errors/error-code";
import { EconomyService } from "../../economy/application/economy.service";
import { PlanPreviewRepository } from "../infrastructure/plan-preview.repository";
import { PLAN_PREVIEW_WINDOW_MS } from "../domain/plan-coin-preview";
import { AiBudgetGuard } from "./ai-budget.guard";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiUsageFeature } from "../domain/ai.constants";

/** Canonical read-only offer shared by the wizard, Coin catalog and purchase enforcement. */
@Injectable()
export class PlanPreviewAccessService {
  constructor(
    private readonly config: ConfigRegistryService,
    private readonly gate: PremiumFeatureGateService,
    private readonly economy: EconomyService,
    private readonly previews: PlanPreviewRepository,
    private readonly budget: AiBudgetGuard,
    private readonly i18n: I18nService,
    private readonly usage: AiUsageRepository,
  ) {}

  async get(
    user: Pick<RequestUser, "id" | "roles">,
  ): Promise<PlanPreviewAccessDto> {
    const [
      ai,
      economyOn,
      coinOn,
      included,
      cost,
      limit,
      balance,
      capacity,
      history,
      generationCap,
      generated,
    ] = await Promise.all([
      this.config.get("ai.enabled"),
      this.config.get("economy.enabled"),
      this.config.get("ai.plan.coin_enabled"),
      this.gate.isAllowed(user.id, user.roles, PremiumFeatureId.PLAN_AI),
      this.config.get("economy.coin.plan_preview_cost"),
      this.config.get("ai.plan.coin_daily_limit"),
      this.economy.getAdminBalance(user.id),
      this.budget.hasCapacity(),
      this.previews.withUserLock(user.id, async (tx) => ({
        used: await this.previews.countSince(
          user.id,
          new Date(Date.now() - PLAN_PREVIEW_WINDOW_MS),
          tx,
        ),
        latest: await this.previews.latest(user.id, tx),
      })),
      this.config.get("ai.plan_draft.daily_limit"),
      this.usage.countFeaturesSince(
        user.id,
        [AiUsageFeature.PLAN_DRAFT, AiUsageFeature.PLAN_ADAPTATION],
        new Date(Date.now() - PLAN_PREVIEW_WINDOW_MS),
      ),
    ]);
    const mode = included ? "INCLUDED" : economyOn && coinOn ? "COIN" : "NONE";
    const latestRequestId =
      history.latest && (!ai || !economyOn || !coinOn)
        ? await this.previews.withUserLock(user.id, (tx) =>
            this.previews.latest(user.id, tx, false),
          )
        : history.latest;
    const remaining = Math.max(
      0,
      Math.min(limit - history.used, generationCap - generated),
    );
    const reason = !ai
      ? ErrorCode.AI_DISABLED
      : !capacity
        ? ErrorCode.AI_BUDGET_EXCEEDED
        : generated >= generationCap
          ? ErrorCode.AI_RATE_LIMITED
          : mode === "NONE"
            ? ErrorCode.PAYMENT_PREMIUM_REQUIRED
            : mode === "COIN" && remaining === 0
              ? ErrorCode.AI_PLAN_COIN_LIMIT_REACHED
              : mode === "COIN" && balance.coinConfirmed < cost
                ? ErrorCode.INSUFFICIENT_COIN
                : undefined;
    return {
      mode,
      canGenerate: !reason,
      cost: mode === "COIN" ? cost : null,
      dailyLimit: limit,
      dailyRemaining: remaining,
      coinConfirmed: balance.coinConfirmed,
      latestRequestId,
      ...(reason
        ? {
            reason,
            message: this.i18n.translate(`errors.${reason}`, {
              lang: I18nContext.current()?.lang,
            }) as string,
          }
        : {}),
    };
  }
}
