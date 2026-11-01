import { Module } from "@nestjs/common";
import { WeeklyRecapPurchasesService } from "./application/weekly-recap-purchases.service";
import { WeeklyRecapPurchasesRepository } from "./infrastructure/weekly-recap-purchases.repository";
import { RewardReceiptService } from "./application/reward-receipt.service";
import { QuestTriggerService } from "./application/quest-trigger.service";
import { RewardReceiptRepository } from "./infrastructure/reward-receipt.repository";
import { CoachingModule } from "../coaching/coaching.module";
import { IdentityModule } from "../identity/identity.module";
import { PaymentsModule } from "../payments/payments.module";
import { DeepAnalysisService } from "./application/deep-analysis.service";
import { EconomyService } from "./application/economy.service";
import { EconomyStatsService } from "./application/economy-stats.service";
import { ForumEventsListener } from "./application/forum-events.listener";
import { ThreadPostedListener } from "./application/thread-posted.listener";
import { InviteService } from "./application/invite.service";
import { InviteViewService } from "./application/invite-view.service";
import { InviteEventsListener } from "./application/invite-events.listener";
import { RefundEventsListener } from "./application/refund-events.listener";
import { QuestService } from "./application/quest.service";
import { WeeklyChestService } from "./application/weekly-chest.service";
import { QuestEventsListener } from "./application/quest-events.listener";
import { StreakRescueService } from "./application/streak-rescue.service";
import { SessionCompletedListener } from "./application/session-completed.listener";
import { LedgerRepository } from "./infrastructure/ledger.repository";
import { InviteRepository } from "./infrastructure/invite.repository";
import { QuestRepository } from "./infrastructure/quest.repository";
import { EconomyController } from "./presentation/economy.controller";
import { InvitePreviewController } from "./presentation/invite-preview.controller";
import { NotebookSlotService } from "./application/notebook-slot.service";
import { NotebookSlotRepository } from "./infrastructure/notebook-slot.repository";
import { NotebookSlotsController } from "./presentation/notebook-slots.controller";
import { EconomyUsesController } from "./presentation/economy-uses.controller";
import { EconomyUsesRegistry } from "./application/economy-uses.registry";
import { EconomyUsesService } from "./application/economy-uses.service";
import { WeeklyAnalysisAccessRegistry } from "./application/weekly-analysis-access.registry";

/**
 * W6 — Light economy (§3). Slice 1: ledger + balances + reward engine + admin adjust. Slice 2a:
 * invite → conversion → coin (listens to payments.subscription.activated; consumes EntitlementService).
 * Earning quests + spending (→ AI right) are later slices. `ConfigRegistryService` is global.
 */
@Module({
  imports: [PaymentsModule, IdentityModule, CoachingModule],
  controllers: [EconomyController, InvitePreviewController, NotebookSlotsController, EconomyUsesController],
  providers: [
    WeeklyRecapPurchasesService,
    WeeklyRecapPurchasesRepository,
    RewardReceiptService,
    QuestTriggerService,
    RewardReceiptRepository,
    EconomyService,
    NotebookSlotService,
    EconomyUsesRegistry,
    WeeklyAnalysisAccessRegistry,
    EconomyUsesService,
    NotebookSlotRepository,
    EconomyStatsService,
    LedgerRepository,
    InviteService,
    InviteViewService,
    InviteRepository,
    InviteEventsListener,
    RefundEventsListener,
    QuestService,
    WeeklyChestService,
    QuestRepository,
    QuestEventsListener,
    StreakRescueService,
    DeepAnalysisService,
    SessionCompletedListener,
    ForumEventsListener,
    ThreadPostedListener,
  ],
  exports: [
    WeeklyRecapPurchasesService,
    WeeklyAnalysisAccessRegistry,
    EconomyUsesRegistry,
    EconomyService,
    EconomyStatsService,
    InviteService,
    QuestService,
    DeepAnalysisService,
  ],
})
export class EconomyModule {}
