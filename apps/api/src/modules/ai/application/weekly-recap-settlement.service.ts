import { HttpStatus, Injectable } from "@nestjs/common";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { WeeklyRecapPurchasesService } from "../../economy/application/weekly-recap-purchases.service";
import { recapAllowance, RECAP_DAY_MS } from "../domain/weekly-recap-access";
import { WeeklyRecapRepository, type WeeklyRecapRow } from "../infrastructure/weekly-recap.repository";
import { WeeklyRecapPolicyService } from "./weekly-recap-policy.service";
import { EntitlementService } from "../../payments/application/entitlement.service";

@Injectable()
export class WeeklyRecapSettlementService {
  constructor(private readonly reports: WeeklyRecapRepository,
    private readonly purchases: WeeklyRecapPurchasesService, private readonly policy: WeeklyRecapPolicyService,
    private readonly entitlement: EntitlementService) {}

  settle(userId: string, old: WeeklyRecapRow): Promise<WeeklyRecapRow> {
    return this.reports.locked(userId, async (tx) => {
      let row = await this.reports.find(userId, old.examId, old.weekStart, tx);
      if (!row) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
      if (row.status === "READY") return row;
      if (row.status !== "GENERATED" || !row.narration) this.policy.deny(ErrorCode.WEEKLY_RECAP_PROCESSING);
      if ((row.source !== "COIN" || row.cost > 0) && (await this.entitlement.getEntitlement(userId)).isPremium)
        row = (await this.reports.update(row, { source: "PREMIUM", cost: 0 }, tx))!;
      const settings = await this.policy.settings();
      const pending = await this.reports.reservations(userId, tx, row.id);
      if (row.source === "EARNED") {
        const used = await this.reports.earnedCount(userId, tx);
        if (!settings.enabled || !settings.freeEnabled || used + pending.filter((r) => r.source === "EARNED").length >= settings.freeLimit)
          this.policy.deny(ErrorCode.PAYMENT_PREMIUM_REQUIRED);
      }
      if (row.source === "COIN" && row.cost > 0) {
        if (!settings.enabled || !settings.economy || !settings.coinEnabled)
          this.policy.deny(ErrorCode.PAYMENT_PREMIUM_REQUIRED);
        const history = await this.purchases.history(userId, new Date(Date.now() - settings.days * RECAP_DAY_MS), tx);
        const allowance = recapAllowance(history.map((r) => r.at), pending.filter((r) => r.source === "COIN" && r.cost > 0)
          .map((r) => r.expiresAt), settings.coinLimit, settings.days);
        if (!allowance.remaining) this.policy.deny(ErrorCode.WEEKLY_RECAP_LIMIT_REACHED);
        await this.purchases.debit(userId, row.examId, row.weekStart, row.cost, tx);
      }
      return (await this.reports.update(row, { status: "READY", openedAt: new Date() }, tx))!;
    });
  }
}
