import { describe, expect, it, vi } from "vitest";
import { Currency } from "@mentor/types";
import { EconomyStatsService } from "./economy-stats.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_FLOW = { coinCredited: 0, coinDebited: 0, xpCredited: 0, rows: 0 };

/** Days between `since` and now, rounded — lets tests assert which window was requested. */
const windowDays = (since: Date) => Math.round((Date.now() - since.getTime()) / DAY_MS);

function makeLedgerFake() {
  return {
    flowSince: vi.fn(async () => EMPTY_FLOW),
    byReasonSince: vi.fn(async () => []),
    correctionsSince: vi.fn(async () => ({ credited: 0, debited: 0, rows: 0 })),
    outstandingFloat: vi.fn(async () => ({ coinConfirmed: 0, holders: 0 })),
    distinctEarnersSince: vi.fn(async () => 0),
    distinctXpActiveSince: vi.fn(async () => 0),
  };
}

const service = (ledger: ReturnType<typeof makeLedgerFake>) =>
  new EconomyStatsService(ledger as never);

describe("EconomyStatsService", () => {
  it("reads the three rolling windows (1d / 7d / 30d)", async () => {
    const ledger = makeLedgerFake();
    await service(ledger).getStats();

    const requested = ledger.flowSince.mock.calls.map(([since]) => windowDays(since as Date));
    expect(requested).toEqual([1, 7, 30]);
  });

  it("breaks COIN and XP down separately over the 30d window", async () => {
    const ledger = makeLedgerFake();
    await service(ledger).getStats();

    // A swapped unit here would silently show XP flow as the coin faucet.
    const [coinCall, xpCall] = ledger.byReasonSince.mock.calls;
    expect(coinCall?.[0]).toBe(Currency.COIN);
    expect(xpCall?.[0]).toBe(Currency.XP);
    expect(windowDays(coinCall?.[1] as Date)).toBe(30);
    expect(windowDays(xpCall?.[1] as Date)).toBe(30);
  });

  it("measures faucet reach on the weekly allowance quest over 7 days", async () => {
    const ledger = makeLedgerFake();
    await service(ledger).getStats();

    const [reason, since] = ledger.distinctEarnersSince.mock.calls[0] ?? [];
    // The reason string keys ledger rows — a typo would silently report zero reach forever.
    expect(reason).toBe("quest.weekly.effort-allowance");
    expect(windowDays(since as Date)).toBe(7);
    expect(windowDays(ledger.distinctXpActiveSince.mock.calls[0]?.[0] as Date)).toBe(7);
  });

  it("keeps admin corrections out of the organic breakdown", async () => {
    const ledger = makeLedgerFake();
    ledger.correctionsSince = vi.fn(async () => ({ credited: 500, debited: 0, rows: 2 }));

    const stats = await service(ledger).getStats();

    expect(stats.corrections).toEqual({ credited: 500, debited: 0, rows: 2 });
    expect(stats.coinByReason).toEqual([]); // organic breakdown is a separate repo query
  });

  it("returns a zeroed snapshot on an empty ledger", async () => {
    const stats = await service(makeLedgerFake()).getStats();

    expect(stats.windows.d30).toEqual(EMPTY_FLOW);
    expect(stats.float).toEqual({ coinConfirmed: 0, holders: 0 });
    expect(stats.faucetReach).toEqual({ earners7d: 0, activeUsers7d: 0 });
    expect(Date.parse(stats.generatedAt)).not.toBeNaN();
  });
});
