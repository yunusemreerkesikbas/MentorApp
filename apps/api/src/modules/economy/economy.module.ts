import { Module } from "@nestjs/common";
import { EconomyService } from "./application/economy.service";
import { LedgerRepository } from "./infrastructure/ledger.repository";
import { EconomyController } from "./presentation/economy.controller";

/**
 * W6 — Light economy (§3). Slice 1: append-only ledger + balances + reward engine (capped) + user
 * reads + admin manual adjust (admin module consumes `EconomyService`). Earning automation
 * (quests/invite) and spending (→ AI right) are later slices. `ConfigRegistryService` is global.
 */
@Module({
  controllers: [EconomyController],
  providers: [EconomyService, LedgerRepository],
  exports: [EconomyService],
})
export class EconomyModule {}
