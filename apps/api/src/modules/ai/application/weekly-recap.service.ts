import { randomUUID } from "node:crypto";
import { HttpStatus, Injectable, type OnModuleInit } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import type { WeeklyRecapOfferDto, WeeklyRecapReportDto } from "@mentor/types";
import type { OpenWeeklyRecapInput } from "@mentor/validation";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { WeeklyReviewService } from "../../coaching/application/weekly-review.service";
import { WeeklyRecapRegistry } from "../../coaching/application/weekly-recap.registry";
import { weeklyReviewWindows } from "../../coaching/domain/weekly-review";
import { WeeklyRecapRepository, type WeeklyRecapRow } from "../infrastructure/weekly-recap.repository";
import { RECAP_DAY_MS, RECAP_LEASE_MS } from "../domain/weekly-recap-access";
import { WeeklyRecapPolicyService } from "./weekly-recap-policy.service";
import { WeeklyRecapNarratorService } from "./weekly-recap-narrator.service";
import { WeeklyRecapSettlementService } from "./weekly-recap-settlement.service";
import { WeeklyRecapArchiveService } from "./weekly-recap-archive.service";
import { WeeklyReviewCacheRepository } from "../infrastructure/weekly-review-cache.repository";

@Injectable()
export class WeeklyRecapService implements OnModuleInit {
  constructor(
    private readonly reports: WeeklyRecapRepository,
    private readonly policy: WeeklyRecapPolicyService,
    private readonly reviews: WeeklyReviewService,
    private readonly narrator: WeeklyRecapNarratorService,
    private readonly settlement: WeeklyRecapSettlementService,
    private readonly registry: WeeklyRecapRegistry,
    private readonly archives: WeeklyRecapArchiveService,
    private readonly cache: WeeklyReviewCacheRepository,
  ) {}

  onModuleInit() {
    this.registry.register(async (userId, examId, weekStart = weeklyReviewWindows().startDate) => {
      const report = await this.reports.find(userId, examId, weekStart);
      if (report?.status === "READY") return report.review;
      if (!(await this.policy.settings()).enabled) return null;
      this.policy.deny(ErrorCode.PAYMENT_PREMIUM_REQUIRED);
    });
  }

  async offer(user: RequestUser, examId: string, weekStart?: string): Promise<WeeklyRecapOfferDto> {
    const week = weekStart ?? weeklyReviewWindows().startDate;
    const saved = await this.reports.find(user.id, examId, week);
    const review = saved?.review ?? await this.reviewAt(user.id, examId, week);
    return this.reports.locked(user.id, (tx) => this.policy.offer(user, examId, review, tx, saved?.id));
  }

