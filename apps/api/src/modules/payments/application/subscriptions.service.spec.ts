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

const plan = {
  id: "premium-monthly",
  name: "Premium Monthly",
  periodMonths: 1,
  priceMinor: 24900,
  currency: "TRY",
  trialDays: 7,
  seatCount: 0,
  isActive: true,
};

const USER = {
  id: "user-1",
  email: "user@example.com",
  createdAt: new Date("2026-08-30T00:00:00Z"),
  orgId: null,
};

/** No promotion applies — the list price stands. */
const LIST_OFFER = {
  planId: plan.id,
  listPriceMinor: 24900,
  discountMinor: 0,
  chargedPriceMinor: 24900,
  renewalPriceMinor: 24900,
  promotionId: null,
  summary: null,
  reason: null,
};

const DISCOUNTED_OFFER = {
  ...LIST_OFFER,
  discountMinor: 4980,
  chargedPriceMinor: 19920,
  promotionId: "promo-1",
  summary: {
    code: "HOSGELDIN",
    label: "Hoş geldin hediyesi",
    discountType: "PERCENT" as const,
    discountValue: 20,
    appliesToPeriods: 1,
    endsAt: null,
  },
};

describe("SubscriptionsService payment availability", () => {
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
      {} as never,
      {} as never,
      config as never,
      // The DB-backed registry: seat billing off, like production.
      { get: vi.fn(async () => false) } as never,
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

    await expect(service.checkout(USER, plan.id)).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_DISABLED,
      httpStatus: 503,
    });
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
  });
});

describe("SubscriptionsService checkout with a promotion", () => {
  function makeService(offer: typeof LIST_OFFER) {
    const tx = { execute: vi.fn() };
    const db = { transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };
    const plansRepo = {
      findActive: vi.fn().mockResolvedValue([plan]),
      findById: vi.fn().mockResolvedValue(plan),
    };
    const subsRepo = {
      findOpenForUser: vi.fn().mockResolvedValue(undefined),
      hasAnyForUser: vi.fn().mockResolvedValue(false),
      findLatestForUser: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({ id: "sub-1" }),
    };
    const promotions = {
      resolveOffers: vi.fn().mockResolvedValue({ offers: { [plan.id]: offer }, available: [] }),
      reserve: vi.fn().mockResolvedValue(null),
      voidForSubscription: vi.fn(),
    };
    const config = {
      get: vi.fn((key: string) =>
        key === "PAYMENTS_PROVIDER" ? "fake" : "http://localhost:3000",
      ),
    };
    const paymentProvider = {
      provider: "FAKE",
      instantCheckout: true,
      createCheckout: vi
        .fn()
        .mockResolvedValue({ checkoutUrl: "https://pay/x", providerRef: "ref-1" }),
    };
    const service = new SubscriptionsService(
      db as never,
      plansRepo as never,
      subsRepo as never,
      {} as never,
      {} as never,
      { listPolicies: vi.fn(async () => ({})) } as never,
      promotions as never,
      { listActiveDatesSince: vi.fn(async () => []) } as never,
      {} as never,
      config as never,
      // The DB-backed registry: seat billing off, like production.
      { get: vi.fn(async () => false) } as never,
      paymentProvider as never,
      {} as never,
    );
    return { service, subsRepo, promotions, paymentProvider, db, tx };
  }

  it("sends the discounted amount to the provider, keeping the list price intact", async () => {
    const { service, paymentProvider } = makeService(DISCOUNTED_OFFER);

    await service.checkout(USER, plan.id, "HOSGELDIN");

    expect(paymentProvider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({
          priceMinor: 24900,
          chargeAmountMinor: 19920,
          renewalAmountMinor: 24900,
          discountPeriods: 1,
        }),
      }),
    );
  });

  it("sends the list price when no promotion applies", async () => {
    const { service, paymentProvider, promotions } = makeService(LIST_OFFER);

    await service.checkout(USER, plan.id);

    expect(paymentProvider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({ chargeAmountMinor: 24900, discountPeriods: 0 }),
      }),
    );
    expect(promotions.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ offer: LIST_OFFER }),
    );
  });

  it("commits the subscription and the redemption in one transaction", async () => {
    const { service, subsRepo, promotions, db, tx } = makeService(DISCOUNTED_OFFER);

    await service.checkout(USER, plan.id, "HOSGELDIN");

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(subsRepo.create).toHaveBeenCalledWith(expect.any(Object), tx);
    expect(promotions.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ tx, subscriptionId: "sub-1", offer: DISCOUNTED_OFFER }),
    );
  });

  it("fails a typed code that does not stick rather than charging the list price", async () => {
    const { service, paymentProvider } = makeService({ ...LIST_OFFER, reason: "NOT_FOUND" });

    await expect(service.checkout(USER, plan.id, "YANLIS")).rejects.toMatchObject({
      code: ErrorCode.PROMOTION_NOT_FOUND,
      httpStatus: 422,
    });
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
  });

  it("releases the promotion seat held by an abandoned INCOMPLETE checkout", async () => {
    const { service, subsRepo, promotions } = makeService(LIST_OFFER);
    subsRepo.findOpenForUser.mockResolvedValueOnce({ id: "old-sub", status: "INCOMPLETE" });
    (subsRepo as unknown as { deleteById: unknown }).deleteById = vi.fn();

    await service.checkout(USER, plan.id);

    expect(promotions.voidForSubscription).toHaveBeenCalledWith("old-sub");
  });
});

