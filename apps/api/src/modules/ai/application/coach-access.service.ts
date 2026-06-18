import { Injectable } from "@nestjs/common";
import { CoachAccessMode, type CoachAccessDto } from "@mentor/types";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { EconomyService } from "../../economy/application/economy.service";
import { EntitlementService } from "../../payments/application/entitlement.service";

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
  ) {}

  async getAccess(userId: string, rolesHint?: string[]): Promise<CoachAccessDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      return { canChat: false, mode: CoachAccessMode.NONE, reason: ErrorCode.AI_DISABLED };
    }

    const ent = await this.entitlement.getEntitlement(userId, rolesHint);
    if (ent.isPremium) {
      return { canChat: true, mode: CoachAccessMode.PREMIUM };
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
