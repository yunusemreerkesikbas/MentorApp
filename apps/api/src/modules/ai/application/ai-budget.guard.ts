import { HttpStatus, Injectable } from "@nestjs/common";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";

/** 1 US cent = 10_000 micro-USD (ai_usage.cost_micros unit). */
const MICROS_PER_CENT = 10_000;
/** Cache the month-to-date spend so the guard doesn't aggregate on every AI request. */
const CACHE_TTL_MS = 30_000;

export interface AiBudgetStatus {
  /** Monthly cap in micro-USD (0 = no cap). */
  capMicros: number;
  /** Calendar-month-to-date spend in micro-USD. */
  spentMicros: number;
  /** True when a cap is set and month-to-date spend has reached it. */
  exceeded: boolean;
}

/**
 * Global monthly AI budget guard (§7). Blocks ALL LLM calls once calendar-month spend reaches the
 * admin-configured cap (`ai.budget.monthly_cap_usd_cents`), auto-recovering when the month rolls
 * over or the cap is raised. Month-to-date spend is cached briefly to avoid a per-request aggregation;
 * the cache is per-instance, so overspend is bounded by (TTL × request rate × instances).
 */
@Injectable()
export class AiBudgetGuard {
  private cache: { spentMicros: number; at: number } | null = null;

  constructor(
    private readonly config: ConfigRegistryService,
    private readonly usage: AiUsageRepository,
  ) {}

  /** UTC first-of-month — the budget window resets here. */
  private startOfMonth(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private async capMicros(): Promise<number> {
    const cents = await this.config.get("ai.budget.monthly_cap_usd_cents");
    return cents * MICROS_PER_CENT;
  }

  private async spentThisMonth(): Promise<number> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < CACHE_TTL_MS) return this.cache.spentMicros;
    const window = await this.usage.windowSince(this.startOfMonth());
    this.cache = { spentMicros: window.costMicros, at: now };
    return window.costMicros;
  }

  /** False only when a cap is set and month-to-date spend has reached it. */
  async isWithinBudget(): Promise<boolean> {
    const capMicros = await this.capMicros();
    if (capMicros <= 0) return true; // 0 = no cap
    return (await this.spentThisMonth()) < capMicros;
  }

  /** Throw AI_BUDGET_EXCEEDED (503) when over budget — call before any billable LLM request. */
  async assertWithinBudget(): Promise<void> {
    if (!(await this.isWithinBudget())) {
      throw new DomainError(ErrorCode.AI_BUDGET_EXCEEDED, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /** Budget snapshot for the admin cost dashboard banner. */
  async getStatus(): Promise<AiBudgetStatus> {
    const capMicros = await this.capMicros();
    const spentMicros = await this.spentThisMonth();
    return { capMicros, spentMicros, exceeded: capMicros > 0 && spentMicros >= capMicros };
  }
}
