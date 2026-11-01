import { Injectable } from "@nestjs/common";
import type { WeeklyRecapArchiveItemDto } from "@mentor/types";
import { WeeklyRecapPurchasesService } from "../../economy/application/weekly-recap-purchases.service";
import { WeeklyRecapRepository } from "../infrastructure/weekly-recap.repository";
import { RECAP_DAY_MS } from "../domain/weekly-recap-access";

@Injectable()
export class WeeklyRecapArchiveService {
  constructor(private readonly reports: WeeklyRecapRepository, private readonly purchases: WeeklyRecapPurchasesService) {}

  async list(userId: string, page: number, pageSize: number) {
    const [includedCount, coinCount] = await Promise.all([
      this.reports.summaryCount(userId), this.purchases.total(userId),
    ]);
    const total = includedCount + coinCount;
    const skip = (page - 1) * pageSize;
    if (skip >= total) return { items: [], total, page, pageSize };
    const take = Math.min(page * pageSize, total);
    const [saved, history] = await Promise.all([this.reports.summaries(userId, take), this.purchases.page(userId, take)]);
    const references = history.map((row) => {
      const [, examId, weekStart] = row.refId!.split(":");
      return { examId: examId!, weekStart: weekStart! };
    });
    const ownedCoin = references.length ? await this.reports.summaries(userId, references.length, references) : [];
    const ownedByIdentity = new Map(ownedCoin.map((row) => [`${row.examId}:${row.weekStart}`, row]));
    const items: WeeklyRecapArchiveItemDto[] = saved.map((row) => ({ ...row, openedAt: row.openedAt!.toISOString() }));
    for (const purchase of history) {
      const [owner, examId, weekStart] = purchase.refId?.split(":") ?? [];
      if (owner !== userId || !examId || !weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) continue;
      const identity = `${examId}:${weekStart}`;
      const owned = ownedByIdentity.get(identity);
      if (owned) { items.push({ ...owned, openedAt: purchase.at.toISOString() }); continue; }
      items.push({ id: purchase.id, examId, weekStart,
        endDate: new Date(new Date(`${weekStart}T12:00:00Z`).getTime() + 6 * RECAP_DAY_MS).toISOString().slice(0, 10),
        source: "COIN", locale: "tr", openedAt: purchase.at.toISOString(), requiresOpening: true });
    }
    items.sort((a, b) => b.openedAt.localeCompare(a.openedAt) || b.id.localeCompare(a.id));
    return { items: items.slice(skip, skip + pageSize), total, page, pageSize };
  }
}
