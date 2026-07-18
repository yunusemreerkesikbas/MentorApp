import { Module } from "@nestjs/common";
import { CoachingModule } from "../coaching/coaching.module";
import { IdentityModule } from "../identity/identity.module";
import { PaymentsModule } from "../payments/payments.module";
import { EconomyService } from "./application/economy.service";
import { ForumEventsListener } from "./application/forum-events.listener";
import { ThreadPostedListener } from "./application/thread-posted.listener";
import { InviteService } from "./application/invite.service";
import { InviteEventsListener } from "./application/invite-events.listener";
import { QuestService } from "./application/quest.service";
import { QuestEventsListener } from "./application/quest-events.listener";
import { StreakRescueService } from "./application/streak-rescue.service";
import { SessionCompletedListener } from "./application/session-completed.listener";
import { LedgerRepository } from "./infrastructure/ledger.repository";
import { InviteRepository } from "./infrastructure/invite.repository";
import { QuestRepository } from "./infrastructure/quest.repository";
import { EconomyController } from "./presentation/economy.controller";

/**
 * W6 — Light economy (§3). Slice 1: ledger + balances + reward engine + admin adjust. Slice 2a:
 * invite → conversion → coin (listens to payments.subscription.activated; consumes EntitlementService).
 * Earning quests + spending (→ AI right) are later slices. `ConfigRegistryService` is global.
 */
@Module({
  imports: [PaymentsModule, IdentityModule, CoachingModule],
  controllers: [EconomyController],
  providers: [
    EconomyService,
    LedgerRepository,
    InviteService,
    InviteRepository,
    InviteEventsListener,
    QuestService,
    QuestRepository,
    QuestEventsListener,
    StreakRescueService,
    SessionCompletedListener,
    ForumEventsListener,
    ThreadPostedListener,
  ],
  exports: [EconomyService, InviteService, QuestService],
})
export class EconomyModule {}
