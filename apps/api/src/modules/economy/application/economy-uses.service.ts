import { HttpStatus, Injectable } from "@nestjs/common";
import type { EconomyUsesView } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { NotebookSlotService } from "./notebook-slot.service";
import { EconomyUsesRegistry } from "./economy-uses.registry";

@Injectable()
export class EconomyUsesService {
  constructor(
    private readonly slots: NotebookSlotService,
    private readonly ai: EconomyUsesRegistry,
    private readonly config: ConfigRegistryService,
  ) {}
  async getView(userId: string, roles: string[]): Promise<EconomyUsesView> {
    if (!(await this.config.get("economy.enabled"))) {
      throw new DomainError(ErrorCode.ECONOMY_DISABLED, HttpStatus.NOT_FOUND);
    }
    const slots = await this.slots.getState(userId, roles);
    const ai = await this.ai.resolve(userId, roles, slots.coinConfirmed);
    return {
      coinConfirmed: slots.coinConfirmed,
      items: [
        {
          id: "NOTEBOOK_SLOT",
          status: slots.status,
          cost: slots.premium ? null : slots.cost,
          premiumIncluded: slots.premium,
          canOpen: true,
          slotsOwned: slots.purchasedSlots,
          slotLimit: slots.maxPurchasableSlots,
        },
        ...ai,
      ],
    };
  }
}
