import { Module } from "@nestjs/common";
import { ContentModule } from "../content/content.module";
import { EconomyModule } from "../economy/economy.module";
import { IdentityModule } from "../identity/identity.module";
import { AdminAuditService } from "./application/admin-audit.service";
import { AdminUsersService } from "./application/admin-users.service";
import { AdminAuditRepository } from "./infrastructure/admin-audit.repository";
import { AdminUsersRepository } from "./infrastructure/admin-users.repository";
import { AdminAuditInterceptor } from "./presentation/admin-audit.interceptor";
import { AdminConfigController } from "./presentation/admin-config.controller";
import { AdminContentController } from "./presentation/admin-content.controller";
import { AdminEconomyController } from "./presentation/admin-economy.controller";
import { AdminUsersController } from "./presentation/admin-users.controller";

/**
 * W6 — Admin (team-only, §9). First slice: STAFF role assignment + audit-log foundation.
 * Admin operations run cross-user in SERVICE context (repositories), gated by `@Roles(ADMIN)`.
 *
 * `AdminAuditService` is exported so later admin sub-features (content editor, refund, flags)
 * reuse the same append-only audit trail. Economy (coin/XP/invite/quest) lands in a later slice.
 */
@Module({
  imports: [IdentityModule, EconomyModule, ContentModule],
  controllers: [
    AdminUsersController,
    AdminConfigController,
    AdminEconomyController,
    AdminContentController,
  ],
  providers: [
    AdminUsersService,
    AdminAuditService,
    AdminUsersRepository,
    AdminAuditRepository,
    AdminAuditInterceptor,
  ],
  exports: [AdminAuditService],
})
export class AdminModule {}
