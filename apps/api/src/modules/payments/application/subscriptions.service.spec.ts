import { describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { SubscriptionsService, nextPeriodEnd } from "./subscriptions.service";

const MONTH = 1;
const addMonths = (d: Date, m: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
};

describe("nextPeriodEnd (renewal period base — review #2)", () => {
  const now = new Date("2026-06-12T10:00:00Z");

  it("extends from the current period end when it is still in the future (late webhook)", () => {
    // Renewal webhook arrives 2 days before the period ends → must NOT lose those days.
    const periodEnd = new Date("2026-06-14T10:00:00Z");
    expect(nextPeriodEnd(now, periodEnd, MONTH).getTime()).toBe(addMonths(periodEnd, MONTH).getTime());
  });

  it("extends from now when the period already expired", () => {
    const expired = new Date("2026-06-01T10:00:00Z");
    expect(nextPeriodEnd(now, expired, MONTH).getTime()).toBe(addMonths(now, MONTH).getTime());
  });

  it("extends from now when there is no prior period (first charge)", () => {
    expect(nextPeriodEnd(now, null, MONTH).getTime()).toBe(addMonths(now, MONTH).getTime());
  });

  it("never shortens already-paid time", () => {
    const farEnd = new Date("2026-09-12T10:00:00Z");
    expect(nextPeriodEnd(now, farEnd, MONTH).getTime()).toBeGreaterThan(farEnd.getTime());
  });
});

describe("SubscriptionsService payment availability", () => {
  const plan = {
    id: "premium-monthly",
    name: "Premium Monthly",
    periodMonths: 1,
    priceMinor: 24900,
    currency: "TRY",
    trialDays: 7,
    isActive: true,
  };

  function makeService(provider: "fake" | "disabled") {
    const plansRepo = {
      findActive: vi.fn().mockResolvedValue([plan]),
      findById: vi.fn().mockResolvedValue(plan),
    };
    const config = {
      get: vi.fn((key: string) =>
        key === "PAYMENTS_PROVIDER" ? provider : "http://localhost:3000",
      ),
    };
    const paymentProvider = { createCheckout: vi.fn() };
    const service = new SubscriptionsService(
      {} as never,
      plansRepo as never,
      {} as never,
      {} as never,
      {} as never,
      { listPolicies: vi.fn(async () => ({})) } as never,
      {} as never,
      config as never,
      paymentProvider as never,
      {} as never,
    );
    return { service, paymentProvider };
  }

  it("marks plans as not purchasable when payments are disabled", async () => {
    const { service } = makeService("disabled");

    await expect(service.listPlans()).resolves.toEqual([
      expect.objectContaining({ id: plan.id, purchaseEnabled: false }),
    ]);
  });

  it("rejects checkout before touching repositories or provider when payments are disabled", async () => {
    const { service, paymentProvider } = makeService("disabled");

    await expect(
      service.checkout({ id: "user-1", email: "user@example.com" }, plan.id),
    ).rejects.toMatchObject({ code: ErrorCode.PAYMENT_DISABLED, httpStatus: 503 });
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
  });
});

describe("SubscriptionsService plan catalog admin", () => {
  it("updates editable fields and leaves periodMonths locked", async () => {
    const existing = {
      id: "premium-monthly",
      name: "Premium Monthly",
      periodMonths: 1,
      priceMinor: 24900,
      currency: "TRY",
      trialDays: 7,
      isActive: true,
    };
    const plansRepo = {
      findById: vi.fn().mockResolvedValue(existing),
      update: vi.fn(async (_id: string, patch: Record<string, unknown>) => ({
        ...existing,
        ...patch,
      })),
    };
    const service = new SubscriptionsService(
      {} as never,
      plansRepo as never,
      {} as never,
      {} as never,
      {} as never,
      { listPolicies: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const updated = await service.updatePlan("premium-monthly", {
      name: "Premium Aylık",
      priceMinor: 29900,
    });
    expect(updated).toMatchObject({
      id: "premium-monthly",
      name: "Premium Aylık",
      periodMonths: 1,
      priceMinor: 29900,
    });
    expect(plansRepo.update).toHaveBeenCalledWith("premium-monthly", {
      name: "Premium Aylık",
      priceMinor: 29900,
    });
  });
});
