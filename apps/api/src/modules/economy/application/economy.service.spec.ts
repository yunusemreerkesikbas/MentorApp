import { beforeEach, describe, expect, it, vi } from "vitest";
import { Currency, LedgerStatus } from "@mentor/types";
import { ErrorCode } from "../../../common/errors/error-code";
import { DomainError } from "../../../common/errors/domain-error";
import { EconomyService } from "./economy.service";
import { CORRECTION_REASONS, EconomyLedger } from "../domain/economy.constants";
import type { NewLedgerEntry } from "../infrastructure/ledger.repository";

interface Row extends NewLedgerEntry {
  createdAt: Date;
}

/** In-memory ledger fake (append-only; ref dedupe; balance = sum). */
function makeRepoFake() {
  const rows: Row[] = [];
  const reservations: Array<{
    userId: string;
    amount: number;
    source: string;
    refId: string;
    status: "ACTIVE" | "SETTLED" | "RELEASED";
    expiresAt: Date;
    createdAt: Date;
  }> = [];
  /** Ordered trace of repo calls — lets tests assert lock-before-check-before-append (F1). */
  const trace: string[] = [];
  const sum = (pred: (r: Row) => boolean) =>
    rows.filter(pred).reduce((acc, r) => acc + r.amount, 0);
  const balance = (userId: string) => ({
    xp: sum((r) => r.userId === userId && r.unit === Currency.XP),
    coinConfirmed: sum(
      (r) => r.userId === userId && r.unit === Currency.COIN && r.status === LedgerStatus.CONFIRMED,
    ),
    coinPending: sum(
      (r) => r.userId === userId && r.unit === Currency.COIN && r.status === LedgerStatus.PENDING,
    ),
  });
  return {
    rows,
    reservations,
    trace,
    // The enforced-grant path runs check+append inside withServiceTx; the fake just runs the fn.
    withServiceTx: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}),
    acquireUserLock: async (userId: string) => {
      trace.push(`lock:${userId}`);
    },
    append: async (entry: NewLedgerEntry) => {
      trace.push("append");
      if (entry.refId && rows.some((r) => r.refType === entry.refType && r.refId === entry.refId)) {
        return false; // idempotent no-op
      }
      rows.push({ ...entry, createdAt: new Date() } as Row);
      return true;
    },
    balanceService: async (userId: string) => balance(userId),
    balanceSelf: async (userId: string) => balance(userId),
    // Mirrors the real repo: organic earnings only — admin rows (createdBy set) and every
    // compensating refund never consume cap headroom. Same reason list as the SQL predicate.
    coinEarnedSince: async (userId: string) => {
      trace.push("capRead");
      return sum(
        (r) =>
          r.userId === userId &&
          r.unit === Currency.COIN &&
          r.amount > 0 &&
          r.createdBy == null &&
          !(CORRECTION_REASONS as readonly string[]).includes(r.reason),
      );
    },
    activeCoinReservationAmountSince: async (
      userId: string,
      since: Date,
      now: Date,
    ) =>
      reservations
        .filter(
          (r) =>
            r.userId === userId &&
            r.status === "ACTIVE" &&
            r.expiresAt > now &&
            r.createdAt >= since,
        )
        .reduce((total, r) => total + r.amount, 0),
    insertCoinReservation: async (entry: {
      userId: string;
      amount: number;
      source: string;
      refId: string;
      expiresAt: Date;
    }) => {
      if (reservations.some((r) => r.source === entry.source && r.refId === entry.refId)) {
        return false;
      }
      reservations.push({ ...entry, status: "ACTIVE", createdAt: new Date() });
      return true;
    },
    findCoinReservation: async (source: string, refId: string) =>
      reservations.find((r) => r.source === source && r.refId === refId),
    setCoinReservationStatus: async (
      source: string,
      refId: string,
      status: "SETTLED" | "RELEASED",
    ) => {
      const row = reservations.find((r) => r.source === source && r.refId === refId);
      if (row) row.status = status;
    },
    coinChatSpendsSince: async (userId: string, reason?: string) =>
      rows.filter(
        (r) =>
          r.userId === userId &&
          r.unit === Currency.COIN &&
          r.amount < 0 &&
          (!reason || r.reason === reason),
      ).length,
    existsByRef: async (refType: string, refId: string) =>
      rows.some((r) => r.refType === refType && r.refId === refId),
    findByRef: async (refType: string, refId: string) =>
      rows.find((r) => r.refType === refType && r.refId === refId),
  };
}

