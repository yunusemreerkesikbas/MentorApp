import { beforeEach, describe, expect, it } from "vitest";
import { Currency, LedgerStatus } from "@mentor/types";
import { ErrorCode } from "../../../common/errors/error-code";
import { DomainError } from "../../../common/errors/domain-error";
import { EconomyService } from "./economy.service";
import type { NewLedgerEntry } from "../infrastructure/ledger.repository";

interface Row extends NewLedgerEntry {
  createdAt: Date;
}

/** In-memory ledger fake (append-only; ref dedupe; balance = sum). */
function makeRepoFake() {
  const rows: Row[] = [];
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
    // The enforced-grant path runs check+append inside withServiceTx; the fake just runs the fn.
    withServiceTx: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}),
    append: async (entry: NewLedgerEntry) => {
      if (entry.refId && rows.some((r) => r.refType === entry.refType && r.refId === entry.refId)) {
        return; // idempotent no-op
      }
      rows.push({ ...entry, createdAt: new Date() } as Row);
    },
    balanceService: async (userId: string) => balance(userId),
    balanceSelf: async (userId: string) => balance(userId),
    // Mirrors the real repo: organic earnings only — admin rows (createdBy set) and
    // ai.chat.refund rows never consume cap headroom.
    coinEarnedSince: async (userId: string) =>
      sum(
        (r) =>
          r.userId === userId &&
          r.unit === Currency.COIN &&
          r.amount > 0 &&
          r.createdBy == null &&
          r.reason !== "ai.chat.refund",
      ),
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

  const service = (caps: Record<string, number> = CAPS) =>
    new EconomyService(repo as never, makeConfigFake(caps) as never);

  beforeEach(() => {
    repo = makeRepoFake();
  });

  it("grants XP (always confirmed) and reflects it in balance", async () => {
    const bal = await service().grant("u1", Currency.XP, 30, { reason: "test" });
    expect(bal.xp).toBe(30);
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

  it("spend is idempotent on refType/refId", async () => {
    const svc = service();
    await svc.grant("u1", Currency.COIN, 10, { reason: "test", enforceLimits: false });
    await svc.spend("u1", 5, { reason: "ai.chat.spend", refType: "ai_chat", refId: "msg-3" });
    const second = await svc.spend("u1", 5, { reason: "ai.chat.spend", refType: "ai_chat", refId: "msg-3" });
    expect(second.alreadySpent).toBe(true);
    expect(second.balance.coinConfirmed).toBe(5);
  });
});
