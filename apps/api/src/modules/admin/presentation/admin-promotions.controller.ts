import { Body, Controller, Get, Param, Patch, Post, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { adminCreatePromotionSchema, adminUpdatePromotionSchema } from "@mentor/validation";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { NotFoundError } from "../../../common/errors/domain-error";
import { createZodDto } from "../../../common/validation/zod-dto";
import {
  PromotionsService,
  type AdminPromotionDto,
} from "../../promotions/application/promotions.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";

class CreatePromotionDto extends createZodDto(adminCreatePromotionSchema) {}
class UpdatePromotionDto extends createZodDto(adminUpdatePromotionSchema) {}

/**
 * Promotion catalog (W6). FINANCE + audited, same discipline as `admin/plans`: a promotion moves
 * money, so every mutation leaves a before/after trail.
 *
 * Deactivation is `PATCH { isActive: false }` — there is no delete. A promotion with redemptions
 * behind it is part of the billing record, and its `code` is only unique among ACTIVE rows, so
 * retiring one already frees the code for reuse.
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.FINANCE)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/promotions")
export class AdminPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list(): Promise<AdminPromotionDto[]> {
    return this.promotions.listAdmin();
  }

  @Get(":id")
  async get(@Param("id") id: string): Promise<AdminPromotionDto> {
    const row = await this.promotions.getAdmin(id);
    if (!row) throw new NotFoundError();
    return row;
  }

  @Post()
  @Audit(AuditAction.PROMOTION_CREATE)
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePromotionDto,
    @Req() req: AuditableRequest,
  ): Promise<AdminPromotionDto> {
    const after = await this.promotions.createAdmin(dto, user.id);
    setAuditContext(req, {
      targetType: AuditTargetType.PROMOTION,
      targetId: after.id,
      before: null,
      after,
    });
    return after;
  }

  @Patch(":id")
  @Audit(AuditAction.PROMOTION_UPDATE)
  async update(
    @Param("id") id: string,
    @Body() dto: UpdatePromotionDto,
    @Req() req: AuditableRequest,
  ): Promise<AdminPromotionDto> {
    const before = await this.promotions.getAdmin(id);
    if (!before) throw new NotFoundError();
    const after = await this.promotions.updateAdmin(id, dto);
    if (!after) throw new NotFoundError();
    setAuditContext(req, {
      targetType: AuditTargetType.PROMOTION,
      targetId: id,
      before,
      after,
    });
    return after;
  }
}