function makeConfigFake(values: Record<string, number>) {
  return { get: async (key: string) => values[key] ?? 0 };
}

const CAPS = {
  "economy.coin.daily_cap": 50,
  "economy.coin.weekly_cap": 200,
  "economy.coin.min_xp_for_coin": 0,
};

describe("EconomyService", () => {
  let repo: ReturnType<typeof makeRepoFake>;
  let events: { emit: ReturnType<typeof vi.fn> };

  const service = (caps: Record<string, number> = CAPS) =>
    new EconomyService(repo as never, makeConfigFake(caps) as never, events as never);

  beforeEach(() => {
    repo = makeRepoFake();
    events = { emit: vi.fn() };
  });

  it("grants XP (always confirmed) and reflects it in balance", async () => {
    const bal = await service().grant("u1", Currency.XP, 30, { reason: "test" });
    expect(bal.xp).toBe(30);
  });

  it("emits the ready-to-render level only after a new XP grant is persisted", async () => {
    const svc = service();

    await svc.grant("u1", Currency.XP, 100, {
      reason: "quest.daily",
      refType: "quest",
      refId: "q1",
    });
    await svc.grant("u1", Currency.XP, 100, {
      reason: "quest.daily",
      refType: "quest",
      refId: "q1",
    });
    await svc.grant("u1", Currency.COIN, 5, { reason: "coin", enforceLimits: false });

    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith(
      "economy.xp.changed",
      expect.objectContaining({
        userId: "u1",
        level: expect.objectContaining({ tier: 2, key: "trail" }),
      }),
    );
  });

  it("defers an XP grant inside a caller-owned transaction until publishXpChanged is called", async () => {
    const svc = service();

    const inserted = await svc.grantInServiceTx(
      "u1",
      Currency.XP,
      100,
      { reason: "quest.daily", refType: "quest", refId: "q2" },
      {} as never,
    );

    expect(inserted).toBe(true);
    expect(events.emit).not.toHaveBeenCalled();

    await svc.publishXpChanged("u1");
    expect(events.emit).toHaveBeenCalledTimes(1);
  });

  it("returns a ready-to-render journey level with self balance", async () => {
    const svc = service();
    await svc.grant("u1", Currency.XP, 411, { reason: "test" });

    const balance = await svc.getSelfBalance("u1");

    expect(balance.level).toMatchObject({
      tier: 3,
      key: "compass",
      chapter: "awakening",
      currentAt: 300,
      nextAt: 600,
      nextKey: "cycle",
      progress: { current: 111, target: 300, remaining: 189, percent: 37 },
    });
  });

  it("separates confirmed vs pending coin in the balance", async () => {
    const svc = service();
    await svc.grant("u1", Currency.COIN, 10, { reason: "a", enforceLimits: false });
    await svc.grant("u1", Currency.COIN, 5, {
      reason: "b",
      status: LedgerStatus.PENDING,
      enforceLimits: false,
    });
    const bal = await svc.getAdminBalance("u1");
    expect(bal).toMatchObject({ coinConfirmed: 10, coinPending: 5 });
  });

  it("rejects coin earning over the daily cap (ECONOMY_LIMIT_EXCEEDED)", async () => {
    await expect(service().grant("u1", Currency.COIN, 60, { reason: "big" })).rejects.toMatchObject({
      constructor: DomainError,
      code: ErrorCode.ECONOMY_LIMIT_EXCEEDED,
    });
  });

  it("rejects coin earning below the min-XP threshold", async () => {
    const svc = service({ ...CAPS, "economy.coin.min_xp_for_coin": 100 });
    await expect(svc.grant("u1", Currency.COIN, 5, { reason: "x" })).rejects.toMatchObject({
      code: ErrorCode.ECONOMY_LIMIT_EXCEEDED,
    });
  });

  it("admin correction (enforceLimits:false) bypasses caps", async () => {
    const bal = await service().grant("u1", Currency.COIN, 999, {
      reason: "admin.manual-adjust",
      enforceLimits: false,
    });
    expect(bal.coinConfirmed).toBe(999);
  });

  it("refunds and admin adjustments do not consume the organic earning cap", async () => {
    const svc = service();
    // 40 coin of refund + 999 of admin adjust land first — neither is organic earning.
    await svc.grant("u1", Currency.COIN, 40, { reason: "ai.chat.refund", enforceLimits: false });
    await svc.grant("u1", Currency.COIN, 999, {
      reason: "support correction",
      actorId: "admin-1",
      enforceLimits: false,
    });
    // Daily cap is 50; the full 50 must still be grantable organically.
    const bal = await svc.grant("u1", Currency.COIN, 50, { reason: "quest.onboarding.email-verified" });
    expect(bal.coinConfirmed).toBe(40 + 999 + 50);
  });

  it("streak-freeze refund does not consume the organic earning cap either", async () => {
    const svc = service();
    // A failed freeze apply refunds the debit — a correction, not earning.
    await svc.grant("u1", Currency.COIN, 20, {
      reason: EconomyLedger.STREAK_FREEZE_REFUND_REASON,
      enforceLimits: false,
    });
    // Daily cap is 50; the refund must leave the full organic headroom intact.
    const bal = await svc.grant("u1", Currency.COIN, 50, { reason: "quest.weekly.effort-allowance" });
    expect(bal.coinConfirmed).toBe(20 + 50);
  });

  it("is idempotent on refType/refId", async () => {
    const svc = service();
    await svc.grant("u1", Currency.COIN, 10, { reason: "invite", refType: "invite", refId: "inv1", enforceLimits: false });
    await svc.grant("u1", Currency.COIN, 10, { reason: "invite", refType: "invite", refId: "inv1", enforceLimits: false });
    const bal = await svc.getAdminBalance("u1");
    expect(bal.coinConfirmed).toBe(10);
  });

  it("spends coin when balance is sufficient", async () => {
    const svc = service();
    await svc.grant("u1", Currency.COIN, 10, { reason: "test", enforceLimits: false });
    const result = await svc.spend("u1", 5, {
      reason: "ai.chat.spend",
      refType: "ai_chat",
      refId: "msg-1",
    });
    expect(result.alreadySpent).toBe(false);
    expect(result.balance.coinConfirmed).toBe(5);
  });

  it("rejects spend when balance is insufficient (INSUFFICIENT_COIN)", async () => {
    await expect(
      service().spend("u1", 5, { reason: "ai.chat.spend", refType: "ai_chat", refId: "msg-2" }),
    ).rejects.toMatchObject({ code: ErrorCode.INSUFFICIENT_COIN });
  });

  it("capped coin grant acquires the per-user lock before cap reads and append (F1)", async () => {
    await service().grant("u1", Currency.COIN, 10, { reason: "quest.x" });
    expect(repo.trace[0]).toBe("lock:u1");
    expect(repo.trace.indexOf("capRead")).toBeGreaterThan(0);
    expect(repo.trace.indexOf("append")).toBeGreaterThan(repo.trace.indexOf("capRead"));
  });

  it("XP grants and enforceLimits:false corrections skip the lock (pure inserts)", async () => {
    const svc = service();
    await svc.grant("u1", Currency.XP, 5, { reason: "quest.daily" });
    await svc.grant("u1", Currency.COIN, 99, { reason: "admin", enforceLimits: false });
    expect(repo.trace.filter((t) => t.startsWith("lock:"))).toHaveLength(0);
  });

  it("spend acquires the per-user lock before the balance check (F1)", async () => {
    const svc = service();
    await svc.grant("u1", Currency.COIN, 10, { reason: "seed", enforceLimits: false });
    repo.trace.length = 0;
    await svc.spend("u1", 5, { reason: "ai.chat.spend", refType: "ai_chat", refId: "m1" });
    expect(repo.trace[0]).toBe("lock:u1");
    expect(repo.trace.indexOf("append")).toBeGreaterThan(0);
  });

  it("spend is idempotent on refType/refId", async () => {
    const svc = service();
    await svc.grant("u1", Currency.COIN, 10, { reason: "test", enforceLimits: false });
    await svc.spend("u1", 5, { reason: "ai.chat.spend", refType: "ai_chat", refId: "msg-3" });
    const second = await svc.spend("u1", 5, { reason: "ai.chat.spend", refType: "ai_chat", refId: "msg-3" });
    expect(second.alreadySpent).toBe(true);
    expect(second.balance.coinConfirmed).toBe(5);
  });

  const REVERSE_OPTS = {
    originalRefType: "invite-redemption",
    originalRefId: "r1",
    reason: "invite.reverted",
    refType: "invite_reversal",
    refId: "r1",
  };

  it("reverse debits the originally granted amount", async () => {
    const svc = service();
    await svc.grant("u1", Currency.COIN, 20, {
      reason: "invite.converted",
      refType: "invite-redemption",
      refId: "r1",
      enforceLimits: false,
    });
    const reversed = await svc.reverse("u1", REVERSE_OPTS);
    expect(reversed).toBe(20);
    expect((await svc.getAdminBalance("u1")).coinConfirmed).toBe(0);
  });

  it("reverse clamps to the confirmed balance (never negative)", async () => {
    const svc = service();
    await svc.grant("u1", Currency.COIN, 20, {
      reason: "invite.converted",
      refType: "invite-redemption",
      refId: "r1",
      enforceLimits: false,
    });
    await svc.spend("u1", 15, { reason: "ai.chat.spend", refType: "ai_chat", refId: "m1" });
    const reversed = await svc.reverse("u1", REVERSE_OPTS);
    expect(reversed).toBe(5);
    expect((await svc.getAdminBalance("u1")).coinConfirmed).toBe(0);
  });

  it("reverse is idempotent — a second call reverses nothing", async () => {
    const svc = service();
    await svc.grant("u1", Currency.COIN, 20, {
      reason: "invite.converted",
      refType: "invite-redemption",
      refId: "r1",
      enforceLimits: false,
    });
    await svc.reverse("u1", REVERSE_OPTS);
    const second = await svc.reverse("u1", REVERSE_OPTS);
    expect(second).toBe(0);
    expect((await svc.getAdminBalance("u1")).coinConfirmed).toBe(0);
  });

  it("reverse no-ops when the original grant never landed (cap-denied)", async () => {
    const reversed = await service().reverse("u1", REVERSE_OPTS);
    expect(reversed).toBe(0);
    expect(repo.rows).toHaveLength(0);
  });

  it("counts an active reward reservation against the organic daily cap", async () => {
    const svc = service({ ...CAPS, "economy.coin.daily_cap": 10 });
    const tx = {} as never;

    await svc.reserveCoinGrantInServiceTx(
      "u1",
      5,
      {
        source: "ad_reward",
        refId: "session-1",
        expiresAt: new Date(Date.now() + 60_000),
      },
      tx,
    );

    await expect(
      svc.grant("u1", Currency.COIN, 6, { reason: "quest.weekly" }),
    ).rejects.toMatchObject({ code: ErrorCode.ECONOMY_LIMIT_EXCEEDED });
  });

  it("settles a reserved reward into the append-only ledger exactly once", async () => {
    const svc = service();
    const tx = {} as never;
    const reservation = {
      source: "ad_reward",
      refId: "session-2",
      expiresAt: new Date(Date.now() + 60_000),
    };
    await svc.reserveCoinGrantInServiceTx("u1", 5, reservation, tx);

    await svc.settleCoinGrantInServiceTx(
      "u1",
      {
        source: reservation.source,
        refId: reservation.refId,
        reason: "ad.reward.completed",
        ledgerRefType: "ad_reward",
        ledgerRefId: reservation.refId,
      },
      tx,
    );
    await svc.settleCoinGrantInServiceTx(
      "u1",
      {
        source: reservation.source,
        refId: reservation.refId,
        reason: "ad.reward.completed",
        ledgerRefType: "ad_reward",
        ledgerRefId: reservation.refId,
      },
      tx,
    );

    expect((await svc.getAdminBalance("u1")).coinConfirmed).toBe(5);
    expect(repo.reservations[0]?.status).toBe("SETTLED");
  });

  it("releases an unfinished reservation so later earnings can use the capacity", async () => {
    const svc = service({ ...CAPS, "economy.coin.daily_cap": 10 });
    const tx = {} as never;
    const reservation = {
      source: "ad_reward",
      refId: "session-3",
      expiresAt: new Date(Date.now() + 60_000),
    };
    await svc.reserveCoinGrantInServiceTx("u1", 5, reservation, tx);
    await svc.releaseCoinGrantInServiceTx("u1", reservation, tx);

    await expect(
      svc.grant("u1", Currency.COIN, 10, { reason: "quest.weekly" }),
    ).resolves.toMatchObject({ coinConfirmed: 10 });
  });
});
