import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { type ForumFeaturedAdminView, type ForumTagView, UserRole } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { ForumDiscoveryService } from "../../forum/application/forum-discovery.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import {
  AdminForumTagCreateDto,
  AdminForumTagUpdateDto,
  SetFeaturedThreadDto,
} from "./admin.dto";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";

@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.EDITOR)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/forum")
export class AdminForumController {
  constructor(private readonly forum: ForumDiscoveryService) {}

  @Get("tags")
  tags(): Promise<ForumTagView[]> {
    return this.forum.listAdminTags();
  }

  @Post("tags")
  @Audit(AuditAction.FORUM_TAG_CREATE)
  async createTag(
    @CurrentUser() actor: RequestUser,
    @Body() body: AdminForumTagCreateDto,
    @Req() req: AuditableRequest,
  ): Promise<ForumTagView> {
    const created = await this.forum.createAdminTag(actor.id, body);
    setAuditContext(req, {
      targetType: AuditTargetType.FORUM_TAG,
      targetId: created.id,
      before: null,
      after: created,
    });
    return created;
  }

  @Patch("tags/:tagId")
  @Audit(AuditAction.FORUM_TAG_UPDATE)
  async updateTag(
    @CurrentUser() actor: RequestUser,
    @Param("tagId") tagId: string,
    @Body() body: AdminForumTagUpdateDto,
    @Req() req: AuditableRequest,
  ): Promise<ForumTagView> {
    const before = (await this.forum.listAdminTags()).find((tag) => tag.id === tagId) ?? null;
    const after = await this.forum.updateAdminTag(actor.id, tagId, body);
    setAuditContext(req, {
      targetType: AuditTargetType.FORUM_TAG,
      targetId: tagId,
      before,
      after,
    });
    return after;
  }

  @Get("featured-thread")
  featuredThread(): Promise<ForumFeaturedAdminView | null> {
    return this.forum.getAdminFeatured();
  }

  @Put("featured-thread")
  @Audit(AuditAction.FORUM_FEATURED_SET)
  async setFeaturedThread(
    @CurrentUser() actor: RequestUser,
    @Body() body: SetFeaturedThreadDto,
    @Req() req: AuditableRequest,
  ): Promise<ForumFeaturedAdminView> {
    const before = await this.forum.getAdminFeatured();
    const after = await this.forum.setAdminFeatured(actor.id, body);
    setAuditContext(req, {
      targetType: AuditTargetType.FORUM_THREAD,
      targetId: after.threadId,
      before,
      after,
    });
    return after;
  }

  @Delete("featured-thread")
  @HttpCode(204)
  @Audit(AuditAction.FORUM_FEATURED_CLEAR)
  async clearFeaturedThread(@Req() req: AuditableRequest): Promise<void> {
    const before = await this.forum.getAdminFeatured();
    await this.forum.clearAdminFeatured();
    setAuditContext(req, {
      targetType: AuditTargetType.FORUM_THREAD,
      targetId: before?.threadId,
      before,
      after: null,
    });
  }
}
