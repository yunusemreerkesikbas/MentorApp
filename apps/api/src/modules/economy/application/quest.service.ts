import { Injectable, Logger } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { Currency, type QuestProgressView } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DailyQuestSignalService } from "../../coaching/application/daily-quest-signal.service";
import { StreakService } from "../../coaching/application/streak.service";
import { UsersService } from "../../identity/application/users.service";
import { SubscriptionsService } from "../../payments/application/subscriptions.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { EconomyService } from "./economy.service";
import { resolveEconomyLang } from "./economy-lang";
import { readQuestConfig } from "./quest-config";
import { InviteRepository } from "../infrastructure/invite.repository";
import { QuestRepository } from "../infrastructure/quest.repository";
import { toQuestViews } from "./quest-view";
import {
  QUEST_CATALOG,
  QuestType,
  type QuestDef,
} from "../domain/quest.catalog";

import {
  progressKey,
  questPeriodKey,
  activeQuestPeriodKeys,
  questTarget,
  sourceCurrent,
  xpReward,
  coinReward,
  isEconomyAction,
  rewardUnitFor,
} from "./quest-progress";

export type { QuestProgressView };

/**
 * Quests (§3 light economy). Conditions are evaluated by READING other modules' public services
 * (identity/payments/coaching) + economy's own invite repo — no cross-module table access
 * (workstreams §3). A newly-completed quest grants XP/Coin via the idempotent reward engine.
 * Completion is always recorded; `economy.enabled` gates rewards only.
 */
@Injectable()
export class QuestService {
  private readonly logger = new Logger(QuestService.name);

  constructor(
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly dailySignals: DailyQuestSignalService,
    private readonly streak: StreakService,
    private readonly invites: InviteRepository,
    private readonly economy: EconomyService,
    private readonly quests: QuestRepository,
    private readonly config: ConfigRegistryService,
    private readonly i18n: I18nService,
    private readonly entitlement: EntitlementService,
  ) {}

  private async isPremium(userId: string): Promise<boolean> {
    return (await this.entitlement.getEntitlement(userId)).isPremium;
  }

