import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gt, gte, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm";
import {
  Currency,
  LedgerStatus,
  type EconomyFlowDto,
  type EconomyReasonFlowDto,
} from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { coinGrantReservations, ledgerEntries, users } from "../../../database/schema";
import { CORRECTION_REASONS, EconomyLedger } from "../domain/economy.constants";

export type LedgerRow = typeof ledgerEntries.$inferSelect;
export type NewLedgerEntry = typeof ledgerEntries.$inferInsert;
export type CoinGrantReservation = typeof coinGrantReservations.$inferSelect;
export type NewCoinGrantReservation = typeof coinGrantReservations.$inferInsert;

export interface Balance {
  xp: number;
  coinConfirmed: number;
  coinPending: number;
}

/** One XP-leaderboard row (author display joined from the shared users anchor). */
export interface XpLeaderRow {
  userId: string;
  displayName: string;
  avatarStorageKey: string | null;
  xp: number;
}

/** Same-cohort filter for the leaderboard: exam type must match (or both be null). */
const sameCohort = (examType: string | null) =>
  examType === null ? isNull(users.examType) : eq(users.examType, examType);

/**
 * Append-only ledger access (§4 #3). Writes/aggregations for the system/admin run in SERVICE
 * context; a user's own reads run in user context (RLS self-read belt). Balance = sum of rows.
 *
 * Service-context methods accept an optional `exec` (an in-flight SERVICE tx) so the reward engine
 * can run its cap-check + append atomically in ONE transaction (no TOCTOU race — see EconomyService).
 */
