import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  UserRole,
  type AdminAiCostDto,
  type AdminCoachFeedbackDto,
  type AdminEconomyStatsDto,
} from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { UsersService, type UserStats } from "../../identity/application/users.service";
import {
  SubscriptionsService,
  type SubscriptionStats,
} from "../../payments/application/subscriptions.service";
import { EconomyService } from "../../economy/application/economy.service";
import { EconomyStatsService } from "../../economy/application/economy-stats.service";
import { InviteService } from "../../economy/application/invite.service";
import { AiCostStatsService } from "../../ai/application/ai-cost-stats.service";
import { CoachFeedbackStatsService } from "../../ai/application/coach-feedback-stats.service";
import { SessionService } from "../../coaching/application/session.service";

interface AdminMetrics {
  users: UserStats;
  subscriptions: SubscriptionStats;
  economy: { coinIssued: number; xpIssued: number; invite: { invited: number; converted: number } };
  coaching: {
    activeUsers7d: number;
    repeatUsers7d: number;
    repeatRate7d: number;
  };
  generatedAt: string;
}

/**
 * Admin metrics dashboard (W6) — a read-only KPI snapshot aggregating each module's public stats
 * service (users · subscriptions/revenue · economy). Team-only (ADMIN); no mutation, so no audit.
 * Cross-tenant aggregates run in SERVICE context inside each module. LLM-cost/coaching = backlog.
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.SUPPORT, UserRole.FINANCE)
@Controller("admin/metrics")
export class AdminMetricsController {
  constructor(
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly economy: EconomyService,
    private readonly economyStatsService: EconomyStatsService,
    private readonly invites: InviteService,
    private readonly aiCost: AiCostStatsService,
    private readonly coachFeedback: CoachFeedbackStatsService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async overview(): Promise<AdminMetrics> {
    const [users, subscriptions, economy, invite, coaching] = await Promise.all([
      this.users.getUserStats(),
      this.subscriptions.getSubscriptionStats(),
      this.economy.getEconomyStats(),
      this.invites.getGlobalStats(),
      this.sessions.getSessionRepeatStats(),
    ]);
    return {
      users,
      subscriptions,
      economy: { ...economy, invite },
      coaching,
      generatedAt: new Date().toISOString(),
    };
  }

  /** LLM cost visibility (§7): rolling-window totals + per-model + top spenders (admin-only PII). */
  @Get("ai")
  aiCostStats(): Promise<AdminAiCostDto> {
    return this.aiCost.getCostStats();
  }

  /**
   * Economy visibility (§3): coin/XP faucet + sink breakdown, outstanding float, faucet reach —
   * the measurements the earning rates are calibrated from (roadmap §729). Flag-independent.
   */
  @Get("economy")
  economyStats(): Promise<AdminEconomyStatsDto> {
    return this.economyStatsService.getStats();
  }

  /** Coach reply satisfaction: 👍/👎 rate + recent 👎 replies with their question (admin-only text). */
  @Get("coach-feedback")
  coachFeedbackStats(): Promise<AdminCoachFeedbackDto> {
    return this.coachFeedback.getFeedbackStats();
  }
}
