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
import type { Paginated } from "@mentor/types";
import { UserRole } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { WaitlistService, type AdminWaitlistEntry } from "../../identity/application/waitlist.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { WaitlistInviteEmailDto, WaitlistListQueryDto } from "./admin.dto";
import { setAuditContext, type AuditableRequest } from "./audit-context";
import { Audit } from "./audit.decorator";

/**
 * Invite-only signup list. The API lets SUPPORT/FINANCE read, but the admin page is in the menu for
 * SUPER_ADMIN and SUPPORT only (menuList.ts); every mutation = SUPPORT and audited. Audit rows
 * carry the entry id and role/status only, never the email (the row is purged after 6 months, the
 * append-only audit log is not).
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.SUPPORT, UserRole.FINANCE)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/waitlist")
export class AdminWaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Get()
  list(@Query() query: WaitlistListQueryDto): Promise<Paginated<AdminWaitlistEntry>> {
    return this.waitlist.list(query);
  }

  // Declared before `:id/invite` so the static path is never read as an id.
  @Post("invite")
  @Roles(UserRole.SUPPORT)
  @Audit(AuditAction.SIGNUP_INVITATION_INVITE)
  async inviteEmail(
    @CurrentUser() actor: RequestUser,
    @Body() dto: WaitlistInviteEmailDto,
    @Req() req: AuditableRequest,
  ): Promise<AdminWaitlistEntry> {
    const entry = await this.waitlist.inviteEmail(dto, actor.id);
    setAuditContext(req, {
      targetType: AuditTargetType.SIGNUP_INVITATION,
      targetId: entry.id,
      after: { role: entry.role, status: entry.status },
    });
    return entry;
  }

  @Post(":id/invite")
  @Roles(UserRole.SUPPORT)
  @Audit(AuditAction.SIGNUP_INVITATION_INVITE)
  async invite(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuditableRequest,
  ): Promise<AdminWaitlistEntry> {
    const entry = await this.waitlist.invite(id, actor.id);
    setAuditContext(req, {
      targetType: AuditTargetType.SIGNUP_INVITATION,
      targetId: id,
      after: { role: entry.role, status: entry.status },
    });
    return entry;
  }

  @Post(":id/resend")
  @HttpCode(204)
  @Roles(UserRole.SUPPORT)
  @Audit(AuditAction.SIGNUP_INVITATION_RESEND)
  async resend(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuditableRequest): Promise<void> {
    await this.waitlist.resend(id);
    setAuditContext(req, { targetType: AuditTargetType.SIGNUP_INVITATION, targetId: id });
  }

  @Delete(":id")
  @HttpCode(204)
  @Roles(UserRole.SUPPORT)
  @Audit(AuditAction.SIGNUP_INVITATION_DELETE)
  async remove(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuditableRequest): Promise<void> {
    await this.waitlist.remove(id);
    setAuditContext(req, { targetType: AuditTargetType.SIGNUP_INVITATION, targetId: id });
  }
}
