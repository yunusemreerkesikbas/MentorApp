import { Injectable, Logger } from "@nestjs/common";
import { Currency, type QuestProgressView } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import {
  DailyQuestSignalService,
  type DailyQuestSignals,
} from "../../coaching/application/daily-quest-signal.service";
import { UsersService } from "../../identity/application/users.service";
import { SubscriptionsService } from "../../payments/application/subscriptions.service";
import { EconomyService } from "./economy.service";
import { InviteRepository } from "../infrastructure/invite.repository";
import { QuestRepository } from "../infrastructure/quest.repository";
import {
  QUEST_CATALOG,
  QUEST_PERIOD_ONCE,
  QuestType,
  type QuestDef,
} from "../domain/quest.catalog";

export type { QuestProgressView };

/**
 * Quests (§3 light economy). Conditions are evaluated by READING other modules' public services
 * (identity/payments/coaching) + economy's own invite repo — no cross-module table access
 * (workstreams §3). A newly-completed quest grants XP/Coin via the idempotent reward engine.
 * Gated by `economy.enabled`.
 */
@Injectable()
export class QuestService {
  private readonly logger = new Logger(QuestService.name);

  constructor(
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly dailySignals: DailyQuestSignalService,
    private readonly invites: InviteRepository,
    private readonly economy: EconomyService,
    private readonly quests: QuestRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  /**
   * Evaluate every onboarding quest for the user; for each newly-completed one record it and grant
   * the reward in one SERVICE tx (idempotent via progress unique + ledger refId).
   */
  async evaluateAndGrant(userId: string): Promise<void> {
    if (!(await this.config.get("economy.enabled"))) return;

    const signals = await this.dailySignals.getToday(userId);
    const activePeriodKeys = this.activePeriodKeys(signals);
    const completed = new Set(
      (await this.quests.listForUser(userId, activePeriodKeys)).map((r) =>
        progressKey(r.questId, r.periodKey),
      ),
    );
    const pending = QUEST_CATALOG.filter((q) => {
      const periodKey = this.periodKey(q, signals);
      return !completed.has(progressKey(q.id, periodKey));
    });
    if (pending.length === 0) return;

    // Read the user's state once (self-context reads work for any trigger path — the user's own
    // request, the subscription-activated listener, or the invite-redeem hook).
    const me = await this.users.getMe(userId).catch(() => null);
    if (!me) return;
    const sub = await this.subscriptions.getView(userId);
    const redeemed = await this.invites.findRedemptionByInvited(userId);

    const isMet = (q: QuestDef): boolean => {
      switch (q.id) {
        case "daily.plan-task-done":
          return signals.hasDonePlanTask;
        case "daily.focus-session-completed":
          return signals.hasCompletedFocusSession;
        case "daily.mood-checkin":
          return signals.hasMoodCheckin;
        case "onboarding.profile-setup":
          return me.examType != null;
        case "onboarding.email-verified":
          return me.emailVerified === true;
        case "onboarding.first-subscription":
          return sub.subscription != null;
        case "onboarding.invite-redeemed":
          return redeemed != null;
        default:
          return false;
      }
    };

    const [onboardingRewardCoin, dailyRewardXp] = await Promise.all([
      this.config.get("economy.quest.onboarding_reward_coin"),
      this.config.get("economy.quest.daily_ritual_reward_xp"),
    ]);

    for (const q of pending) {
      if (!isMet(q)) continue;
      const periodKey = this.periodKey(q, signals);
      const reward =
        q.rewardUnit === "XP"
          ? { unit: Currency.XP, amount: dailyRewardXp }
          : q.rewardUnit === "COIN"
            ? { unit: Currency.COIN, amount: onboardingRewardCoin }
            : null;
      try {
        await this.quests.withServiceTx(async (tx) => {
          const row = await this.quests.markCompleted(userId, q.id, periodKey, tx);
          if (!row) return; // concurrent completion already recorded — idempotent
          if (!reward || reward.amount <= 0) return;
          await this.economy.grantInServiceTx(
            userId,
            reward.unit,
            reward.amount,
            {
              reason: `quest.${q.id}`,
              refType: "quest",
              refId: row.id,
              enforceLimits: true,
            },
            tx,
          );
        });
      } catch (err) {
        if (err instanceof DomainError && err.code === ErrorCode.ECONOMY_LIMIT_EXCEEDED) {
          this.logger.log({ userId, questId: q.id }, "quest reward skipped — user over coin cap");
        } else {
          this.logger.error({ err, userId, questId: q.id }, "quest reward failed");
        }
      }
    }
  }

  /** User-facing: lazy-evaluate (grant newly-completed) then return the full catalog with progress. */
  async getUserProgress(userId: string): Promise<QuestProgressView[]> {
    await this.evaluateAndGrant(userId);
    return this.toViews(userId);
  }

  /** Admin: read-only progress (no evaluation/grant). */
  getAdminProgress(userId: string): Promise<QuestProgressView[]> {
    return this.toViews(userId);
  }

  private async toViews(userId: string): Promise<QuestProgressView[]> {
    const signals = await this.dailySignals.getToday(userId);
    const [onboardingRewardCoin, dailyRewardXp, rows] = await Promise.all([
      this.config.get("economy.quest.onboarding_reward_coin"),
      this.config.get("economy.quest.daily_ritual_reward_xp"),
      this.quests.listForUser(userId, this.activePeriodKeys(signals)),
    ]);
    const byKey = new Map(rows.map((r) => [progressKey(r.questId, r.periodKey), r]));
    return QUEST_CATALOG.map((q) => {
      const periodKey = this.periodKey(q, signals);
      const row = byKey.get(progressKey(q.id, periodKey));
      const rewardAmount =
        q.rewardUnit === "XP"
          ? dailyRewardXp
          : q.rewardUnit === "COIN"
            ? onboardingRewardCoin
            : 0;
      return {
        id: q.id,
        category: q.category,
        period: q.period,
        periodKey,
        type: q.type,
        title: q.title,
        badgeLabel: q.badgeLabel,
        action: q.action,
        rewardUnit: q.rewardUnit,
        rewardAmount,
        rewardCoin: q.rewardUnit === "COIN" ? rewardAmount : 0,
        completed: row !== undefined,
        completedAt: row?.completedAt.toISOString() ?? null,
      };
    });
  }

  private periodKey(q: QuestDef, signals: DailyQuestSignals): string {
    return q.type === QuestType.DAILY_RITUAL ? signals.date : QUEST_PERIOD_ONCE;
  }

  private activePeriodKeys(signals: DailyQuestSignals): string[] {
    return [QUEST_PERIOD_ONCE, signals.date];
  }
}

function progressKey(questId: string, periodKey: string): string {
  return `${questId}:${periodKey}`;
}
