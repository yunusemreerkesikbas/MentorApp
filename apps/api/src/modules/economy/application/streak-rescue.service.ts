import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Currency, type StreakRescueView } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { StreakService } from "../../coaching/application/streak.service";
import { EconomyLedger } from "../domain/economy.constants";
import { EconomyService } from "./economy.service";

/**
 * Streak-rescue coin sink (§3 light economy): buy a freeze for the single-gap day the streak
 * derivation broke on (the gap the free monthly pool couldn't cover). Orchestration only —
 * eligibility rules live in coaching (StreakService), the debit in the ledger. Spend first, then
 * apply; an apply failure triggers a compensating refund (same pattern as the AI-chat spend).
 * Economy → coaching direction only.
 */
@Injectable()
export class StreakRescueService {
  private readonly logger = new Logger(StreakRescueService.name);

  constructor(
    private readonly economy: EconomyService,
    private readonly streak: StreakService,
    private readonly config: ConfigRegistryService,
  ) {}

  /** Rescue offer for the gate UI: eligibility + cost + whether the balance covers it. */
  async getState(userId: string): Promise<StreakRescueView> {
    const [{ eligible, date }, cost, balance] = await Promise.all([
      this.streak.getFreezeRescueState(userId),
      this.config.get("economy.coin.streak_freeze_cost"),
      this.economy.getSelfBalance(userId),
    ]);
    return {
      eligible,
      date,
      cost,
      coinConfirmed: balance.coinConfirmed,
      canAfford: balance.coinConfirmed >= cost,
    };
  }

  /**
   * Spend coin and freeze yesterday. Idempotent end-to-end: the spend dedupes on
   * (streak_freeze, userId:date) and the freeze insert on (userId, date) — a retry of a
   * half-applied purchase completes the apply without a second debit.
   */
  async purchase(userId: string): Promise<StreakRescueView> {
    const { eligible, date } = await this.streak.getFreezeRescueState(userId);
    if (!eligible || !date) {
      throw new DomainError(ErrorCode.STREAK_RESCUE_NOT_ELIGIBLE, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const cost = await this.config.get("economy.coin.streak_freeze_cost");
    const refId = `${userId}:${date}`;
    const { alreadySpent } = await this.economy.spend(userId, cost, {
      reason: EconomyLedger.STREAK_FREEZE_SPEND_REASON,
      refType: EconomyLedger.STREAK_FREEZE_REF_TYPE,
      refId,
    });
    try {
      await this.streak.applyPurchasedFreeze(userId, date);
    } catch (err) {
      // Refund only a debit made by THIS call — a retried half-applied purchase keeps its spend.
      if (!alreadySpent) {
        await this.economy
          .grant(userId, Currency.COIN, cost, {
            reason: EconomyLedger.STREAK_FREEZE_REFUND_REASON,
            refType: EconomyLedger.STREAK_FREEZE_REFUND_REF_TYPE,
            refId,
            enforceLimits: false,
          })
          .catch((refundErr) => {
            this.logger.error(`Streak-freeze refund failed: ${String(refundErr)}`);
          });
      }
      throw err;
    }
    return this.getState(userId);
  }
}
