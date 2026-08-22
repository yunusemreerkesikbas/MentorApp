import { Body, Controller, Get, Param, Patch, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import {
  SubscriptionsService,
  type AdminPlanDto,
} from "../../payments/application/subscriptions.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";
import { UpdatePlanDto } from "./admin.dto";

@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.FINANCE)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/plans")
export class AdminPlansController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(): Promise<AdminPlanDto[]> {
    return this.subscriptions.listAllPlans();
  }

  @Patch(":id")
  @Audit(AuditAction.PLAN_UPDATE)
  async update(
    @Param("id") id: string,
    @Body() dto: UpdatePlanDto,
    @Req() req: AuditableRequest,
  ): Promise<AdminPlanDto> {
    const before = await this.subscriptions.getAdminPlan(id);
    const after = await this.subscriptions.updatePlan(id, dto);
    setAuditContext(req, {
      targetType: AuditTargetType.PLAN,
      targetId: id,
      before: before ?? null,
      after,
    });
    return after;
  }
}
