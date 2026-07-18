import { HttpStatus, Injectable } from "@nestjs/common";
import type { DeepAnalysisView } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { WeeklyReviewService } from "../../coaching/application/weekly-review.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { EconomyLedger } from "../domain/economy.constants";
import { LedgerRepository } from "../infrastructure/ledger.repository";
import { EconomyService } from "./economy.service";

/**
 * Deep-analysis coin sink (§3): a free user unlocks the premium weekly-review AI narration for one
 * (exam, ISO week) by spending coin. The purchase IS the durable unlock — the ledger spend row
 * (deep_analysis, userId:examId:weekStart) is the unlock state, no extra table and no apply step;
 * a narration failure after purchase retries free (streak-rescue precedent, minus the refund leg).
 * Premium users are included and never debited. Economy → coaching/payments direction only.
 */
@Injectable()
export class DeepAnalysisService {
  constructor(
    private readonly economy: EconomyService,
    private readonly ledger: LedgerRepository,
    private readonly weeklyReview: WeeklyReviewService,
    private readonly entitlement: EntitlementService,
    private readonly config: ConfigRegistryService,
  ) {}

  /** Unlock state for the gate UI: eligibility (review READY) + cost + balance + unlock. */
  async getState(userId: string, roles: string[], examId: string): Promise<DeepAnalysisView> {
    const [review, cost, balance, entitlement] = await Promise.all([
      this.weeklyReview.getReview(userId, examId),
      this.config.get("economy.coin.deep_analysis_cost"),
      this.economy.getSelfBalance(userId),
      this.entitlement.getEntitlement(userId, roles),
    ]);
    const eligible = review.status === "READY";
    const weekStart = eligible ? review.period.startDate : null;
    const unlocked =
      entitlement.isPremium ||
      (weekStart != null && (await this.isUnlocked(userId, examId, weekStart)));
    return {
      eligible,
      weekStart,
      cost,
      coinConfirmed: balance.coinConfirmed,
      canAfford: balance.coinConfirmed >= cost,
      unlocked,
      premium: entitlement.isPremium,
    };
  }

  /**
   * Spend coin to unlock this week's deep analysis. Idempotent: a repeat purchase of the same
   * (exam, week) dedupes on the ledger ref and never double-debits. Premium → no debit.
   */
  async purchase(userId: string, roles: string[], examId: string): Promise<DeepAnalysisView> {
    const state = await this.getState(userId, roles, examId);
    if (state.unlocked) return state; // premium or already purchased — nothing to debit
    if (!state.eligible || !state.weekStart) {
      throw new DomainError(ErrorCode.DEEP_ANALYSIS_NOT_ELIGIBLE, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    await this.economy.spend(userId, state.cost, {
      reason: EconomyLedger.DEEP_ANALYSIS_SPEND_REASON,
      refType: EconomyLedger.DEEP_ANALYSIS_REF_TYPE,
      refId: deepAnalysisRefId(userId, examId, state.weekStart),
    });
    return this.getState(userId, roles, examId);
  }

  /** For the AI narration gate: was this (exam, week) purchased? (Premium bypasses this check.) */
  isUnlocked(userId: string, examId: string, weekStart: string): Promise<boolean> {
    return this.ledger.existsByRef(
      EconomyLedger.DEEP_ANALYSIS_REF_TYPE,
      deepAnalysisRefId(userId, examId, weekStart),
    );
  }
}

function deepAnalysisRefId(userId: string, examId: string, weekStart: string): string {
  return `${userId}:${examId}:${weekStart}`;
}
