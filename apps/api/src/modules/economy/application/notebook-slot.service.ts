import { HttpStatus, Injectable, type OnModuleInit } from "@nestjs/common";
import type { NotebookSlotView } from "@mentor/types";
import type { NotebookSlotPurchase } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { CoachingEntitlementRegistry } from "../../coaching/application/coaching-entitlement.registry";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { EconomyLedger } from "../domain/economy.constants";
import { LedgerRepository } from "../infrastructure/ledger.repository";
import { NotebookSlotRepository } from "../infrastructure/notebook-slot.repository";
import { EconomyService } from "./economy.service";

/** The immutable debit IS the extra capacity; there is no separate fulfillment step to fail. */
@Injectable()
export class NotebookSlotService implements OnModuleInit {
  constructor(
    private readonly economy: EconomyService,
    private readonly ledger: LedgerRepository,
    private readonly slots: NotebookSlotRepository,
    private readonly coaching: CoachingEntitlementRegistry,
    private readonly entitlement: EntitlementService,
    private readonly config: ConfigRegistryService,
  ) {}

  onModuleInit(): void {
    // Ownership survives economy-off, a lower sale cap, deletion of a notebook and Premium expiry.
    this.coaching.registerNotebookSlots((userId) =>
      this.slots.countPurchased(userId),
    );
  }

  private async policy(userId: string, roles: string[]) {
    if (!(await this.config.get("economy.enabled"))) {
      throw new DomainError(ErrorCode.ECONOMY_DISABLED, HttpStatus.NOT_FOUND);
    }
    const [cost, maxPurchasableSlots, entitlement] = await Promise.all([
      this.config.get("economy.coin.notebook_slot_cost"),
      this.config.get("economy.notebook_slots.max_per_user"),
      this.entitlement.getEntitlement(userId, roles),
    ]);
    return { cost, maxPurchasableSlots, premium: entitlement.isPremium };
  }

  async getState(userId: string, roles: string[]): Promise<NotebookSlotView> {
    const policy = await this.policy(userId, roles);
    const [purchasedSlots, balance] = await Promise.all([
      this.slots.countPurchased(userId),
      this.economy.getSelfBalance(userId),
    ]);
    const canAfford = balance.coinConfirmed >= policy.cost;
    const status = policy.premium
      ? "PREMIUM_INCLUDED"
      : purchasedSlots >= policy.maxPurchasableSlots
        ? "LIMIT_REACHED"
        : canAfford
          ? "AVAILABLE"
          : "INSUFFICIENT_COIN";
    return {
      ...policy,
      purchasedSlots,
      coinConfirmed: balance.coinConfirmed,
      canAfford,
      status,
      canPurchase: status === "AVAILABLE",
    };
  }

  async purchase(
    userId: string,
    roles: string[],
    idempotencyKey: string,
    quote: NotebookSlotPurchase,
  ): Promise<NotebookSlotView> {
    // Pool-backed config and entitlement reads must resolve before holding a transaction client.
    const policy = await this.policy(userId, roles);
    const refType = EconomyLedger.NOTEBOOK_SLOT_REF_TYPE;
    const refId = `${userId}:${idempotencyKey}`;
    await this.ledger.withServiceTx(async (tx) => {
      await this.ledger.acquireUserLock(userId, tx);
      if (await this.ledger.existsByRef(refType, refId, tx)) return;
      if (policy.premium)
        throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
      const purchased = await this.slots.countPurchased(userId, tx);
      if (purchased >= policy.maxPurchasableSlots) {
        throw new DomainError(
          ErrorCode.ECONOMY_LIMIT_EXCEEDED,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (
        policy.cost !== quote.expectedCost ||
        purchased !== quote.expectedPurchasedSlots
      ) {
        throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
      }
      await this.economy.spendInServiceTx(
        userId,
        policy.cost,
        {
          reason: EconomyLedger.NOTEBOOK_SLOT_SPEND_REASON,
          refType,
          refId,
        },
        tx,
      );
    });
    return this.getState(userId, roles);
  }
}
