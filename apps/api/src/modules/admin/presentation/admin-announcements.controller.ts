import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole, type AdminAnnouncementDto } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { AnnouncementService } from "../../notifications/application/announcement.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";
import { AuditLogQueryDto, CreateAnnouncementDto, SendAnnouncementDto } from "./admin.dto";

/**
 * Team-authored broadcast (W5 announcements on an admin surface). SUPER_ADMIN only: a send
 * reaches every ACTIVE user in the target cohort, so the blast radius matches the config editor
 * rather than the content editor. `AnnouncementService` is owned by the notifications module —
 * admin consumes the public service and never touches `announcements` directly (workstreams §3).
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/announcements")
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get()
  list(@Query() query: AuditLogQueryDto): Promise<AdminAnnouncementDto[]> {
    return this.announcements.list(query.page);
  }

  @Post()
  @Audit(AuditAction.ANNOUNCEMENT_CREATE)
  async create(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: RequestUser,
    @Req() req: AuditableRequest,
  ): Promise<AdminAnnouncementDto> {
    const created = await this.announcements.create(dto, user.id);
    setAuditContext(req, {
      targetType: AuditTargetType.ANNOUNCEMENT,
      targetId: created.id,
      before: null,
      after: created,
    });
    return created;
  }

  @Post(":id/send")
  @Audit(AuditAction.ANNOUNCEMENT_SEND)
  async send(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SendAnnouncementDto,
    @Req() req: AuditableRequest,
  ): Promise<AdminAnnouncementDto> {
    const before = await this.announcements.findOne(id);
    const after = await this.announcements.send(id, dto);
    setAuditContext(req, {
      targetType: AuditTargetType.ANNOUNCEMENT,
      targetId: id,
      before: before ?? null,
      after,
    });
    return after;
  }

  @Delete(":id")
  @HttpCode(204)
  @Audit(AuditAction.ANNOUNCEMENT_DELETE)
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuditableRequest,
  ): Promise<void> {
    const before = await this.announcements.findOne(id);
    await this.announcements.deleteDraft(id);
    setAuditContext(req, {
      targetType: AuditTargetType.ANNOUNCEMENT,
      targetId: id,
      before: before ?? null,
      after: null,
    });
  }
}