@Injectable()
export class LedgerRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Run `fn` in a fresh SERVICE transaction (for atomic check-then-write in the service). */
  withServiceTx<T>(fn: (tx: DatabaseTx) => Promise<T>): Promise<T> {
    return withServiceContext(this.db, fn);
  }

  private onService<T>(exec: DatabaseTx | undefined, fn: (tx: DatabaseTx) => Promise<T>): Promise<T> {
    return exec ? fn(exec) : withServiceContext(this.db, fn);
  }

  /**
   * Per-user advisory lock (F1) serializing check-then-write economy paths (cap-check + append,
   * balance-check + debit). Transaction-scoped: auto-released at commit/rollback, reentrant within
   * the same tx. Must be the first statement of the calling SERVICE tx.
   */
  async acquireUserLock(userId: string, tx: DatabaseTx): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"economy:" + userId}, 0))`);
  }

  /** Append one immutable entry. Idempotent on (refType,refId): a duplicate is a no-op. */
  async append(entry: NewLedgerEntry, exec?: DatabaseTx): Promise<boolean> {
    return this.onService(exec, async (tx) => {
      const inserted = await tx
        .insert(ledgerEntries)
        .values(entry)
        .onConflictDoNothing()
        .returning({ id: ledgerEntries.id });
      return inserted.length > 0;
    });
  }

  private async computeBalance(userId: string, tx: DatabaseTx): Promise<Balance> {
    const rows = await tx
      .select({
        unit: ledgerEntries.unit,
        status: ledgerEntries.status,
        total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.userId, userId))
      .groupBy(ledgerEntries.unit, ledgerEntries.status);

    const balance: Balance = { xp: 0, coinConfirmed: 0, coinPending: 0 };
    for (const r of rows) {
      if (r.unit === Currency.XP) balance.xp += r.total;
      else if (r.unit === Currency.COIN) {
        if (r.status === LedgerStatus.CONFIRMED) balance.coinConfirmed += r.total;
        else if (r.status === LedgerStatus.PENDING) balance.coinPending += r.total;
      }
    }
    return balance;
  }

  balanceSelf(userId: string): Promise<Balance> {
    return withUserContext(this.db, { userId }, (tx) => this.computeBalance(userId, tx));
  }
  balanceService(userId: string, exec?: DatabaseTx): Promise<Balance> {
    return this.onService(exec, (tx) => this.computeBalance(userId, tx));
  }

  /**
   * Sum of positive ORGANIC coin grants since `since` (for daily/weekly earning caps).
   * Excludes admin adjustments (createdBy set) and every compensating refund
   * (`CORRECTION_REASONS`) — both are corrections, not earnings, and must not consume the
   * user's organic cap headroom.
   */
  async coinEarnedSince(userId: string, since: Date, exec?: DatabaseTx): Promise<number> {
    return this.onService(exec, async (tx) => {
      const rows = await tx
        .select({
          total: sql<number>`coalesce(sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.amount} > 0), 0)::int`,
        })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.userId, userId),
            eq(ledgerEntries.unit, Currency.COIN),
            gte(ledgerEntries.createdAt, since),
            isNull(ledgerEntries.createdBy),
            notInArray(ledgerEntries.reason, [...CORRECTION_REASONS]),
          ),
        );
      return rows[0]?.total ?? 0;
    });
  }

  /** Active, non-expired reservations consume the same rolling cap as settled organic grants. */
  async activeCoinReservationAmountSince(
    userId: string,
    since: Date,
    now: Date,
    exec?: DatabaseTx,
  ): Promise<number> {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select({ total: sql<number>`coalesce(sum(${coinGrantReservations.amount}), 0)::int` })
        .from(coinGrantReservations)
        .where(
          and(
            eq(coinGrantReservations.userId, userId),
            eq(coinGrantReservations.status, "ACTIVE"),
            gt(coinGrantReservations.expiresAt, now),
            gte(coinGrantReservations.createdAt, since),
          ),
        );
      return row?.total ?? 0;
    });
  }

  async insertCoinReservation(entry: NewCoinGrantReservation, exec?: DatabaseTx): Promise<boolean> {
    return this.onService(exec, async (tx) => {
      const inserted = await tx
        .insert(coinGrantReservations)
        .values(entry)
        .onConflictDoNothing()
        .returning({ id: coinGrantReservations.id });
      return inserted.length > 0;
    });
  }

  async findCoinReservation(
    source: string,
    refId: string,
    exec?: DatabaseTx,
  ): Promise<CoinGrantReservation | undefined> {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select()
        .from(coinGrantReservations)
        .where(
          and(eq(coinGrantReservations.source, source), eq(coinGrantReservations.refId, refId)),
        )
        .limit(1);
      return row;
    });
  }

  async setCoinReservationStatus(
    source: string,
    refId: string,
    status: "SETTLED" | "RELEASED",
    exec?: DatabaseTx,
  ): Promise<void> {
    await this.onService(exec, async (tx) => {
      const now = new Date();
      await tx
        .update(coinGrantReservations)
        .set(
          status === "SETTLED"
            ? { status, settledAt: now }
            : { status, releasedAt: now },
        )
        .where(
          and(
            eq(coinGrantReservations.source, source),
            eq(coinGrantReservations.refId, refId),
            eq(coinGrantReservations.status, "ACTIVE"),
          ),
        );
    });
  }

  async eraseCoinReservationsForUser(userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(coinGrantReservations).where(eq(coinGrantReservations.userId, userId));
    });
  }

  /** Count of AI chat coin spends since `since` (free-coin daily limit). */
  async coinChatSpendsSince(userId: string, since: Date, exec?: DatabaseTx): Promise<number> {
    return this.onService(exec, async (tx) => {
      const rows = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.userId, userId),
            eq(ledgerEntries.unit, Currency.COIN),
            eq(ledgerEntries.reason, EconomyLedger.AI_CHAT_SPEND_REASON),
            gte(ledgerEntries.createdAt, since),
          ),
        );
      return rows[0]?.total ?? 0;
    });
  }

  /** Count of grant rows for a (userId, reason) since `since` — powers per-day XP earning caps. */
  async grantCountSince(userId: string, reason: string, since: Date, exec?: DatabaseTx): Promise<number> {
    return this.onService(exec, async (tx) => {
      const rows = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.userId, userId),
            eq(ledgerEntries.reason, reason),
            gte(ledgerEntries.createdAt, since),
          ),
        );
      return rows[0]?.total ?? 0;
    });
  }

  /** The ledger row for (refType, refId), if any — reversals debit the actually-granted amount. */
  async findByRef(refType: string, refId: string, exec?: DatabaseTx): Promise<LedgerRow | undefined> {
    return this.onService(exec, async (tx) => {
      const rows = await tx
        .select()
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.refType, refType), eq(ledgerEntries.refId, refId)))
        .limit(1);
      return rows[0];
    });
  }

  /** True when a ledger row already exists for (refType, refId). */
  async existsByRef(refType: string, refId: string, exec?: DatabaseTx): Promise<boolean> {
    return this.onService(exec, async (tx) => {
      const rows = await tx
        .select({ id: ledgerEntries.id })
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.refType, refType), eq(ledgerEntries.refId, refId)))
        .limit(1);
      return rows.length > 0;
    });
  }

  listSelf(userId: string, page: number, pageSize: number): Promise<LedgerRow[]> {
    return withUserContext(this.db, { userId }, (tx) =>
      tx
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.userId, userId))
        .orderBy(desc(ledgerEntries.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    );
  }

  listService(userId: string, limit: number): Promise<LedgerRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.userId, userId))
        .orderBy(desc(ledgerEntries.createdAt))
        .limit(limit),
    );
  }

  /**
   * Admin metrics (W6) — Σ positive CONFIRMED grants for a unit across all users (SERVICE context).
   * "Issued" = confirmed positive amount (pending coin isn't issued yet).
   */
  async sumIssued(unit: Currency, since?: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const conds = [eq(ledgerEntries.unit, unit), eq(ledgerEntries.status, LedgerStatus.CONFIRMED)];
      if (since) conds.push(gte(ledgerEntries.createdAt, since));
      const rows = await tx
        .select({
          total: sql<number>`coalesce(sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.amount} > 0), 0)::int`,
        })
        .from(ledgerEntries)
        .where(and(...conds));
      return rows[0]?.total ?? 0;
    });
  }

  /**
   * Admin metrics (W6) — total ledger flow in a rolling window. Credited/debited are both returned
   * as POSITIVE magnitudes so the UI never has to reason about sign. CONFIRMED only (pending coin
   * hasn't moved yet). SERVICE context: cross-tenant aggregate.
   */
  async flowSince(since: Date): Promise<EconomyFlowDto> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx
        .select({
          coinCredited: sql<number>`coalesce(sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.unit} = ${Currency.COIN} and ${ledgerEntries.amount} > 0), 0)::int`,
          coinDebited: sql<number>`coalesce(-sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.unit} = ${Currency.COIN} and ${ledgerEntries.amount} < 0), 0)::int`,
          xpCredited: sql<number>`coalesce(sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.unit} = ${Currency.XP} and ${ledgerEntries.amount} > 0), 0)::int`,
          rows: sql<number>`count(*)::int`,
        })
        .from(ledgerEntries)
        .where(
          and(eq(ledgerEntries.status, LedgerStatus.CONFIRMED), gte(ledgerEntries.createdAt, since)),
        );
      return row ?? { coinCredited: 0, coinDebited: 0, xpCredited: 0, rows: 0 };
    });
  }

  /**
   * Per-reason flow for one unit — the faucet/sink breakdown. ORGANIC only: admin adjustments
   * (`created_by` set) are corrections and would distort the earning rates this exists to calibrate,
   * so they are excluded here and reported separately by `correctionsSince`. Biggest movement first.
   */
  byReasonSince(unit: Currency, since: Date): Promise<EconomyReasonFlowDto[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          reason: ledgerEntries.reason,
          credited: sql<number>`coalesce(sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.amount} > 0), 0)::int`,
          debited: sql<number>`coalesce(-sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.amount} < 0), 0)::int`,
          users: sql<number>`count(distinct ${ledgerEntries.userId})::int`,
        })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.unit, unit),
            eq(ledgerEntries.status, LedgerStatus.CONFIRMED),
            gte(ledgerEntries.createdAt, since),
            isNull(ledgerEntries.createdBy),
          ),
        )
        .groupBy(ledgerEntries.reason)
        .orderBy(desc(sql`coalesce(sum(abs(${ledgerEntries.amount})), 0)`)),
    );
  }

  /** Admin COIN adjustments in the window — the counterpart `byReasonSince` deliberately omits. */
  async correctionsSince(
    since: Date,
  ): Promise<{ credited: number; debited: number; rows: number }> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx
        .select({
          credited: sql<number>`coalesce(sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.amount} > 0), 0)::int`,
          debited: sql<number>`coalesce(-sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.amount} < 0), 0)::int`,
          rows: sql<number>`count(*)::int`,
        })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.unit, Currency.COIN),
            eq(ledgerEntries.status, LedgerStatus.CONFIRMED),
            gte(ledgerEntries.createdAt, since),
            isNotNull(ledgerEntries.createdBy),
          ),
        );
      return row ?? { credited: 0, debited: 0, rows: 0 };
    });
  }

  /**
   * Unspent confirmed coin across all users — the outstanding liability. A ballooning float means
   * the faucet outruns the sinks; a float pinned near zero means users hit a wall. Users with a
   * zero/negative balance aren't holders.
   */
  async outstandingFloat(): Promise<{ coinConfirmed: number; holders: number }> {
    return withServiceContext(this.db, async (tx) => {
      const perUser = tx
        .select({
          uid: ledgerEntries.userId,
          bal: sql<number>`sum(${ledgerEntries.amount})`.as("bal"),
        })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.unit, Currency.COIN),
            eq(ledgerEntries.status, LedgerStatus.CONFIRMED),
          ),
        )
        .groupBy(ledgerEntries.userId)
        .having(sql`sum(${ledgerEntries.amount}) > 0`)
        .as("per_user");
      const [row] = await tx
        .select({
          coinConfirmed: sql<number>`coalesce(sum(${perUser.bal}), 0)::int`,
          holders: sql<number>`count(*)::int`,
        })
        .from(perUser);
      return row ?? { coinConfirmed: 0, holders: 0 };
    });
  }

  /** Distinct users who EARNED a given reason in the window (recurring-faucet reach). */
  async distinctEarnersSince(reason: string, since: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx
        .select({ total: sql<number>`count(distinct ${ledgerEntries.userId})::int` })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.reason, reason),
            gte(ledgerEntries.createdAt, since),
            sql`${ledgerEntries.amount} > 0`,
          ),
        );
      return row?.total ?? 0;
    });
  }

  /**
   * Distinct users who earned ANY XP in the window — the faucet-reach denominator. Global (every
   * cohort), unlike `xpParticipantCountSince` which is scoped to one exam type.
   */
  async distinctXpActiveSince(since: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx
        .select({ total: sql<number>`count(distinct ${ledgerEntries.userId})::int` })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.unit, Currency.XP),
            gte(ledgerEntries.createdAt, since),
            sql`${ledgerEntries.amount} > 0`,
          ),
        );
      return row?.total ?? 0;
    });
  }

  /**
   * Effort leaderboard: top-N users by XP earned since `since`, scoped to an exam-type cohort.
   * `unit` is hard-filtered to XP so coin/net can NEVER enter the ranking (§3). Cross-user read →
   * SERVICE context (same precedent as `sumIssued`). // ponytail: SQL aggregate; Redis sorted-set is
   * the Faz-2 real-time upgrade. `users` is the shared identity anchor (forum joins it too).
   */
  xpLeaderboardSince(examType: string | null, since: Date, limit: number): Promise<XpLeaderRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          userId: ledgerEntries.userId,
          displayName: users.displayName,
          avatarStorageKey: users.avatarStorageKey,
          xp: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int`,
        })
        .from(ledgerEntries)
        .innerJoin(users, eq(users.id, ledgerEntries.userId))
        .where(and(eq(ledgerEntries.unit, Currency.XP), gte(ledgerEntries.createdAt, since), sameCohort(examType)))
        .groupBy(ledgerEntries.userId, users.displayName, users.avatarStorageKey)
        .orderBy(desc(sql`coalesce(sum(${ledgerEntries.amount}), 0)`))
        .limit(limit),
    );
  }

  /**
   * Count of distinct users with positive XP in the cohort since `since` — the leaderboard's
   * denominator for "ahead of X%". SERVICE context (cross-user aggregate, same as the leaderboard).
   */
  xpParticipantCountSince(examType: string | null, since: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const ranked = tx
        .select({ uid: ledgerEntries.userId })
        .from(ledgerEntries)
        .innerJoin(users, eq(users.id, ledgerEntries.userId))
        .where(and(eq(ledgerEntries.unit, Currency.XP), gte(ledgerEntries.createdAt, since), sameCohort(examType)))
        .groupBy(ledgerEntries.userId)
        .having(sql`coalesce(sum(${ledgerEntries.amount}), 0) > 0`)
        .as("ranked");
      const [row] = await tx.select({ total: sql<number>`count(*)::int` }).from(ranked);
      return row?.total ?? 0;
    });
  }

  /**
   * Every user's rank within a cohort for the CLOSED window `[since, until)` — powers rank-movement
   * (▲▼) by comparing against the current period. A closed past window is immutable, so this is
   * computed on read (no snapshot table/cron needed). SERVICE context (cross-user aggregate).
   */
  async xpRanksBetween(
    examType: string | null,
    since: Date,
    until: Date,
  ): Promise<Map<string, number>> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          userId: ledgerEntries.userId,
          xp: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int`,
        })
        .from(ledgerEntries)
        .innerJoin(users, eq(users.id, ledgerEntries.userId))
        .where(
          and(
            eq(ledgerEntries.unit, Currency.XP),
            gte(ledgerEntries.createdAt, since),
            lt(ledgerEntries.createdAt, until),
            sameCohort(examType),
          ),
        )
        .groupBy(ledgerEntries.userId)
        .having(sql`coalesce(sum(${ledgerEntries.amount}), 0) > 0`)
        .orderBy(desc(sql`coalesce(sum(${ledgerEntries.amount}), 0)`));
      // Dense enumeration mirrors the live board's ordering (ties keep insertion order).
      const ranks = new Map<string, number>();
      rows.forEach((r, i) => ranks.set(r.userId, i + 1));
      return ranks;
    });
  }

  /** A user's own XP + rank within their cohort since `since`. rank is null when they earned nothing. */
  xpStandingSince(
    userId: string,
    examType: string | null,
    since: Date,
  ): Promise<{ xp: number; rank: number | null }> {
    return withServiceContext(this.db, async (tx) => {
      const [me] = await tx
        .select({ xp: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int` })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.userId, userId),
            eq(ledgerEntries.unit, Currency.XP),
            gte(ledgerEntries.createdAt, since),
          ),
        );
      const xp = me?.xp ?? 0;
      if (xp <= 0) return { xp: 0, rank: null };

      const ranked = tx
        .select({ uid: ledgerEntries.userId })
        .from(ledgerEntries)
        .innerJoin(users, eq(users.id, ledgerEntries.userId))
        .where(and(eq(ledgerEntries.unit, Currency.XP), gte(ledgerEntries.createdAt, since), sameCohort(examType)))
        .groupBy(ledgerEntries.userId)
        .having(sql`coalesce(sum(${ledgerEntries.amount}), 0) > ${xp}`)
        .as("ranked");
      const [row] = await tx.select({ ahead: sql<number>`count(*)::int` }).from(ranked);
      return { xp, rank: (row?.ahead ?? 0) + 1 };
    });
  }
}
