import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import {
  SubscriptionsService,
  type AdminSubscriptionView,
} from "../../payments/application/subscriptions.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";
import { RefundSubscriptionDto } from "./admin.dto";

/**
 * Admin subscription tooling (W6) — per-user subscription/trial state + billing ledger, plus two
 * audited money/access actions: a record-only refund (appends a REFUND ledger row; the real money
 * movement is done in the provider panel until the iyzico refund API is wired) and a cancel (ends
 * access at period end). Team-only (ADMIN); consumes the W4 `SubscriptionsService` (public).
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.SUPPORT, UserRole.FINANCE)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/users/:userId/subscription")
export class AdminSubscriptionController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  overview(@Param("userId", ParseUUIDPipe) userId: string): Promise<AdminSubscriptionView> {
    return this.subscriptions.getAdminView(userId);
  }

  /** Record-only refund of the last successful charge (capped to the remaining refundable amount). */
  @Post("refund")
  @Roles(UserRole.FINANCE)
  @Audit(AuditAction.SUBSCRIPTION_REFUND)
  async refund(
    @CurrentUser() actor: RequestUser,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() dto: RefundSubscriptionDto,
    @Req() req: AuditableRequest,
  ): Promise<AdminSubscriptionView> {
    const result = await this.subscriptions.refundLastCharge(userId, dto.amountMinor, dto.reason, actor.id);
    setAuditContext(req, {
      targetType: AuditTargetType.SUBSCRIPTION,
      targetId: userId,
      before: { amountMinor: dto.amountMinor, reason: dto.reason },
      after: {
        subscriptionId: result.subscriptionId,
        refundedMinor: result.amountMinor,
        remainingAfter: result.remainingAfter,
      },
    });
    return result.view;
  }

  /** Cancel the user's subscription (renewal stops; access until period end). Idempotent. */
  @Post("cancel")
  @Roles(UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Audit(AuditAction.SUBSCRIPTION_CANCEL)
  async cancel(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Req() req: AuditableRequest,
  ): Promise<AdminSubscriptionView> {
    await this.subscriptions.cancel(userId);
    setAuditContext(req, { targetType: AuditTargetType.SUBSCRIPTION, targetId: userId });
    return this.subscriptions.getAdminView(userId);
  }
}
