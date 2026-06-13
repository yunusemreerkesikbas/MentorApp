import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { AdminUsersService, type AdminUserView } from "../application/admin-users.service";
import { AdminAuditService, type AuditEntryView } from "../application/admin-audit.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";
import { AuditLogQueryDto, SearchUsersQueryDto } from "./admin.dto";

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
