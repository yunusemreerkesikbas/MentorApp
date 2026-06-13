import { Body, Controller, Get, Param, Patch, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import {
  ConfigRegistryService,
  type ConfigEntryView,
} from "../../../common/config/config-registry.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";
import { UpdateConfigDto } from "./admin.dto";

/**
 * Admin config registry + feature flags (W6, §9). Team-only (`@Roles(ADMIN)`); every write audited.
 * The catalog is code-defined (admins can't invent keys); values are validated against each key's
 * Zod schema server-side.
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/config")
export class AdminConfigController {
  constructor(private readonly config: ConfigRegistryService) {}

  @Get()
  list(): Promise<ConfigEntryView[]> {
    return this.config.list();
  }

  @Patch(":key")
  @Audit(AuditAction.CONFIG_UPDATE)
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("key") key: string,
    @Body() dto: UpdateConfigDto,
    @Req() req: AuditableRequest,
  ): Promise<ConfigEntryView[]> {
    const result = await this.config.set(actor.id, key, dto.value);
    setAuditContext(req, {
      targetType: AuditTargetType.CONFIG,
      targetId: key,
      before: { value: result.before },
      after: { value: result.after },
    });
    return this.config.list();
  }
}
