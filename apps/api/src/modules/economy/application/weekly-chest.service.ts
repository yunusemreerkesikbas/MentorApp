import { HttpStatus, Injectable } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import type { WeeklyChestView } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { DailyQuestSignalService } from "../../coaching/application/daily-quest-signal.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { addDays, isoWeekKey, isoWeekStart, todayIso } from "../../coaching/domain/date.util";
import { QUEST_CATALOG, type QuestDef } from "../domain/quest.catalog";
import { LedgerRepository } from "../infrastructure/ledger.repository";
import { QuestRepository, type QuestProgressRow } from "../infrastructure/quest.repository";
import { resolveEconomyLang } from "./economy-lang";
import { readQuestConfig } from "./quest-config";
import { coinReward, progressKey, questTarget, rewardUnitFor, xpReward, type QuestConfig } from "./quest-progress";
import { QuestService } from "./quest.service";
import { RewardReceiptService } from "./reward-receipt.service";

const CHEST_ID = "weekly.effort-allowance";
const CHEST = QUEST_CATALOG.find((q) => q.id === CHEST_ID) as QuestDef;

/** This week and last week: the only two chests a user can see (an unopened one waits one week). */
interface ChestWeeks {
  today: string;
  thisWeek: string;
  lastWeek: string;
  lastSunday: string;
  cfg: QuestConfig;
  rewardsEnabled: boolean;
  isPremium: boolean;
  rows: Map<string, QuestProgressRow>;
}

const notFound = () => new DomainError(ErrorCode.WEEKLY_CHEST_NOT_FOUND, HttpStatus.NOT_FOUND);

/**
 * The weekly chest (`weekly.effort-allowance`) as one tappable object. The Coin grant stays in
 * `QuestService` (automatic, capped, idempotent); this only adds the "opened" moment on top.
 */
@Injectable()
export class WeeklyChestService {
  constructor(
    private readonly quests: QuestService,
    private readonly signals: DailyQuestSignalService,
    private readonly progress: QuestRepository,
    private readonly ledger: LedgerRepository,
    private readonly receipts: RewardReceiptService,
    private readonly config: ConfigRegistryService,
    private readonly i18n: I18nService,
    private readonly entitlement: EntitlementService,
  ) {}

  /** Lazy-evaluates like the quest list, then shows last week's unopened chest first, else this week's. */
  async getView(userId: string): Promise<WeeklyChestView> {
    const pending = await this.quests.evaluateAndGrant(userId);
    let weeks = await this.loadWeeks(userId);
    if (!weeks.rows.has(weeks.lastWeek)) {
      pending.push(...await this.quests.evaluateAndGrant(userId, weeks.lastSunday));
      weeks = await this.loadWeeks(userId);
    }
    const carried = weeks.rows.get(weeks.lastWeek);
    const periodKey = (carried && !carried.revealedAt) || pending.includes(progressKey(CHEST_ID, weeks.lastWeek))
      ? weeks.lastWeek : weeks.thisWeek;
    return this.view(userId, weeks, periodKey, pending);
  }

  /** Idempotent reveal and receipt acknowledgement; missing grants are delegated to QuestService. */
  async open(userId: string, periodKey: string): Promise<WeeklyChestView> {
    let weeks = await this.loadWeeks(userId);
    if (periodKey !== weeks.thisWeek && periodKey !== weeks.lastWeek) throw notFound();
    let row = weeks.rows.get(periodKey);
    if (!row) {
      // ponytail: a cap-held chest has no row until its Coin lands; show the note, stamp nothing.
      const pending = periodKey === weeks.thisWeek
        ? await this.quests.evaluateAndGrant(userId)
        : await this.quests.evaluateAndGrant(userId, weeks.lastSunday);
      weeks = await this.loadWeeks(userId);
      row = weeks.rows.get(periodKey);
      if (!row) {
        if (!pending.includes(progressKey(CHEST_ID, periodKey))) throw notFound();
        return this.view(userId, weeks, periodKey, pending);
      }
    }
    if (!row.revealedAt) {
      await this.progress.markRevealed(userId, row.id);
      weeks.rows.set(periodKey, { ...row, revealedAt: new Date() });
    }
    const entry = await this.ledger.findByRef("quest", row.id);
    if (entry) await this.receipts.markSeen(userId, [entry.id]);
    return this.view(userId, weeks, periodKey, []);
  }

