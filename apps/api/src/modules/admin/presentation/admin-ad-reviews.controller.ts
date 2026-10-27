import { Body, Controller, Delete, Get, Param, Put, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { adQuestionParamsSchema, approveAdQuestionSchema } from "@mentor/validation";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { createZodDto } from "../../../common/validation/zod-dto";
import { AdsQuestionReviewService } from "../../ads/application/ads-question-review.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";

class QuestionParamsDto extends createZodDto(adQuestionParamsSchema) {}
class ApproveQuestionDto extends createZodDto(approveAdQuestionSchema) {}

@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.EDITOR)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/ads/questions")
export class AdminAdReviewsController {
  constructor(private readonly reviews: AdsQuestionReviewService) {}

  @Get(":questionId")
  preview(@Param() params: QuestionParamsDto) { return this.reviews.preview(params.questionId); }

  @Get(":questionId/community")
  previewCommunity(@Param() params: QuestionParamsDto, @CurrentUser() actor: RequestUser) {
    return this.reviews.previewCommunity(params.questionId, actor);
  }

  @Put(":questionId/community")
  @Audit(AuditAction.AD_COMMUNITY_QUESTION_APPROVE)
  async approveCommunity(@Param() params: QuestionParamsDto, @Body() body: ApproveQuestionDto,
    @CurrentUser() actor: RequestUser, @Req() req: AuditableRequest) {
    const before = await this.reviews.previewCommunity(params.questionId, actor);
    const after = await this.reviews.approveCommunity(params.questionId, actor, body.contentRevision);
    this.audit(req, params.questionId, before.approval, after.approval);
    return after;
  }

  @Delete(":questionId/community")
  @Audit(AuditAction.AD_COMMUNITY_QUESTION_REVOKE)
  async revokeCommunity(@Param() params: QuestionParamsDto, @CurrentUser() actor: RequestUser, @Req() req: AuditableRequest) {
    const before = await this.reviews.previewCommunity(params.questionId, actor);
    await this.reviews.revokeCommunity(params.questionId);
    this.audit(req, params.questionId, before.approval, null);
    return { revoked: true };
  }

  @Put(":questionId")
  @Audit(AuditAction.AD_QUESTION_APPROVE)
  async approve(@Param() params: QuestionParamsDto, @Body() body: ApproveQuestionDto,
    @CurrentUser() actor: RequestUser, @Req() req: AuditableRequest) {
    const before = await this.reviews.preview(params.questionId);
    const after = await this.reviews.approve(params.questionId, actor.id, body.contentRevision);
    this.audit(req, params.questionId, before.approval, after.approval);
    return after;
  }

  @Delete(":questionId")
  @Audit(AuditAction.AD_QUESTION_REVOKE)
  async revoke(@Param() params: QuestionParamsDto, @Req() req: AuditableRequest) {
    const before = await this.reviews.preview(params.questionId);
    await this.reviews.revoke(params.questionId);
    this.audit(req, params.questionId, before.approval, null);
    return { revoked: true };
  }

  private audit(req: AuditableRequest, questionId: string, before: unknown, after: unknown) {
    // Audit metadata only; never copy user-written question/answer bodies into the audit log.
    setAuditContext(req, { targetType: AuditTargetType.FORUM_THREAD, targetId: questionId, before, after });
  }
}
