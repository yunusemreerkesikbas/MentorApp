import { Body, Controller, Delete, Get, Param, Put, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { adAnnouncementParamsSchema, approveAdQuestionSchema } from "@mentor/validation";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { createZodDto } from "../../../common/validation/zod-dto";
import { AdsAnnouncementReviewService } from "../../ads/application/ads-announcement-review.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";

class AnnouncementParamsDto extends createZodDto(adAnnouncementParamsSchema) {}
class ApproveAnnouncementDto extends createZodDto(approveAdQuestionSchema) {}

@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.EDITOR)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/ads/announcements")
export class AdminAdAnnouncementsController {
  constructor(private readonly reviews: AdsAnnouncementReviewService) {}
  @Get(":threadId")
  preview(@Param() params: AnnouncementParamsDto, @CurrentUser() actor: RequestUser) { return this.reviews.preview(params.threadId, actor); }
  @Put(":threadId")
  @Audit(AuditAction.AD_ANNOUNCEMENT_APPROVE)
  async approve(@Param() params: AnnouncementParamsDto, @Body() body: ApproveAnnouncementDto,
    @CurrentUser() actor: RequestUser, @Req() req: AuditableRequest) {
    const before = await this.reviews.preview(params.threadId, actor);
    const after = await this.reviews.approve(params.threadId, actor, body.contentRevision);
    setAuditContext(req, { targetType: AuditTargetType.FORUM_THREAD, targetId: params.threadId, before: before.approval, after: after.approval });
    return after;
  }
  @Delete(":threadId")
  @Audit(AuditAction.AD_ANNOUNCEMENT_REVOKE)
  async revoke(@Param() params: AnnouncementParamsDto, @CurrentUser() actor: RequestUser, @Req() req: AuditableRequest) {
    const before = await this.reviews.preview(params.threadId, actor);
    await this.reviews.revoke(params.threadId);
    setAuditContext(req, { targetType: AuditTargetType.FORUM_THREAD, targetId: params.threadId, before: before.approval, after: null });
    return { revoked: true };
  }
}
