import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { UsersService, type UserStats } from "../../identity/application/users.service";
import {
  SubscriptionsService,
  type SubscriptionStats,
} from "../../payments/application/subscriptions.service";
import { EconomyService } from "../../economy/application/economy.service";
import { InviteService } from "../../economy/application/invite.service";

interface AdminMetrics {
  users: UserStats;
  subscriptions: SubscriptionStats;
  economy: { coinIssued: number; xpIssued: number; invite: { invited: number; converted: number } };
  generatedAt: string;
}

/**
 * Admin metrics dashboard (W6) — a read-only KPI snapshot aggregating each module's public stats
 * service (users · subscriptions/revenue · economy). Team-only (ADMIN); no mutation, so no audit.
 * Cross-tenant aggregates run in SERVICE context inside each module. LLM-cost/coaching = backlog.
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller("admin/metrics")
export class AdminMetricsController {
  constructor(
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly economy: EconomyService,
    private readonly invites: InviteService,
  ) {}

  @Get()
  async overview(): Promise<AdminMetrics> {
    const [users, subscriptions, economy, invite] = await Promise.all([
      this.users.getUserStats(),
      this.subscriptions.getSubscriptionStats(),
      this.economy.getEconomyStats(),
      this.invites.getGlobalStats(),
    ]);
    return {
      users,
      subscriptions,
      economy: { ...economy, invite },
      generatedAt: new Date().toISOString(),
    };
  }
}
