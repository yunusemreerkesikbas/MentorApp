import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiBudgetGuard } from "./ai-budget.guard";

describe("AiBudgetGuard", () => {
  let configGet: ReturnType<typeof vi.fn>;
  let windowSince: ReturnType<typeof vi.fn>;
  let guard: AiBudgetGuard;

  // cents → guard multiplies by 10_000 to reach micro-USD.
  const setup = (capCents: number, spentMicros: number) => {
    configGet = vi.fn(async () => capCents);
    windowSince = vi.fn(async () => ({ costMicros: spentMicros, calls: 0, promptTokens: 0, completionTokens: 0 }));
    guard = new AiBudgetGuard({ get: configGet } as never, { windowSince } as never);
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
});
