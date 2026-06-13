import { HttpStatus, Injectable } from "@nestjs/common";
import { Currency, LedgerStatus } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { LedgerRepository, type Balance, type LedgerRow } from "../infrastructure/ledger.repository";

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
  ) {}

  /** Append a ledger entry (idempotent on refType/refId). Returns the user's fresh balance. */
  async grant(userId: string, unit: Currency, amount: number, opts: GrantOptions): Promise<Balance> {
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
      await this.repo.withServiceTx(async (tx) => {
        if (minXp > 0 && (await this.repo.balanceService(userId, tx)).xp < minXp) {
          throw new DomainError(ErrorCode.ECONOMY_LIMIT_EXCEEDED, HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const earnedDay = await this.repo.coinEarnedSince(userId, new Date(now - DAY_MS), tx);
        if (earnedDay + amount > dailyCap) {
          throw new DomainError(ErrorCode.ECONOMY_LIMIT_EXCEEDED, HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const earnedWeek = await this.repo.coinEarnedSince(userId, new Date(now - 7 * DAY_MS), tx);
        if (earnedWeek + amount > weeklyCap) {
          throw new DomainError(ErrorCode.ECONOMY_LIMIT_EXCEEDED, HttpStatus.UNPROCESSABLE_ENTITY);
        }
        await this.repo.append(entry, tx);
      });
    } else {
      await this.repo.append(entry);
    }
    return this.repo.balanceService(userId);
  }

  getSelfBalance(userId: string): Promise<Balance> {
    return this.repo.balanceSelf(userId);
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
}
