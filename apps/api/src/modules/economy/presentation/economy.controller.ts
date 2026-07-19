import { Body, Controller, Get, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { DeepAnalysisView, EconomyLedgerEntryView, StreakRescueView } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DeepAnalysisService } from "../application/deep-analysis.service";
import { EconomyService } from "../application/economy.service";
import { InviteService } from "../application/invite.service";
import { QuestService, type QuestProgressView } from "../application/quest.service";
import { StreakRescueService } from "../application/streak-rescue.service";
import type { Balance } from "../infrastructure/ledger.repository";
import { DeepAnalysisDto, EconomyLedgerQueryDto, RedeemInviteDto } from "./economy.dto";
import { toLedgerEntryView } from "./ledger-entry-view";

/**
 * User-facing economy reads (W6). Self-scoped (user-context RLS). Gated by the `economy.enabled`
 * feature flag — when off the feature is dormant (404), since the economy isn't user-facing yet.
 */
@ApiTags("economy")
@ApiBearerAuth()
@Controller("economy")
export class EconomyController {
  constructor(
    private readonly economy: EconomyService,
    private readonly invites: InviteService,
    private readonly quests: QuestService,
    private readonly streakRescue: StreakRescueService,
    private readonly deepAnalysis: DeepAnalysisService,
    private readonly config: ConfigRegistryService,
  ) {}

  private async assertEnabled(): Promise<void> {
    if (!(await this.config.get("economy.enabled"))) {
      throw new DomainError(ErrorCode.ECONOMY_DISABLED, HttpStatus.NOT_FOUND);
    }
  }

  @Get("balance")
  async balance(@CurrentUser() user: RequestUser): Promise<Balance> {
    await this.assertEnabled();
    return this.economy.getSelfBalance(user.id);
  }

  @Get("ledger")
  async ledger(
    @CurrentUser() user: RequestUser,
    @Query() query: EconomyLedgerQueryDto,
  ): Promise<EconomyLedgerEntryView[]> {
    await this.assertEnabled();
    const rows = await this.economy.getSelfLedger(user.id, query.page, query.pageSize);
    return rows.map(toLedgerEntryView);
  }

  @Get("invite")
  async invite(@CurrentUser() user: RequestUser): Promise<{ code: string }> {
    await this.assertEnabled();
    return { code: await this.invites.getOrCreateCode(user.id) };
  }

  /** Onboarding quests + progress (lazy-evaluates and grants newly-completed ones). */
  @Get("quests")
  async questsList(@CurrentUser() user: RequestUser): Promise<QuestProgressView[]> {
    await this.assertEnabled();
    return this.quests.getUserProgress(user.id);
  }

  /** Streak-rescue offer (coin sink): can yesterday be frozen, at what cost. */
  @Get("streak-rescue")
  async streakRescueState(@CurrentUser() user: RequestUser): Promise<StreakRescueView> {
    await this.assertEnabled();
    return this.streakRescue.getState(user.id);
  }

  /** Buy the freeze for yesterday (idempotent; 422 when not eligible / insufficient coin). */
  @Post("streak-rescue")
  async streakRescuePurchase(@CurrentUser() user: RequestUser): Promise<StreakRescueView> {
    await this.assertEnabled();
    return this.streakRescue.purchase(user.id);
  }

  /** Deep-analysis unlock state (coin sink): review eligibility + cost + unlock. */
  @Get("deep-analysis")
  async deepAnalysisState(
    @CurrentUser() user: RequestUser,
    @Query() query: DeepAnalysisDto,
  ): Promise<DeepAnalysisView> {
    await this.assertEnabled();
    return this.deepAnalysis.getState(user.id, user.roles, query.examId);
  }

  /** Unlock this week's deep analysis (idempotent; 422 when not eligible / insufficient coin). */
  @Post("deep-analysis")
  async deepAnalysisPurchase(
    @CurrentUser() user: RequestUser,
    @Body() dto: DeepAnalysisDto,
  ): Promise<DeepAnalysisView> {
    await this.assertEnabled();
    return this.deepAnalysis.purchase(user.id, user.roles, dto.examId);
  }

  @Post("invite/redeem")
  async redeem(
    @CurrentUser() user: RequestUser,
    @Body() dto: RedeemInviteDto,
  ): Promise<{ status: string }> {
    await this.assertEnabled();
    return this.invites.redeem(user.id, dto.code);
  }
}
