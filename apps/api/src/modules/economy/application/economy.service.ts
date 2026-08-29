import { HttpStatus, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Currency, LedgerStatus, type EconomyBalance } from "@mentor/types";
import { deriveLevel } from "@mentor/core";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { DatabaseTx } from "../../../database/drizzle";
import { EconomyEventTopic, type EconomyXpChanged } from "../domain/economy.events";
import {
  LedgerRepository,
  type Balance,
  type LedgerRow,
  type XpLeaderRow,
} from "../infrastructure/ledger.repository";

export interface GrantOptions {
  reason: string;
  refType?: string;
  refId?: string;
  status?: LedgerStatus;
  /** Admin/actor for manual adjustments (audit + provenance). */
  actorId?: string;
  note?: string;
  /** Organic earning enforces coin caps + min-XP; admin corrections pass false. Default true. */
  enforceLimits?: boolean;
}

export interface SpendOptions {
  reason: string;
  refType: string;
  refId: string;
  note?: string;
}

export interface SpendResult {
  balance: Balance;
  /** True when (refType, refId) was already debited — idempotent retry. */
  alreadySpent: boolean;
}

export interface ReverseOptions {
  /** Ref of the original grant being reversed. */
  originalRefType: string;
  originalRefId: string;
  reason: string;
  refType: string;
  refId: string;
}

export interface CoinGrantReservationOptions {
  source: string;
  refId: string;
  expiresAt: Date;
  orgId?: string | null;
}

