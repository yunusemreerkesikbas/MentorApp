import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import {
  AdminUsersService,
  type AdminUserDetail,
  type AdminUserView,
} from "../application/admin-users.service";
import { AdminAuditService, type AuditEntryView } from "../application/admin-audit.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";
import { AuditLogQueryDto, SearchUsersQueryDto, UpdateUserStatusDto } from "./admin.dto";

/**
 * Admin user management (W6). Team-only: global JwtAuthGuard + RolesGuard require the ADMIN
 * role; in prod the app also sits behind Cloudflare Access (§9). Every mutation is audited.
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin")
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get("users")
  searchUsers(@Query() query: SearchUsersQueryDto): Promise<AdminUserView[]> {
    return this.users.search(query.q, query.page, query.pageSize);
  }

  @Get("users/:userId")
  getUser(@Param("userId", ParseUUIDPipe) userId: string): Promise<AdminUserDetail> {
    return this.users.getDetail(userId);
  }

  @Patch("users/:userId/status")
  @Audit(AuditAction.USER_STATUS)
  async setStatus(
    @CurrentUser() actor: RequestUser,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: AuditableRequest,
  ): Promise<AdminUserView> {
    const result = await this.users.setStatus(actor.id, userId, dto.status);
    setAuditContext(req, {
      targetType: AuditTargetType.USER,
      targetId: userId,
      before: { status: result.before },
      after: { status: result.after },
    });
    return result.user;
  }

  @Get("users/:userId/export")
  @Audit(AuditAction.USER_KVKK_EXPORT)
  async exportUser(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Req() req: AuditableRequest,
  ): Promise<Record<string, unknown>> {
    const data = await this.users.exportData(userId);
    setAuditContext(req, { targetType: AuditTargetType.USER, targetId: userId });
    return data;
  }

  @Post("users/:userId/anonymize")
  @Audit(AuditAction.USER_KVKK_ANONYMIZE)
  async anonymizeUser(
    @CurrentUser() actor: RequestUser,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Req() req: AuditableRequest,
  ): Promise<AdminUserView> {
    const result = await this.users.anonymize(actor.id, userId);
    // KVKK erasure: record THAT anonymization happened, NOT the scrubbed PII — the audit log is
    // append-only, so storing the old email/name here would defeat the right-to-erasure (§4).
    setAuditContext(req, {
      targetType: AuditTargetType.USER,
      targetId: userId,
      after: { anonymized: true, scrubbedFields: ["email", "displayName", "examType", "examDate"] },
    });
    return result.user;
  }

  @Post("users/:userId/roles/staff")
  @Audit(AuditAction.STAFF_ASSIGN)
  async grantStaff(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Req() req: AuditableRequest,
  ): Promise<AdminUserView> {
    const result = await this.users.grantStaff(userId);
    setAuditContext(req, {
      targetType: AuditTargetType.USER,
      targetId: userId,
      before: { roles: result.before },
      after: { roles: result.after },
    });
    return result.user;
  }

  @Delete("users/:userId/roles/staff")
  @Audit(AuditAction.STAFF_REVOKE)
  async revokeStaff(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Req() req: AuditableRequest,
  ): Promise<AdminUserView> {
    const result = await this.users.revokeStaff(userId);
    setAuditContext(req, {
      targetType: AuditTargetType.USER,
      targetId: userId,
      before: { roles: result.before },
      after: { roles: result.after },
    });
    return result.user;
  }

  @Get("audit-log")
  listAuditLog(@Query() query: AuditLogQueryDto): Promise<AuditEntryView[]> {
    return this.audit.list(query.page, query.pageSize);
  }
}