  /**
   * Evaluate every onboarding quest for the user; for each newly-completed one record it and grant
   * the reward in one SERVICE tx (idempotent via progress unique + ledger refId).
   * Returns period-scoped keys for met steps whose Coin grant is waiting on earning conditions.
   */
  async evaluateAndGrant(
    userId: string,
    date?: string,
    strict = false,
  ): Promise<string[]> {
    const pendingRewards: string[] = [];
    const rewardsEnabled = await this.config.get("economy.enabled");

    const [signals, streak, cfg, isPremium] = await Promise.all([
      date
        ? this.dailySignals.getForDate(userId, date)
        : this.dailySignals.getToday(userId),
      date
        ? this.streak.getStreakAt(userId, date)
        : this.streak.getSummary(userId),
      readQuestConfig(this.config),
      this.isPremium(userId),
    ]);
    const activePeriodKeys = activeQuestPeriodKeys(signals);
    const completed = new Set(
      (await this.quests.listForUser(userId, activePeriodKeys)).map((r) =>
        progressKey(r.questId, r.periodKey),
      ),
    );
    const pending = QUEST_CATALOG.filter((q) => {
      if (cfg.disabledIds.has(q.id) || (!rewardsEnabled && isEconomyAction(q)))
        return false;
      // Hidden for Premium: not recorded either, so a lapse later the same day can still earn it.
      if (rewardUnitFor(q, isPremium) === null) return false;
      const periodKey = questPeriodKey(q, signals);
      return !completed.has(progressKey(q.id, periodKey));
    });
    if (pending.length === 0) return pendingRewards;

    // Read the user's state once (self-context reads work for any trigger path — the user's own
    // request, the subscription-activated listener, or the invite-redeem hook).
    const me = strict
      ? await this.users.getMe(userId)
      : await this.users.getMe(userId).catch(() => null);
    if (!me) return pendingRewards;
    const sub = await this.subscriptions.getView(userId);
    const redeemed = await this.invites.findRedemptionByInvited(userId);

    const isMet = (q: QuestDef): boolean => {
      if (
        q.type === QuestType.MILESTONE ||
        q.type === QuestType.WEEKLY_RITUAL
      ) {
        return (
          sourceCurrent(q, signals, streak.currentStreak) >=
          questTarget(q, cfg.targets)
        );
      }
      switch (q.id) {
        case "daily.plan-task-done":
          return signals.hasDonePlanTask;
        case "daily.focus-session-completed":
          return signals.hasCompletedFocusSession;
        case "daily.focus-goal-met":
          return (
            signals.dailyFocusGoalMinutes != null &&
            signals.focusMinutesToday >= signals.dailyFocusGoalMinutes
          );
        case "daily.mood-checkin":
          return signals.hasMoodCheckin;
        case "daily.active-day":
          return signals.weeklyActiveDates.includes(signals.date);
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

    let xpChanged = false;
    for (const q of pending) {
      if (!isMet(q)) continue;
      const periodKey = questPeriodKey(q, signals);
      const unit = rewardUnitFor(q, isPremium);
      const reward =
        rewardsEnabled && unit === "XP"
          ? { unit: Currency.XP, amount: xpReward(q, cfg) }
          : rewardsEnabled && unit === "COIN"
            ? { unit: Currency.COIN, amount: coinReward(q, cfg) }
            : null;
      try {
        const committedXpGrant = await this.quests.withServiceTx(async (tx) => {
          const row = await this.quests.markCompleted(
            userId,
            q.id,
            periodKey,
            tx,
          );
          if (!row) return false; // concurrent completion already recorded — idempotent
          if (!reward || reward.amount <= 0) return false;
          const inserted = await this.economy.grantInServiceTx(
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
          return inserted && reward.unit === Currency.XP;
        });
        if (committedXpGrant) xpChanged = true;
      } catch (err) {
        if (
          err instanceof DomainError &&
          err.code === ErrorCode.ECONOMY_LIMIT_EXCEEDED
        ) {
          pendingRewards.push(progressKey(q.id, periodKey));
          this.logger.log(
            { userId, questId: q.id },
            "quest reward skipped — user over coin cap",
          );
        } else {
          this.logger.error(
            { err, userId, questId: q.id },
            "quest reward failed",
          );
          if (strict) throw err;
        }
      }
    }
    if (xpChanged) {
      await this.economy.publishXpChanged(userId).catch((err: unknown) => {
        this.logger.warn(
          { err, userId },
          "journey-level realtime cue could not be published",
        );
      });
    }
    return pendingRewards;
  }

  /** User-facing: lazy-evaluate (grant newly-completed) then return the full catalog with progress. */
  async getUserProgress(userId: string): Promise<QuestProgressView[]> {
    const pendingRewards = await this.evaluateAndGrant(userId);
    return this.toViews(userId, pendingRewards);
  }

  /** Admin: read-only progress (no evaluation/grant). */
  getAdminProgress(userId: string): Promise<QuestProgressView[]> {
    return this.toViews(userId);
  }

  private async toViews(
    userId: string,
    pendingRewards: readonly string[] = [],
  ): Promise<QuestProgressView[]> {
    const [signals, streak, cfg, rewardsEnabled, isPremium] = await Promise.all([
      this.dailySignals.getToday(userId),
      this.streak.getSummary(userId),
      readQuestConfig(this.config),
      this.config.get("economy.enabled"),
      this.isPremium(userId),
    ]);
    const rows = await this.quests.listForUser(
      userId,
      activeQuestPeriodKeys(signals),
    );
    const lang = resolveEconomyLang();
    const t = (key: string, args: Record<string, unknown> = {}) =>
      String(this.i18n.translate(`economy.${key}`, { lang, args }));
    return toQuestViews({
      signals,
      currentStreak: streak.currentStreak,
      cfg,
      rewardsEnabled,
      isPremium,
      rows,
      pendingRewards,
      t,
    });
  }
}
