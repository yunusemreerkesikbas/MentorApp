import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { EconomyService } from "./application/economy.service";
import { InviteService } from "./application/invite.service";
import { InviteEventsListener } from "./application/invite-events.listener";
import { LedgerRepository } from "./infrastructure/ledger.repository";
import { InviteRepository } from "./infrastructure/invite.repository";
import { EconomyController } from "./presentation/economy.controller";

/**
 * W6 — Light economy (§3). Slice 1: ledger + balances + reward engine + admin adjust. Slice 2a:
 * invite → conversion → coin (listens to payments.subscription.activated; consumes EntitlementService).
 * Earning quests + spending (→ AI right) are later slices. `ConfigRegistryService` is global.
 */
@Module({
  imports: [PaymentsModule],
  controllers: [EconomyController],
  providers: [
    EconomyService,
    LedgerRepository,
    InviteService,
    InviteRepository,
    InviteEventsListener,
  ],
  exports: [EconomyService, InviteService],
})
export class EconomyModule {}
