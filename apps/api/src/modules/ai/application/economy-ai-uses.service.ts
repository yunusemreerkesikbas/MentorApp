import { Injectable, type OnModuleInit } from "@nestjs/common";
import { CoachAccessMode, type EconomyUseView } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ContentService } from "../../content/application/content.service";
import { UsersService } from "../../identity/application/users.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { DeepAnalysisService } from "../../economy/application/deep-analysis.service";
import { EconomyUsesRegistry } from "../../economy/application/economy-uses.registry";
import { CoachAccessService } from "./coach-access.service";

/** Read-only catalog adapter. Authorization stays with the owning feature; no LLM or Coin writes. */
@Injectable()
export class EconomyAiUsesService implements OnModuleInit {
  constructor(
    private readonly registry: EconomyUsesRegistry,
    private readonly chat: CoachAccessService,
    private readonly entitlement: EntitlementService,
    private readonly config: ConfigRegistryService,
    private readonly users: UsersService,
    private readonly content: ContentService,
    private readonly deep: DeepAnalysisService,
  ) {}
  onModuleInit(): void {
    this.registry.register((userId, roles, coin) =>
      this.getViews(userId, roles, coin),
    );
  }
  private async getViews(
    userId: string,
    roles: string[],
    coin: number,
  ): Promise<EconomyUseView[]> {
    const ent = await this.entitlement.getEntitlement(userId, roles);
    return Promise.all([
      this.chatView(userId, roles, ent.isPremium),
      this.weeklyView(userId, roles, coin, ent.isPremium),
    ]);
  }
  private async chatView(
    userId: string,
    roles: string[],
    premium: boolean,
  ): Promise<EconomyUseView> {
    const access = await this.chat.getAccess(userId, roles);
    const included = access.mode === CoachAccessMode.PREMIUM;
    const cost =
      !included && access.chatCost !== undefined && access.chatCost > 0
        ? access.chatCost
        : null;
    const usable = access.canChat && (included || (cost !== null && cost > 0));
    const status =
      access.reason === ErrorCode.AI_RATE_LIMITED
        ? "DAILY_LIMIT_REACHED"
        : access.reason === ErrorCode.INSUFFICIENT_COIN
          ? "INSUFFICIENT_COIN"
          : !usable
            ? "UNAVAILABLE"
            : premium
              ? "PREMIUM_INCLUDED"
              : included
                ? "INCLUDED"
                : "AVAILABLE";
    return {
      id: "COACH_CHAT",
      status,
      cost,
      premiumIncluded: premium,
      canOpen: usable,
      ...(access.dailyMessagesRemaining !== undefined
        ? { dailyRemaining: access.dailyMessagesRemaining }
        : access.freeCoinMessagesRemainingToday !== undefined
          ? { dailyRemaining: access.freeCoinMessagesRemainingToday }
          : {}),
    };
  }
  private async weeklyView(
    userId: string,
    roles: string[],
    coin: number,
    premium: boolean,
  ): Promise<EconomyUseView> {
    const base = {
      id: "DEEP_ANALYSIS" as const,
      cost: null,
      premiumIncluded: premium,
      canOpen: false,
    };
    if (!(await this.config.get("ai.enabled")))
      return { ...base, status: "UNAVAILABLE" };
    const me = await this.users.getMe(userId);
    if (!me.examType) return { ...base, status: "NEEDS_EXAM" };
    let exam;
    try {
      exam = await this.content.getCurrentExamByFamily(
        me.examType,
        me.examVariant,
      );
    } catch (error) {
      if (
        error instanceof DomainError &&
        error.code === ErrorCode.CONTENT_EXAM_NOT_FOUND
      )
        return { ...base, status: "UNAVAILABLE" };
      throw error;
    }
    const state = await this.deep.getState(userId, roles, exam.id);
    if (!state.eligible || !state.weekStart)
      return {
        ...base,
        cost: premium ? null : state.cost,
        status: "REVIEW_NOT_READY",
      };
    if (!premium && state.purchased) {
      return { ...base, status: "ALREADY_UNLOCKED", canOpen: true };
    }
    if (!state.generationAvailable) return { ...base, status: "UNAVAILABLE" };
    if (premium) return { ...base, status: "PREMIUM_INCLUDED", canOpen: true };
    if (state.unlocked) {
      return { ...base, status: "INCLUDED", canOpen: true };
    }
    if (state.cost <= 0) return { ...base, status: "UNAVAILABLE" };
    return {
      ...base,
      cost: state.cost,
      status: coin >= state.cost ? "AVAILABLE" : "INSUFFICIENT_COIN",
      canOpen: coin >= state.cost,
    };
  }
}