export interface SettleCoinGrantOptions {
  source: string;
  refId: string;
  reason: string;
  ledgerRefType: string;
  ledgerRefId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Light economy core (§3). Append-only ledger; balance = sum of rows. Coin is non-monetary and
 * capped — organic earning enforces daily/weekly caps + a min-XP (anti-Sybil) threshold from the
 * config registry. Spending (→ AI right) lands with W3. NEVER expose coin in the chat zone (§4 #3).
 */
@Injectable()
export class EconomyService {
  constructor(
    private readonly repo: LedgerRepository,
    private readonly config: ConfigRegistryService,
    private readonly events: EventEmitter2,
  ) {}

  /** Append a ledger entry (idempotent on refType/refId). Returns the user's fresh balance. */
  async grant(userId: string, unit: Currency, amount: number, opts: GrantOptions): Promise<Balance> {
    const inserted = await this.grantInTx(userId, unit, amount, opts);
    const balance = await this.repo.balanceService(userId);
    if (inserted && unit === Currency.XP) this.emitXpChanged(userId, balance.xp);
    return balance;
  }

  /** Append a ledger entry inside an existing SERVICE tx. Used when reward and source row must commit together. */
  async grantInServiceTx(
    userId: string,
    unit: Currency,
    amount: number,
    opts: GrantOptions,
    tx: DatabaseTx,
  ): Promise<boolean> {
    return this.grantInTx(userId, unit, amount, opts, tx);
  }

  private async grantInTx(
    userId: string,
    unit: Currency,
    amount: number,
    opts: GrantOptions,
    exec?: DatabaseTx,
  ): Promise<boolean> {
    const entry = {
      userId,
      unit,
      amount,
      reason: opts.reason,
      status: opts.status ?? LedgerStatus.CONFIRMED,
      refType: opts.refType ?? null,
      refId: opts.refId ?? null,
      note: opts.note ?? null,
      createdBy: opts.actorId ?? null,
    };

    if ((opts.enforceLimits ?? true) && unit === Currency.COIN && amount > 0) {
      // Cap-check + append in ONE service transaction so concurrent grants can't both pass the
      // check and exceed the cap (no TOCTOU race).
      const minXp = await this.config.get("economy.coin.min_xp_for_coin");
      const dailyCap = await this.config.get("economy.coin.daily_cap");
      const weeklyCap = await this.config.get("economy.coin.weekly_cap");
      const now = Date.now();
      const run = async (tx: DatabaseTx): Promise<boolean> => {
        // F1: per-user advisory lock — serializes concurrent capped grants beyond tx isolation.
        await this.repo.acquireUserLock(userId, tx);
        if (minXp > 0 && (await this.repo.balanceService(userId, tx)).xp < minXp) {
          throw new DomainError(ErrorCode.ECONOMY_LIMIT_EXCEEDED, HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const nowDate = new Date(now);
        const dayStart = new Date(now - DAY_MS);
        const weekStart = new Date(now - 7 * DAY_MS);
        const [earnedDay, reservedDay] = await Promise.all([
          this.repo.coinEarnedSince(userId, dayStart, tx),
          this.repo.activeCoinReservationAmountSince(userId, dayStart, nowDate, tx),
        ]);
        if (earnedDay + reservedDay + amount > dailyCap) {
          throw new DomainError(ErrorCode.ECONOMY_LIMIT_EXCEEDED, HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const [earnedWeek, reservedWeek] = await Promise.all([
          this.repo.coinEarnedSince(userId, weekStart, tx),
          this.repo.activeCoinReservationAmountSince(userId, weekStart, nowDate, tx),
        ]);
        if (earnedWeek + reservedWeek + amount > weeklyCap) {
          throw new DomainError(ErrorCode.ECONOMY_LIMIT_EXCEEDED, HttpStatus.UNPROCESSABLE_ENTITY);
        }
        return this.repo.append(entry, tx);
      };
      return exec ? run(exec) : this.repo.withServiceTx(run);
    }
    return this.repo.append(entry, exec);
  }

  /** Reserve capped organic Coin without writing spendable value to the immutable ledger. */
  async reserveCoinGrantInServiceTx(
    userId: string,
    amount: number,
    opts: CoinGrantReservationOptions,
    tx: DatabaseTx,
  ): Promise<void> {
    if (amount <= 0 || opts.expiresAt <= new Date()) {
      throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST);
    }

    await this.repo.acquireUserLock(userId, tx);
    const existing = await this.repo.findCoinReservation(opts.source, opts.refId, tx);
    if (existing) {
      if (existing.userId !== userId || existing.amount !== amount) {
        throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.CONFLICT);
      }
      return;
    }

    const [minXp, dailyCap, weeklyCap] = await Promise.all([
      this.config.get("economy.coin.min_xp_for_coin"),
      this.config.get("economy.coin.daily_cap"),
      this.config.get("economy.coin.weekly_cap"),
    ]);
    if (minXp > 0 && (await this.repo.balanceService(userId, tx)).xp < minXp) {
      throw new DomainError(ErrorCode.ECONOMY_LIMIT_EXCEEDED, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const now = new Date();
    const dayStart = new Date(now.getTime() - DAY_MS);
    const weekStart = new Date(now.getTime() - 7 * DAY_MS);
    const [earnedDay, reservedDay, earnedWeek, reservedWeek] = await Promise.all([
      this.repo.coinEarnedSince(userId, dayStart, tx),
      this.repo.activeCoinReservationAmountSince(userId, dayStart, now, tx),
      this.repo.coinEarnedSince(userId, weekStart, tx),
      this.repo.activeCoinReservationAmountSince(userId, weekStart, now, tx),
    ]);
    if (earnedDay + reservedDay + amount > dailyCap || earnedWeek + reservedWeek + amount > weeklyCap) {
      throw new DomainError(ErrorCode.ECONOMY_LIMIT_EXCEEDED, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    await this.repo.insertCoinReservation(
      {
        orgId: opts.orgId ?? null,
        userId,
        amount,
        source: opts.source,
        refId: opts.refId,
        expiresAt: opts.expiresAt,
      },
      tx,
    );
  }

  /** Settle a reservation into one idempotent ledger grant inside the caller-owned transaction. */
  async settleCoinGrantInServiceTx(
    userId: string,
    opts: SettleCoinGrantOptions,
    tx: DatabaseTx,
  ): Promise<void> {
    await this.repo.acquireUserLock(userId, tx);
    const reservation = await this.repo.findCoinReservation(opts.source, opts.refId, tx);
    if (!reservation || reservation.userId !== userId || reservation.status === "RELEASED") {
      throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.CONFLICT);
    }
    if (reservation.status === "ACTIVE" && reservation.expiresAt <= new Date()) {
      await this.repo.setCoinReservationStatus(opts.source, opts.refId, "RELEASED", tx);
      throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.GONE);
    }

    await this.grantInTx(
      userId,
      Currency.COIN,
      reservation.amount,
      {
        reason: opts.reason,
        refType: opts.ledgerRefType,
        refId: opts.ledgerRefId,
        enforceLimits: false,
      },
      tx,
    );
    if (reservation.status === "ACTIVE") {
      await this.repo.setCoinReservationStatus(opts.source, opts.refId, "SETTLED", tx);
    }
  }

  /** Release unused capacity after close, no-fill or expiry. Idempotent. */
  async releaseCoinGrantInServiceTx(
    userId: string,
    opts: Pick<CoinGrantReservationOptions, "source" | "refId">,
    tx: DatabaseTx,
  ): Promise<void> {
    await this.repo.acquireUserLock(userId, tx);
    const reservation = await this.repo.findCoinReservation(opts.source, opts.refId, tx);
    if (!reservation || reservation.userId !== userId || reservation.status !== "ACTIVE") return;
    await this.repo.setCoinReservationStatus(opts.source, opts.refId, "RELEASED", tx);
  }

  /** Publish only after a caller-owned transaction has committed its XP ledger row. */
  async publishXpChanged(userId: string): Promise<void> {
    const balance = await this.repo.balanceService(userId);
    this.emitXpChanged(userId, balance.xp);
  }

  private emitXpChanged(userId: string, xp: number): void {
    const event: EconomyXpChanged = {
      userId,
      level: deriveLevel(xp),
      occurredAt: new Date(),
    };
    this.events.emit(EconomyEventTopic.XP_CHANGED, event);
  }

  /** Self balance + the XP tier derived from the shared curve (admin reads stay on raw sums). */
  async getSelfBalance(userId: string): Promise<EconomyBalance> {
    const balance = await this.repo.balanceSelf(userId);
    return { ...balance, level: deriveLevel(balance.xp) };
  }
  getAdminBalance(userId: string): Promise<Balance> {
    return this.repo.balanceService(userId);
  }
  getSelfLedger(userId: string, page: number, pageSize: number): Promise<LedgerRow[]> {
    return this.repo.listSelf(userId, page, pageSize);
  }
  getAdminLedger(userId: string, limit: number): Promise<LedgerRow[]> {
    return this.repo.listService(userId, limit);
  }

  /** KVKK cleanup for mutable reservation control rows; append-only ledger is intentionally kept. */
  eraseCoinGrantReservations(userId: string): Promise<void> {
    return this.repo.eraseCoinReservationsForUser(userId);
  }

  /**
   * Debit confirmed coin (append-only negative row). Atomic balance check in one SERVICE tx.
   * Idempotent on (refType, refId): a duplicate spend is a no-op with `alreadySpent: true`.
   */
  async spend(userId: string, cost: number, opts: SpendOptions): Promise<SpendResult> {
    if (cost <= 0) {
      throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST);
    }
    let alreadySpent = false;
    await this.repo.withServiceTx(async (tx) => {
      // F1: lock closes the double-debit window between two concurrent spends with different refIds.
      await this.repo.acquireUserLock(userId, tx);
      if (await this.repo.existsByRef(opts.refType, opts.refId, tx)) {
        alreadySpent = true;
        return;
      }
      const balance = await this.repo.balanceService(userId, tx);
      if (balance.coinConfirmed < cost) {
        throw new DomainError(ErrorCode.INSUFFICIENT_COIN, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      await this.repo.append(
        {
          userId,
          unit: Currency.COIN,
          amount: -cost,
          reason: opts.reason,
          status: LedgerStatus.CONFIRMED,
          refType: opts.refType,
          refId: opts.refId,
          note: opts.note ?? null,
          createdBy: null,
        },
        tx,
      );
    });
    const balance = await this.repo.balanceService(userId);
    return { balance, alreadySpent };
  }

  /**
   * Compensating reversal of a prior COIN grant (refund flows). Clamp-to-zero policy: debits at
   * most the originally granted amount and never below the user's confirmed coin — a non-monetary
   * currency never goes negative. Idempotent on (refType, refId); no-op when the original grant
   * doesn't exist (it was cap-denied). Returns the reversed amount (0 = nothing reversed).
   */
  async reverse(userId: string, opts: ReverseOptions): Promise<number> {
    let reversed = 0;
    await this.repo.withServiceTx(async (tx) => {
      await this.repo.acquireUserLock(userId, tx);
      if (await this.repo.existsByRef(opts.refType, opts.refId, tx)) return; // already reversed
      const original = await this.repo.findByRef(opts.originalRefType, opts.originalRefId, tx);
      if (!original || original.amount <= 0) return; // grant never landed (cap-denied at grant time)
      const balance = await this.repo.balanceService(userId, tx);
      const amount = Math.min(original.amount, Math.max(0, balance.coinConfirmed));
      if (amount <= 0) return; // already spent down to zero — clamp forfeits the remainder
      await this.repo.append(
        {
          userId,
          unit: Currency.COIN,
          amount: -amount,
          reason: opts.reason,
          status: LedgerStatus.CONFIRMED,
          refType: opts.refType,
          refId: opts.refId,
          note: `orig:${original.amount}`,
          createdBy: null,
        },
        tx,
      );
      reversed = amount;
    });
    return reversed;
  }

  /** Rolling 24h count of AI chat coin spends (free-coin daily limit). */
  coinChatSpendsSince(userId: string, since: Date): Promise<number> {
    return this.repo.coinChatSpendsSince(userId, since);
  }

  /** Effort leaderboard (community): top-N by XP earned since `since`, scoped to an exam-type cohort. */
  getXpLeaderboard(examType: string | null, since: Date, limit: number): Promise<XpLeaderRow[]> {
    return this.repo.xpLeaderboardSince(examType, since, limit);
  }

  /** A user's own XP + cohort rank since `since` (rank null when they earned nothing in the window). */
  getXpStanding(
    userId: string,
    examType: string | null,
    since: Date,
  ): Promise<{ xp: number; rank: number | null }> {
    return this.repo.xpStandingSince(userId, examType, since);
  }

  /** Distinct XP earners in the cohort since `since` — leaderboard denominator for "ahead of X%". */
  getXpParticipantCount(examType: string | null, since: Date): Promise<number> {
    return this.repo.xpParticipantCountSince(examType, since);
  }

  /** Cohort ranks for the closed window `[since, until)` (userId→rank) — powers rank-movement ▲▼. */
  getPreviousRanks(examType: string | null, since: Date, until: Date): Promise<Map<string, number>> {
    return this.repo.xpRanksBetween(examType, since, until);
  }

  /** Admin metrics (W6) — total coin & XP issued (confirmed positive grants) across all users. */
  async getEconomyStats(): Promise<{ coinIssued: number; xpIssued: number }> {
    const [coinIssued, xpIssued] = await Promise.all([
      this.repo.sumIssued(Currency.COIN),
      this.repo.sumIssued(Currency.XP),
    ]);
    return { coinIssued, xpIssued };
  }
}
