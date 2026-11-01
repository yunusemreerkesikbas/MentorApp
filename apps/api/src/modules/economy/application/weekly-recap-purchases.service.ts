import { Injectable } from "@nestjs/common";
import type { DatabaseTx } from "../../../database/drizzle";
import { WeeklyRecapPurchasesRepository } from "../infrastructure/weekly-recap-purchases.repository";
import { EconomyService } from "./economy.service";
import { EconomyLedger } from "../domain/economy.constants";

@Injectable()
export class WeeklyRecapPurchasesService {
  constructor(private readonly repo: WeeklyRecapPurchasesRepository, private readonly economy: EconomyService) {}
  history(userId: string, since: Date, tx?: DatabaseTx) { return this.repo.history(userId, since, tx); }
  total(userId: string) { return this.repo.total(userId); }
  page(userId: string, take: number) { return this.repo.page(userId, take); }
  debit(userId: string, examId: string, weekStart: string, cost: number, tx: DatabaseTx) {
    return this.economy.spendInServiceTx(userId, cost, {
      reason: EconomyLedger.DEEP_ANALYSIS_SPEND_REASON,
      refType: EconomyLedger.DEEP_ANALYSIS_REF_TYPE,
      refId: `${userId}:${examId}:${weekStart}`,
    }, tx);
  }
}
