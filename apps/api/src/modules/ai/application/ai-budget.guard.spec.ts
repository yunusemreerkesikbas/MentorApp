import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiBudgetGuard } from "./ai-budget.guard";

describe("AiBudgetGuard", () => {
  let configGet: ReturnType<typeof vi.fn>;
  let windowSince: ReturnType<typeof vi.fn>;
  let reserveIfAvailable: ReturnType<typeof vi.fn>;
  let release: ReturnType<typeof vi.fn>;
  let guard: AiBudgetGuard;

  // cents → guard multiplies by 10_000 to reach micro-USD.
  const setup = (capCents: number, spentMicros: number) => {
    configGet = vi.fn(async (key: string) =>
      key === "ai.budget.monthly_cap_usd_cents" ? capCents : 5,
    );
    windowSince = vi.fn(async () => ({ costMicros: spentMicros, calls: 0, promptTokens: 0, completionTokens: 0 }));
    reserveIfAvailable = vi.fn(async () => "reservation-id");
    release = vi.fn(async () => undefined);
    guard = new AiBudgetGuard(
      { get: configGet } as never,
      { windowSince } as never,
      { reserveIfAvailable, release } as never,
    );
  };

  beforeEach(() => setup(0, 0));

  it("allows everything when the cap is 0 (disabled) and never queries spend", async () => {
    setup(0, 999_999_999);
    expect(await guard.isWithinBudget()).toBe(true);
    await expect(guard.assertWithinBudget()).resolves.toBeUndefined();
    expect(windowSince).not.toHaveBeenCalled();
  });

  it("allows when month-to-date spend is under the cap", async () => {
    // cap $50 = 5000 cents = 50_000_000 micros; spent 40_000_000.
    setup(5000, 40_000_000);
    expect(await guard.isWithinBudget()).toBe(true);
    await expect(guard.assertWithinBudget()).resolves.toBeUndefined();
  });

  it("blocks (throws) when spend has reached the cap", async () => {
    setup(5000, 50_000_000);
    expect(await guard.isWithinBudget()).toBe(false);
    await expect(guard.assertWithinBudget()).rejects.toMatchObject({ code: "AI_BUDGET_EXCEEDED" });
  });

  it("caches month-to-date spend across calls (one aggregation)", async () => {
    setup(5000, 10_000_000);
    await guard.isWithinBudget();
    await guard.isWithinBudget();
    await guard.getStatus();
    expect(windowSince).toHaveBeenCalledTimes(1);
  });

  it("getStatus reports cap, spend, and exceeded flag", async () => {
    setup(5000, 50_000_000);
    const status = await guard.getStatus();
    expect(status).toEqual({ capMicros: 50_000_000, spentMicros: 50_000_000, exceeded: true });
  });

  it("atomically reserves a conservative per-call allowance", async () => {
    setup(5000, 40_000_000);

    await expect(guard.acquire()).resolves.toBe("reservation-id");

    expect(reserveIfAvailable).toHaveBeenCalledWith({
      capMicros: 50_000_000,
      amountMicros: 50_000,
      windowStart: expect.any(Date),
      expiresAt: expect.any(Date),
    });
  });

  it("rejects when committed spend plus active reservations consumes the cap", async () => {
    setup(5000, 40_000_000);
    reserveIfAvailable.mockResolvedValue(null);

    await expect(guard.acquire()).rejects.toMatchObject({ code: "AI_BUDGET_EXCEEDED" });
  });

  it("does not create a reservation when the cap is disabled", async () => {
    setup(0, 0);

    await expect(guard.acquire()).resolves.toBeNull();
    expect(reserveIfAvailable).not.toHaveBeenCalled();
  });

  it("releases an acquired allowance after provider failure", async () => {
    setup(5000, 0);

    await guard.release("reservation-id");

    expect(release).toHaveBeenCalledWith("reservation-id");
  });
});
