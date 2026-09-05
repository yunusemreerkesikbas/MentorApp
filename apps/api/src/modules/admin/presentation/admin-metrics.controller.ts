import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  UserRole,
  type AdminAiCostDto,
  type AdminCoachFeedbackDto,
  type AdminEconomyStatsDto,
  type AdminSponsorshipStatsDto,
} from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { UsersService, type UserStats } from "../../identity/application/users.service";
import {
  SubscriptionsService,
  type SubscriptionStats,
} from "../../payments/application/subscriptions.service";
import {
  SponsoredSeatService,
  SPONSORED_SEAT_METRIC_LIMIT,
  costPerSeatMicros,
} from "../../payments/application/sponsored-seat.service";
import { EconomyService } from "../../economy/application/economy.service";
import { EconomyStatsService } from "../../economy/application/economy-stats.service";
import { InviteService } from "../../economy/application/invite.service";
import { AiCostStatsService } from "../../ai/application/ai-cost-stats.service";
import { CoachFeedbackStatsService } from "../../ai/application/coach-feedback-stats.service";
import { SessionService } from "../../coaching/application/session.service";
import { AdsStatsService } from "../../ads/application/ads-stats.service";

interface AdminMetrics {
  users: UserStats;
  subscriptions: SubscriptionStats;
  economy: { coinIssued: number; xpIssued: number; invite: { invited: number; converted: number } };
  coaching: {
    activeUsers7d: number;
    repeatUsers7d: number;
    repeatRate7d: number;
  };
  ads: { created: number; rewarded: number; closed: number; expired: number; rejected: number; uniqueUsers: number; coinGranted: number };
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
    private readonly ads: AdsStatsService,
    private readonly seats: SponsoredSeatService,
    private readonly config: ConfigRegistryService,
  ) {}

  @Get()
  async overview(): Promise<AdminMetrics> {
    const [users, subscriptions, economy, invite, coaching, ads] = await Promise.all([
      this.users.getUserStats(),
      this.subscriptions.getSubscriptionStats(),
      this.economy.getEconomyStats(),
      this.invites.getGlobalStats(),
      this.sessions.getSessionRepeatStats(),
      this.ads.getStats(),
    ]);
    return {
      users,
      subscriptions,
      economy: { ...economy, invite },
      coaching,
      ads,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * What the coach-sponsored Premium giveaway is costing (W8 seats).
   *
   * Composed here rather than in either module because the answer needs both halves and their
   * tables must not meet: payments knows WHICH users hold a seat, the AI meter knows what those
   * users spent. Admin is the surface allowed to hold both at once, so it asks each in turn.
   */
  @Get("sponsorship")
  async sponsorshipStats(): Promise<AdminSponsorshipStatsDto> {
    const [userIds, freeSeatsPerCoach, sponsorshipEnabled] = await Promise.all([
      this.seats.listSeatUserIds(),
      this.config.get("mentorship.coach.free_seats"),
      this.config.get("mentorship.seats.sponsorship_enabled"),
    ]);
    const costMicros = await this.aiCost.costForUsers(userIds);
    return {
      seats: userIds.length,
      freeSeatsPerCoach,
      sponsorshipEnabled,
      costMicros,
      costPerSeatMicros30d: costPerSeatMicros(costMicros.d30, userIds.length),
      // The ceiling was reached, so the costs above are a floor, not a total.
      truncated: userIds.length >= SPONSORED_SEAT_METRIC_LIMIT,
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