  private async loadWeeks(userId: string): Promise<ChestWeeks> {
    const today = todayIso();
    const lastSunday = addDays(isoWeekStart(today), -1);
    const thisWeek = isoWeekKey(today);
    const lastWeek = isoWeekKey(lastSunday);
    const [cfg, rewardsEnabled, rows, entitlement] = await Promise.all([
      readQuestConfig(this.config),
      this.config.get("economy.enabled"),
      this.progress.listForUser(userId, [thisWeek, lastWeek]),
      this.entitlement.getEntitlement(userId),
    ]);
    if (cfg.disabledIds.has(CHEST_ID)) throw notFound();
    const chestRows = rows.filter((r) => r.questId === CHEST_ID).map((r) => [r.periodKey, r] as const);
    return {
      today,
      thisWeek,
      lastWeek,
      lastSunday,
      cfg,
      rewardsEnabled,
      isPremium: entitlement.isPremium,
      rows: new Map(chestRows),
    };
  }

  private async view(
    userId: string,
    weeks: ChestWeeks,
    periodKey: string,
    pending: readonly string[],
  ): Promise<WeeklyChestView> {
    const date = periodKey === weeks.thisWeek ? weeks.today : weeks.lastSunday;
    const signals = await this.signals.getForDate(userId, date);
    const row = weeks.rows.get(periodKey);
    const waiting = !row && pending.includes(progressKey(CHEST_ID, periodKey));
    const state = row ? (row.revealedAt ? "OPENED" : "READY") : waiting ? "READY" : "PROGRESS";
    const weekStart = isoWeekStart(date);
    const active = new Set(signals.weeklyActiveDates);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => ({
      date: day,
      active: active.has(day),
    }));
    return {
      state,
      periodKey,
      carriedOver: periodKey === weeks.lastWeek,
      current: signals.weeklyActiveDays,
      target: questTarget(CHEST, weeks.cfg.targets),
      days,
      today: weeks.today,
      reward: await this.reward(weeks, row, waiting),
      ...(waiting ? { rewardPendingMessage: this.pendingMessage() } : {}),
      ...(state === "PROGRESS"
        ? {}
        : {
            summary: {
              activeDays: signals.weeklyActiveDays,
              focusSessions: signals.weeklyCompletedFocusSessions,
              planTasks: signals.weeklyCompletedPlanTasks,
              focusMinutes: signals.weeklyFocusMinutes,
            },
          }),
    };
  }

  /** What was really granted (ledger), or what the week will grant; null with the economy off. */
  private async reward(
    weeks: ChestWeeks,
    row: QuestProgressRow | undefined,
    waiting: boolean,
  ): Promise<WeeklyChestView["reward"]> {
    if (!weeks.rewardsEnabled || waiting) return null;
    if (!row) {
      const unit = rewardUnitFor(CHEST, weeks.isPremium) === "XP" ? "XP" : "COIN";
      const amount = unit === "XP" ? xpReward(CHEST, weeks.cfg) : coinReward(CHEST, weeks.cfg);
      return amount > 0 ? { unit, amount } : null;
    }
    const entry = await this.ledger.findByRef("quest", row.id);
    return entry ? { unit: entry.unit === "XP" ? "XP" : "COIN", amount: entry.amount } : null;
  }

  private pendingMessage(): string {
    return String(this.i18n.translate("economy.questRewardPending", { lang: resolveEconomyLang() }));
  }
}
