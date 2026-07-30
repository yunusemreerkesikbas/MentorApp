import { Injectable, Logger } from "@nestjs/common";
import { Currency, type QuestProgressView } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import {
  DailyQuestSignalService,
  type DailyQuestSignals,
} from "../../coaching/application/daily-quest-signal.service";
import { StreakService } from "../../coaching/application/streak.service";
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
    private readonly streak: StreakService,
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

    const [signals, streak, cfg] = await Promise.all([
      this.dailySignals.getToday(userId),
      this.streak.getSummary(userId),
      this.readQuestConfig(),
    ]);
    const activePeriodKeys = this.activePeriodKeys(signals);
    const completed = new Set(
      (await this.quests.listForUser(userId, activePeriodKeys)).map((r) =>
        progressKey(r.questId, r.periodKey),
      ),
    );
    const pending = QUEST_CATALOG.filter((q) => {
      if (cfg.disabledIds.has(q.id)) return false; // admin kill-switch
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
      if (q.type === QuestType.MILESTONE || q.type === QuestType.WEEKLY_RITUAL) {
        return sourceCurrent(q, signals, streak.currentStreak) >= questTarget(q, cfg.targets);
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

    for (const q of pending) {
      if (!isMet(q)) continue;
      const periodKey = this.periodKey(q, signals);
      const reward =
        q.rewardUnit === "XP"
          ? { unit: Currency.XP, amount: xpReward(q, cfg) }
          : q.rewardUnit === "COIN"
            ? { unit: Currency.COIN, amount: coinReward(q, cfg) }
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
    const [signals, streak, cfg] = await Promise.all([
      this.dailySignals.getToday(userId),
      this.streak.getSummary(userId),
      this.readQuestConfig(),
    ]);
    const rows = await this.quests.listForUser(userId, this.activePeriodKeys(signals));
    const byKey = new Map(rows.map((r) => [progressKey(r.questId, r.periodKey), r]));
    // The goal quest only exists for users who chose a goal — no default target.
    const visible = QUEST_CATALOG.filter(
      (q) =>
        !cfg.disabledIds.has(q.id) &&
        (q.id !== "daily.focus-goal-met" || signals.dailyFocusGoalMinutes != null),
    );
    return visible.map((q) => {
      const periodKey = this.periodKey(q, signals);
      const row = byKey.get(progressKey(q.id, periodKey));
      const rewardAmount =
        q.rewardUnit === "XP" ? xpReward(q, cfg) : q.rewardUnit === "COIN" ? coinReward(q, cfg) : 0;
      const hasTarget = q.progressTarget != null || q.targetConfigKey != null;
      const target = hasTarget ? questTarget(q, cfg.targets) : undefined;
      return {
        id: q.id,
        category: q.category,
        period: q.period,
        periodKey,
        type: q.type,
        title: target != null ? q.title.replace("{target}", String(target)) : q.title,
        badgeLabel: q.badgeLabel,
        action: q.action,
        rewardUnit: q.rewardUnit,
        rewardAmount,
        rewardCoin: q.rewardUnit === "COIN" ? rewardAmount : 0,
        progressCurrent:
          target != null
            ? row
              ? target
              : Math.min(sourceCurrent(q, signals, streak.currentStreak), target)
            : undefined,
        progressTarget: target,
        completed: row !== undefined,
        completedAt: row?.completedAt.toISOString() ?? null,
      };
    });
  }

  /** All quest-related config in one batch (rewards, weekly targets, kill-switch list). */
  private async readQuestConfig(): Promise<QuestConfig> {
    const [
      onboardingRewardCoin,
      dailyRewardXp,
      streakMilestoneRewardXp,
      effortMilestoneRewardXp,
      weeklyRitualRewardXp,
      weeklyAllowanceRewardCoin,
      weeklyFocusTarget,
      weeklyPlanTarget,
      weeklyAllowanceTarget,
      disabledCsv,
    ] = await Promise.all([
      this.config.get("economy.quest.onboarding_reward_coin"),
      this.config.get("economy.quest.daily_ritual_reward_xp"),
      this.config.get("economy.quest.streak_milestone_reward_xp"),
      this.config.get("economy.quest.effort_milestone_reward_xp"),
      this.config.get("economy.quest.weekly_ritual_reward_xp"),
      this.config.get("economy.quest.weekly_allowance_reward_coin"),
      this.config.get("economy.quest.weekly_focus_sessions_target"),
      this.config.get("economy.quest.weekly_plan_tasks_target"),
      this.config.get("economy.quest.weekly_allowance_active_days_target"),
      this.config.get("economy.quest.disabled_ids"),
    ]);
    return {
      onboardingRewardCoin,
      dailyRewardXp,
      streakMilestoneRewardXp,
      effortMilestoneRewardXp,
      weeklyRitualRewardXp,
      weeklyAllowanceRewardCoin,
      targets: new Map([
        ["economy.quest.weekly_focus_sessions_target", weeklyFocusTarget],
        ["economy.quest.weekly_plan_tasks_target", weeklyPlanTarget],
        ["economy.quest.weekly_allowance_active_days_target", weeklyAllowanceTarget],
      ]),
      disabledIds: new Set(
        disabledCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    };
  }

  private periodKey(q: QuestDef, signals: DailyQuestSignals): string {
    if (q.type === QuestType.DAILY_RITUAL) return signals.date;
    if (q.type === QuestType.WEEKLY_RITUAL) return signals.weekKey;
    return QUEST_PERIOD_ONCE;
  }

  private activePeriodKeys(signals: DailyQuestSignals): string[] {
    return [QUEST_PERIOD_ONCE, signals.date, signals.weekKey];
  }
}

interface QuestConfig {
  onboardingRewardCoin: number;
  dailyRewardXp: number;
  streakMilestoneRewardXp: number;
  effortMilestoneRewardXp: number;
  weeklyRitualRewardXp: number;
  /** The recurring coin faucet's payout (weekly effort allowance). */
  weeklyAllowanceRewardCoin: number;
  /** targetConfigKey → resolved value (admin-tunable weekly targets). */
  targets: Map<string, number>;
  disabledIds: Set<string>;
}

function progressKey(questId: string, periodKey: string): string {
  return `${questId}:${periodKey}`;
}

/** The quest's completion target: config-resolved when `targetConfigKey` is set. */
function questTarget(q: QuestDef, targets: Map<string, number>): number {
  const fromConfig = q.targetConfigKey ? targets.get(q.targetConfigKey) : undefined;
  return fromConfig ?? q.progressTarget ?? Number.POSITIVE_INFINITY;
}

function sourceCurrent(q: QuestDef, signals: DailyQuestSignals, currentStreak: number): number {
  switch (q.progressSource) {
    case "streak":
      return currentStreak;
    case "completed_focus_sessions":
      return signals.completedFocusSessions;
    case "completed_plan_tasks":
      return signals.completedPlanTasks;
    case "weekly_focus_sessions":
      return signals.weeklyCompletedFocusSessions;
    case "weekly_plan_tasks":
      return signals.weeklyCompletedPlanTasks;
    case "weekly_active_days":
      return signals.weeklyActiveDays;
    default:
      return 0;
  }
}

function xpReward(q: QuestDef, cfg: QuestConfig): number {
  if (q.type === QuestType.WEEKLY_RITUAL) return cfg.weeklyRitualRewardXp;
  if (q.type !== QuestType.MILESTONE) return cfg.dailyRewardXp;
  return q.progressSource === "streak" ? cfg.streakMilestoneRewardXp : cfg.effortMilestoneRewardXp;
}

/** Symmetric to `xpReward` — without it every COIN quest would silently pay the onboarding amount. */
function coinReward(q: QuestDef, cfg: QuestConfig): number {
  return q.type === QuestType.WEEKLY_RITUAL
    ? cfg.weeklyAllowanceRewardCoin
    : cfg.onboardingRewardCoin;
}
