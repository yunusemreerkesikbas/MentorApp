import { Module } from "@nestjs/common";
import { AccountModule } from "../account/account.module";
import { AiModule } from "../ai/ai.module";
import { ContentModule } from "../content/content.module";
import { EconomyModule } from "../economy/economy.module";
import { IdentityModule } from "../identity/identity.module";
import { PaymentsModule } from "../payments/payments.module";
import { CoachingModule } from "../coaching/coaching.module";
import { ForumModule } from "../forum/forum.module";
import { AdminAuditService } from "./application/admin-audit.service";
import { AdminUsersService } from "./application/admin-users.service";
import { AdminAuditRepository } from "./infrastructure/admin-audit.repository";
import { AdminUsersRepository } from "./infrastructure/admin-users.repository";
import { AdminAuditInterceptor } from "./presentation/admin-audit.interceptor";
import { AdminConfigController } from "./presentation/admin-config.controller";
import { AdminContentController } from "./presentation/admin-content.controller";
import { AdminEconomyController } from "./presentation/admin-economy.controller";
import { AdminExamCalendarController } from "./presentation/admin-exam-calendar.controller";
import { AdminMetricsController } from "./presentation/admin-metrics.controller";
import { AdminPlansController } from "./presentation/admin-plans.controller";
import { AdminSubscriptionController } from "./presentation/admin-subscription.controller";
import { AdminUsersController } from "./presentation/admin-users.controller";
import { AdminForumController } from "./presentation/admin-forum.controller";

/**
 * W6 — Admin (team-only, §9). First slice: STAFF role assignment + audit-log foundation.
 * Admin operations run cross-user in SERVICE context (repositories), gated by `@Roles(ADMIN)`.
 *
 * `AdminAuditService` is exported so later admin sub-features (content editor, refund, flags)
 * reuse the same append-only audit trail. Economy (coin/XP/invite/quest) lands in a later slice.
 */
@Module({
  // AiModule → cost/feedback metrics; AccountModule → the shared KVKK erasure path (anonymize).
  imports: [
    IdentityModule,
    EconomyModule,
    ContentModule,
    PaymentsModule,
    AiModule,
    AccountModule,
    CoachingModule,
    ForumModule,
  ],
  controllers: [
    AdminUsersController,
    AdminConfigController,
    AdminEconomyController,
    AdminContentController,
    AdminExamCalendarController,
    AdminSubscriptionController,
    AdminPlansController,
    AdminMetricsController,
    AdminForumController,
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
