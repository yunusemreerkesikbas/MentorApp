import { Injectable } from "@nestjs/common";
import { CoachAccessMode, PremiumFeatureId, type CoachAccessDto } from "@mentor/types";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { EconomyService } from "../../economy/application/economy.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { AiUsageFeature } from "../domain/ai.constants";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";
import { PremiumChatQuotaService } from "./premium-chat-quota.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolves whether a user may use the AI coach chat (premium flat vs earned coin path).
 * Coin amounts are returned for gate screens only — never inside the chat composer (§4 #3).
 */
@Injectable()
export class CoachAccessService {
  constructor(
    private readonly entitlement: EntitlementService,
    private readonly economy: EconomyService,
    private readonly config: ConfigRegistryService,
    private readonly budget: AiBudgetGuard,
    private readonly usage: AiUsageRepository,
    private readonly featureGate: PremiumFeatureGateService,
    private readonly quota: PremiumChatQuotaService,
  ) {}

  admitPremiumChat(userId: string): Promise<string> {
    return this.quota.admit(userId);
  }

  async getAccess(
    userId: string,
    rolesHint?: string[],
  ): Promise<CoachAccessDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      return {
        canChat: false,
        mode: CoachAccessMode.NONE,
        reason: ErrorCode.AI_DISABLED,
      };
    }
    if (!(await this.budget.isWithinBudget())) {
      return {
        canChat: false,
        mode: CoachAccessMode.NONE,
        reason: ErrorCode.AI_BUDGET_EXCEEDED,
      };
    }

    const ent = await this.entitlement.getEntitlement(userId, rolesHint);
    if (ent.isPremium) {
      const { dailyRemaining, monthlyRemaining, retryAt } = await this.quota.read(userId);
      const canChat = dailyRemaining > 0 && monthlyRemaining > 0;
      return {
        canChat,
        mode: CoachAccessMode.PREMIUM,
        ...(!canChat ? { reason: ErrorCode.AI_CHAT_QUOTA_EXCEEDED, retryAt } : {}),
        dailyMessagesRemaining: dailyRemaining,
        monthlyMessagesRemaining: monthlyRemaining,
      };
    }

    if (await this.featureGate.isAllowed(userId, rolesHint, PremiumFeatureId.COACH_CHAT)) {
      const [freeLimit, usedToday] = await Promise.all([
        this.config.get("ai.features.coach.chat.free_limit"),
        this.usage.countFeatureSince(
          userId,
          AiUsageFeature.CHAT,
          new Date(Date.now() - DAY_MS),
        ),
      ]);
      const remaining = Math.max(0, freeLimit - usedToday);
      return {
        canChat: remaining > 0,
        mode: CoachAccessMode.PREMIUM,
        ...(remaining === 0 ? { reason: ErrorCode.AI_RATE_LIMITED } : {}),
        dailyMessagesRemaining: remaining,
      };
    }

    if (!(await this.config.get(FeatureFlag.ECONOMY_ENABLED))) {
      return {
        canChat: false,
        mode: CoachAccessMode.NONE,
        reason: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      };
    }

    const [chatCost, freeDailyLimit, balance, usedToday] = await Promise.all([
      this.config.get("economy.coin.ai_chat_cost"),
      this.config.get("ai.chat.free_coin_daily_limit"),
      this.economy.getSelfBalance(userId),
      this.economy.coinChatSpendsSince(userId, new Date(Date.now() - DAY_MS)),
    ]);

    const freeRemaining = Math.max(0, freeDailyLimit - usedToday);
    if (freeRemaining <= 0) {
      return {
        canChat: false,
        mode: CoachAccessMode.NONE,
        reason: ErrorCode.AI_RATE_LIMITED,
        chatCost,
        freeCoinMessagesRemainingToday: 0,
      };
    }

    if (balance.coinConfirmed < chatCost) {
      return {
        canChat: false,
        mode: CoachAccessMode.NONE,
        reason: ErrorCode.INSUFFICIENT_COIN,
        chatCost,
        freeCoinMessagesRemainingToday: freeRemaining,
      };
    }

    return {
      canChat: true,
      mode: CoachAccessMode.COIN,
      chatCost,
      freeCoinMessagesRemainingToday: freeRemaining,
    };
  }
}
