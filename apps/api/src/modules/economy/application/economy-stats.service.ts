import { Injectable } from "@nestjs/common";
import { Currency, type AdminEconomyStatsDto } from "@mentor/types";
import { LedgerRepository } from "../infrastructure/ledger.repository";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_ALLOWANCE_REASON = "quest.weekly.effort-allowance";

/**
 * Admin economy visibility (§3, roadmap §729) — aggregates the append-only ledger into rolling
 * windows, a per-reason faucet/sink breakdown, the outstanding coin float, and the recurring
 * faucet's reach. Read-only, cross-tenant (SERVICE ctx inside the repo).
 *
 * Exists so earning rates are calibrated from live data instead of guessed: the breakdown answers
 * "where does coin come from / go", the float answers "is the faucet too generous or too tight",
 * and the reach answers "can users actually hit the weekly target". Mirrors AiCostStatsService.
 *
 * Flag-independent: this is admin tooling, not the user-facing economy surface.
 */
@Injectable()
export class EconomyStatsService {
  constructor(private readonly ledger: LedgerRepository) {}

  async getStats(): Promise<AdminEconomyStatsDto> {
    const now = Date.now();
    const since = (days: number) => new Date(now - days * DAY_MS);
    const d30 = since(30);
    const d7 = since(7);

    const [
      windowD1,
      windowD7,
      windowD30,
      coinByReason,
      xpByReason,
      corrections,
      float,
      earners7d,
      activeUsers7d,
    ] = await Promise.all([
      this.ledger.flowSince(since(1)),
      this.ledger.flowSince(d7),
      this.ledger.flowSince(d30),
      this.ledger.byReasonSince(Currency.COIN, d30),
      this.ledger.byReasonSince(Currency.XP, d30),
      this.ledger.correctionsSince(d30),
      this.ledger.outstandingFloat(),
      this.ledger.distinctEarnersSince(WEEKLY_ALLOWANCE_REASON, d7),
      this.ledger.distinctXpActiveSince(d7),
    ]);

    return {
      windows: { d1: windowD1, d7: windowD7, d30: windowD30 },
      coinByReason,
      xpByReason,
      corrections,
      float,
      faucetReach: { earners7d, activeUsers7d },
      generatedAt: new Date(now).toISOString(),
    };
  }
}