describe("SubscriptionsService webhook amounts", () => {
  function makeService(redemption: { chargedPriceMinor: number } | undefined) {
    const subsRepo = {
      findByProviderRef: vi.fn().mockResolvedValue({
        id: "sub-1",
        userId: "user-1",
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }),
      update: vi.fn(),
    };
    const plansRepo = { findById: vi.fn().mockResolvedValue(plan) };
    const eventsRepo = { appendTransaction: vi.fn() };
    const promotions = {
      findActiveForSubscription: vi.fn().mockResolvedValue(redemption),
      consumePeriod: vi.fn().mockResolvedValue(0),
      markApplied: vi.fn(),
    };
    const service = new SubscriptionsService(
      {} as never,
      plansRepo as never,
      subsRepo as never,
      eventsRepo as never,
      {} as never,
      {} as never,
      promotions as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, eventsRepo, promotions };
  }

  const event = {
    eventId: "evt-1",
    type: "payment_succeeded" as const,
    providerRef: "ref-1",
    occurredAt: new Date().toISOString(),
  };

  it("ledgers the agreed discounted price when the provider omits the amount", async () => {
    const { service, eventsRepo } = makeService({ chargedPriceMinor: 19920 });

    const effects = await service.applyProviderEvent(event, {} as never);

    expect(eventsRepo.appendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 19920 }),
      expect.anything(),
    );
    // The e-Arşiv invoice must show the same figure — never the list price.
    expect(effects.invoice?.expectedMinor).toBe(19920);
  });

  it("falls back to the list price for an undiscounted subscription", async () => {
    const { service, eventsRepo } = makeService(undefined);

    await service.applyProviderEvent(event, {} as never);

    expect(eventsRepo.appendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 24900 }),
      expect.anything(),
    );
  });

  it("prefers the provider's reported amount when it sends one", async () => {
    const { service, eventsRepo } = makeService({ chargedPriceMinor: 19920 });

    await service.applyProviderEvent({ ...event, amountMinor: 19920 }, {} as never);

    expect(eventsRepo.appendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 19920 }),
      expect.anything(),
    );
  });

  it("consumes one discount period per succeeded charge, and none without a discount", async () => {
    const discounted = makeService({ chargedPriceMinor: 19920 });
    await discounted.service.applyProviderEvent(event, {} as never);
    expect(discounted.promotions.consumePeriod).toHaveBeenCalledWith("sub-1", expect.anything());

    const plain = makeService(undefined);
    await plain.service.applyProviderEvent(event, {} as never);
    expect(plain.promotions.consumePeriod).not.toHaveBeenCalled();
  });

  it("does not consume a period on a failed charge", async () => {
    const { service, promotions } = makeService({ chargedPriceMinor: 19920 });

    await service.applyProviderEvent({ ...event, type: "payment_failed" }, {} as never);

    expect(promotions.consumePeriod).not.toHaveBeenCalled();
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
      seatCount: 0,
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