  async open(user: RequestUser, body: OpenWeeklyRecapInput): Promise<WeeklyRecapReportDto> {
    const old = await this.reports.find(user.id, body.examId, body.weekStart);
    if (old?.status === "READY") return this.view(old);
    if (old?.status === "GENERATED") {
      const offer = await this.offer(user, body.examId, body.weekStart);
      if (!offer.canOpen) this.policy.deny(offer.reason);
      if (offer.cost !== body.expectedCost || offer.mode !== body.source) this.policy.deny(ErrorCode.WEEKLY_RECAP_PRICE_CHANGED);
      const quoted = old.source === "EARNED" && offer.mode === "COIN"
        ? await this.requoteEarned(user, body, old) : old;
      return this.view(await this.settlement.settle(user.id, quoted));
    }
    const review = old?.review ?? await this.reviewAt(user.id, body.examId, body.weekStart);
    const row = await this.reports.locked(user.id, async (tx) => {
      const bound = await this.reports.byRequest(user.id, body.clientRequestId, tx);
      if (bound && (bound.examId !== body.examId || bound.weekStart !== body.weekStart))
        throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
      const current = await this.reports.find(user.id, body.examId, body.weekStart, tx);
      if (current?.status === "READY" || current?.status === "GENERATED") return current;
      const offer = await this.policy.offer(user, body.examId, review, tx, current?.id);
      if (!offer.canOpen) this.policy.deny(offer.reason);
      if (offer.mode !== body.source || offer.cost !== body.expectedCost) this.policy.deny(ErrorCode.WEEKLY_RECAP_PRICE_CHANGED);
      if (body.weekStart !== weeklyReviewWindows().startDate && offer.mode !== "OWNED")
        throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
      const values = {
        userId: user.id, orgId: user.orgId, examId: body.examId, weekStart: body.weekStart,
        locale: current?.locale ?? I18nContext.current()?.lang ?? "tr",
        source: offer.mode === "OWNED" ? "COIN" as const : offer.mode as "PREMIUM" | "EARNED" | "COIN",
        cost: offer.cost, status: "RUNNING" as const, review,
        clientRequestId: body.clientRequestId, claimId: randomUUID(), expiresAt: new Date(Date.now() + RECAP_LEASE_MS),
      };
      return current ? (await this.reports.update(current, values, tx))! : this.reports.create(values, tx);
    });
    if (row.status === "READY") return this.view(row);
    if (row.status === "GENERATED") return this.view(await this.settlement.settle(user.id, row));
    let generated: WeeklyRecapRow;
    try {
      const result = await this.narrator.generate(user.id, row.examId, row.review, row.locale);
      generated = await this.reports.locked(user.id, async (tx) => {
        const active = await this.reports.find(user.id, row.examId, row.weekStart, tx);
        if (active?.claimId !== row.claimId || active.status !== "RUNNING")
          throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
        // Fence the cache write with the claim: a resumed expired worker cannot overwrite a winner.
        await this.cache.saveFirst({ userId: user.id, examId: row.examId, weekStart: row.weekStart,
          locale: result.locale, sourceFingerprint: "owned-wrapped-v1", narration: result.narration.narration,
          model: result.narration.model }, tx);
        return (await this.reports.update(row, { status: "GENERATED", ...result }, tx))!;
      });
    } catch (error) {
      await this.reports.locked(user.id, async (tx) => {
        const active = await this.reports.find(user.id, row.examId, row.weekStart, tx);
        if (active?.claimId === row.claimId && active.status === "RUNNING")
          await this.reports.update(row, { status: "FAILED" }, tx);
      });
      if (error instanceof DomainError) throw error;
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return this.view(await this.settlement.settle(user.id, generated));
  }

  async read(userId: string, id: string) {
    const row = await this.reports.byId(userId, id);
    if (!row || row.status !== "READY") throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return this.view(row);
  }

  async narration(userId: string, examId: string) {
    const row = await this.reports.find(userId, examId, weeklyReviewWindows().startDate);
    if (row?.status !== "READY" || !row.narration) this.policy.deny(ErrorCode.PAYMENT_PREMIUM_REQUIRED);
    return row.narration;
  }

  async storedNarration(userId: string, examId: string) {
    const row = await this.reports.find(userId, examId, weeklyReviewWindows().startDate);
    return row?.status === "READY" ? row.narration : null;
  }

  private requoteEarned(user: RequestUser, body: OpenWeeklyRecapInput, old: WeeklyRecapRow) {
    return this.reports.locked(user.id, async (tx) => {
      const row = (await this.reports.find(user.id, old.examId, old.weekStart, tx))!;
      if (row.status !== "GENERATED") return row;
      const offer = await this.policy.offer(user, row.examId, row.review, tx, row.id);
      if (!offer.canOpen) this.policy.deny(offer.reason);
      if (offer.mode !== body.source || offer.cost !== body.expectedCost) this.policy.deny(ErrorCode.WEEKLY_RECAP_PRICE_CHANGED);
      return (await this.reports.update(row, { source: "COIN", cost: offer.cost }, tx))!;
    });
  }

  async archive(userId: string, page: number, pageSize: number) {
    return this.archives.list(userId, page, pageSize);
  }

  private reviewAt(userId: string, examId: string, week: string) {
    const date = new Date(new Date(`${week}T12:00:00Z`).getTime() + 7 * RECAP_DAY_MS);
    if (weeklyReviewWindows(date).startDate !== week || date.getTime() > Date.now() + 7 * RECAP_DAY_MS)
      throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST);
    return this.reviews.getReview(userId, examId, date);
  }

  private summary(row: WeeklyRecapRow) {
    return { id: row.id, examId: row.examId, weekStart: row.weekStart, endDate: row.review.period.endDate,
      locale: row.locale, source: row.source, openedAt: row.openedAt!.toISOString() };
  }
  private view(row: WeeklyRecapRow): WeeklyRecapReportDto {
    return { ...this.summary(row), review: row.review, narration: row.narration! };
  }
}
