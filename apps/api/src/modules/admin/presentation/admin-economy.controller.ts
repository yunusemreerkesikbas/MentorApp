import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole, type Currency } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { EconomyService } from "../../economy/application/economy.service";
import { InviteService, type InviteSummary } from "../../economy/application/invite.service";
import type { Balance } from "../../economy/infrastructure/ledger.repository";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";
import { AdjustEconomyDto } from "./admin.dto";

/**
 * Admin economy tooling (W6). Manual ledger adjustment = a support/correction, so it BYPASSES the
 * organic coin caps (enforceLimits:false) but is always audited. Reads a user's balance + recent
 * ledger. Team-only; flag-independent (admin tool, not the user-facing feature).
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/users/:userId/economy")
export class AdminEconomyController {
  constructor(
    private readonly economy: EconomyService,
    private readonly invites: InviteService,
  ) {}

  @Get()
  async overview(@Param("userId", ParseUUIDPipe) userId: string): Promise<{
    balance: Balance;
    ledger: Awaited<ReturnType<EconomyService["getAdminLedger"]>>;
    invite: InviteSummary;
  }> {
    const [balance, ledger, invite] = await Promise.all([
      this.economy.getAdminBalance(userId),
      this.economy.getAdminLedger(userId, 20),
      this.invites.summary(userId),
    ]);
    return { balance, ledger, invite };
  }

  @Post("adjust")
  @Audit(AuditAction.ECONOMY_ADJUST)
  async adjust(
    @CurrentUser() actor: RequestUser,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() dto: AdjustEconomyDto,
    @Req() req: AuditableRequest,
  ): Promise<Balance> {
    const before = await this.economy.getAdminBalance(userId);
    const after = await this.economy.grant(userId, dto.unit as Currency, dto.amount, {
      reason: dto.reason,
      note: dto.note,
      actorId: actor.id,
      enforceLimits: false,
    });
    setAuditContext(req, {
      targetType: AuditTargetType.USER,
      targetId: userId,
      before: { balance: before, unit: dto.unit, amount: dto.amount },
      after: { balance: after },
    });
    return after;
  }
}
