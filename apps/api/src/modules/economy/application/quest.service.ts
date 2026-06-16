import { Injectable, Logger } from "@nestjs/common";
import { Currency } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { UsersService } from "../../identity/application/users.service";
import { SubscriptionsService } from "../../payments/application/subscriptions.service";
import { EconomyService } from "./economy.service";
import { InviteRepository } from "../infrastructure/invite.repository";
import { QuestRepository } from "../infrastructure/quest.repository";
import { QUEST_CATALOG, type QuestDef } from "../domain/quest.catalog";

export interface QuestProgressView {
  id: string;
  type: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
}

/**
 * Onboarding quests (§3 light economy). Conditions are evaluated by READING other modules' public
 * services (identity/payments) + economy's own invite repo — no cross-module table access
 * (workstreams §3). A newly-completed quest grants coin via the capped/idempotent reward engine
 * (same as invite reward). Gated by `economy.enabled`. Habit/milestone tiers = backlog.
 */
@Injectable()
export class QuestService {
  private readonly logger = new Logger(QuestService.name);

  constructor(
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly invites: InviteRepository,
    private readonly economy: EconomyService,
    private readonly quests: QuestRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  /**
   * Evaluate every onboarding quest for the user; for each newly-completed one record it and grant
   * the reward (idempotent via progress unique + ledger refId; cap denial is logged, not fatal).
   */
  async evaluateAndGrant(userId: string): Promise<void> {
    if (!(await this.config.get("economy.enabled"))) return;

    const completed = new Set((await this.quests.listForUser(userId)).map((r) => r.questId));
    const pending = QUEST_CATALOG.filter((q) => !completed.has(q.id));
    if (pending.length === 0) return;

    // Read the user's state once (self-context reads work for any trigger path — the user's own
    // request, the subscription-activated listener, or the invite-redeem hook).
    const me = await this.users.getMe(userId).catch(() => null);
    if (!me) return;
    const sub = await this.subscriptions.getView(userId);
    const redeemed = await this.invites.findRedemptionByInvited(userId);

    const isMet = (q: QuestDef): boolean => {
      switch (q.id) {
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

    const reward = await this.config.get("economy.quest.onboarding_reward_coin");

    for (const q of pending) {
      if (!isMet(q)) continue;
      const row = await this.quests.markCompleted(userId, q.id);
      if (!row) continue; // concurrent completion already recorded — idempotent
      if (reward <= 0) continue;
      try {
        await this.economy.grant(userId, Currency.COIN, reward, {
          reason: `quest.${q.id}`,
          refType: "quest",
          refId: row.id,
          enforceLimits: true,
        });
      } catch (err) {
        if (err instanceof DomainError && err.code === ErrorCode.ECONOMY_LIMIT_EXCEEDED) {
          this.logger.log({ userId, questId: q.id }, "quest reward skipped — user over coin cap");
        } else {
          this.logger.error({ err, userId, questId: q.id }, "quest reward failed (completion recorded)");
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
    const byId = new Map((await this.quests.listForUser(userId)).map((r) => [r.questId, r]));
    return QUEST_CATALOG.map((q) => {
      const row = byId.get(q.id);
      return {
        id: q.id,
        type: q.type,
        title: q.title,
        completed: row !== undefined,
        completedAt: row?.completedAt.toISOString() ?? null,
      };
    });
  }
}
