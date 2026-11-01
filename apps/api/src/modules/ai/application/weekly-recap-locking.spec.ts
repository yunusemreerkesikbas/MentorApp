import { describe, expect, it, vi } from "vitest";
import type { DatabaseTx } from "../../../database/drizzle";
import { weeklyReviewWindows } from "../../coaching/domain/weekly-review";
import { WeeklyRecapPolicyService } from "./weekly-recap-policy.service";
import { WeeklyRecapService } from "./weekly-recap.service";
import { WeeklyRecapSettlementService } from "./weekly-recap-settlement.service";

function build() {
  let locked = false;
  const tx = {} as DatabaseTx;
  const outside = <T>(value: T) => vi.fn(async () => {
    if (locked) throw new Error("A second pool connection was requested while locked");
    return value;
  });
  const inside = <T>(value: T) => vi.fn(async (...args: unknown[]) => {
    expect(locked).toBe(true);
    expect(args).toContain(tx);
    return value;
  });
  const review = { status: "READY", period: weeklyReviewWindows() };
  let row: Record<string, unknown> | undefined;
  const reports = {
    find: vi.fn(async () => row), byRequest: inside(undefined),
    reservations: inside([]), earnedCount: inside(0),
    create: vi.fn(async (values: Record<string, unknown>) => (row = { id: "report", ...values })),
    update: vi.fn(async (_old: unknown, values: Record<string, unknown>) => (row = { ...row, ...values })),
    locked: vi.fn(async (_id: string, run: (exec: DatabaseTx) => Promise<unknown>) => {
      expect(locked).toBe(false);
      locked = true;
      try { return await run(tx); } finally { locked = false; }
    }),
  };
  const config = { get: outside(true) };
  const entitlement = { getEntitlement: outside({ isPremium: false }) };
  const purchases = { history: inside([]), debit: inside(false) };
  const cache = { findAny: outside(undefined), saveFirst: inside(undefined) };
  const policy = new WeeklyRecapPolicyService(config as never,
    { getMe: outside({ emailVerified: true }) } as never, entitlement as never,
    { getSelfBalance: outside({ coinConfirmed: 100 }) } as never,
    { isUnlocked: outside(false) } as never, purchases as never, reports as never,
    { hasCapacity: outside(true) } as never, { translate: () => "denied" } as never, cache as never);
  const settings = {
    enabled: true, freeEnabled: true, freeLimit: 1, coinEnabled: true, coinLimit: 2,
    days: 30, aiEnabled: true, economy: true, cost: 25,
  };
  vi.spyOn(policy, "settings").mockImplementation(outside(settings));
  const settlement = new WeeklyRecapSettlementService(reports as never, purchases as never, policy, entitlement as never);
  const service = new WeeklyRecapService(reports as never, policy,
    { getReview: outside(review) } as never,
    { generate: outside({ narration: { narration: "summary", model: "fake" }, locale: "tr" }) } as never,
    settlement, {} as never, {} as never, cache as never);
  const user = { id: "user", roles: [], orgId: null };
  return { service, settlement, reports, purchases, user, review,
    setRow: (value: Record<string, unknown>) => { row = value; } };
}

describe("Weekly recap connection ownership", () => {
  it("prepares independent offer reads before acquiring a pool connection", async () => {
    const h = build();
    expect(await h.service.offer(h.user as never, "exam")).toMatchObject({ mode: "EARNED", canOpen: true });
  });

  it("opens and settles an earned report without nested pool reads", async () => {
    const h = build();
    expect(await h.service.open(h.user as never, {
      examId: "exam", weekStart: h.review.period.startDate, source: "EARNED",
      expectedCost: 0, clientRequestId: "request",
    })).toMatchObject({ source: "EARNED", narration: { narration: "summary" } });
    expect(h.purchases.debit).not.toHaveBeenCalled();
  });

  it("keeps Coin limits and the final debit inside the settlement transaction", async () => {
    const h = build();
    const row = { id: "report", examId: "exam", weekStart: h.review.period.startDate,
      status: "GENERATED", narration: { narration: "summary" }, source: "COIN", cost: 25 };
    h.setRow(row);
    expect(await h.settlement.settle("user", row as never)).toMatchObject({ status: "READY" });
    expect(h.purchases.debit).toHaveBeenCalledWith("user", "exam", row.weekStart, 25, expect.anything());
  });

  it("requotes an exhausted earned claim to Coin without nested pool reads", async () => {
    const h = build();
    h.reports.earnedCount.mockResolvedValue(1);
    h.setRow({ id: "report", examId: "exam", weekStart: h.review.period.startDate,
      review: h.review, status: "GENERATED", narration: { narration: "summary" }, source: "EARNED", cost: 0 });
    expect(await h.service.open(h.user as never, {
      examId: "exam", weekStart: h.review.period.startDate, source: "COIN",
      expectedCost: 25, clientRequestId: "request",
    })).toMatchObject({ source: "COIN" });
    expect(h.purchases.debit).toHaveBeenCalledTimes(1);
  });
});
