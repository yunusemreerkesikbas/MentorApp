import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AdsModule } from "../ads/ads.module";
import { CoachingModule } from "../coaching/coaching.module";
import { ForumModule } from "../forum/forum.module";
import { IdentityModule } from "../identity/identity.module";
import { MentorshipModule } from "../mentorship/mentorship.module";
import { PaymentsModule } from "../payments/payments.module";
import { AccountErasureService } from "./application/account-erasure.service";
import { AccountController } from "./presentation/account.controller";

/**
 * Account lifecycle — a thin cross-cutting module whose only job today is KVKK erasure.
 *
 * It exists because the erasure must sequence identity + ai + coaching + forum + notifications +
 * payments, and identity is
 * foundational (every module imports it) — hosting the orchestration there would create a cycle.
 * Nothing imports this module except `AdminModule`, which reuses the same service for its anonymize
 * action, so there is exactly one erasure path.
 */
@Module({
  // NotificationsModule is @Global — its NotificationsErasureService resolves without an import here.
  imports: [
    IdentityModule,
    AiModule,
    AdsModule,
    CoachingModule,
    PaymentsModule,
    ForumModule,
    MentorshipModule,
  ],
  controllers: [AccountController],
  providers: [AccountErasureService],
  exports: [AccountErasureService],
})
export class AccountModule {}
