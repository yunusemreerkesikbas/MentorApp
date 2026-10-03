import { describe, expect, it, vi } from "vitest";
import { CONFIG_CATALOG, type ConfigKey } from "../../../common/config/config.catalog";
import { ErrorCode } from "../../../common/errors/error-code";
import { SubscriptionsService, nextPeriodEnd } from "./subscriptions.service";
import { DomainError } from "../../../common/errors/domain-error";
import { CheckoutService } from "./checkout.service";
import { CheckoutRejectedError } from "../domain/checkout-rejected.error";

function trialStub() {
  return {
    eligibility: vi.fn(async () => ({ eligible: true, reason: "AVAILABLE" })),
    pendingCheckoutUrl: vi.fn(async () => null),
    resume: vi.fn(async () => null),
    selectTrial: vi.fn(async (_user: string, days: number, requested: boolean | undefined, used: boolean) => requested !== false && days > 0 && !used),
    reserve: vi.fn(async () => ({ id: "claim-1" })),
    bind: vi.fn(), saveCheckout: vi.fn(), consume: vi.fn(), release: vi.fn(), releaseForSubscription: vi.fn(),
  };
}

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

/** The DB-backed registry at its catalog defaults (production today), with per-test overrides. */
function registryWith(overrides: Partial<Record<ConfigKey, unknown>> = {}) {
  return {
    get: vi.fn(async (key: ConfigKey) =>
      key in overrides ? overrides[key] : CONFIG_CATALOG[key].default,
    ),
  };
}

describe("SubscriptionsService payment availability", () => {
  function makeService(
    provider: "fake" | "disabled",
    flags: Partial<Record<ConfigKey, unknown>> = {},
    plans: Array<typeof plan> = [plan],
  ) {
    const plansRepo = {
      findActive: vi.fn().mockResolvedValue(plans),
      findById: vi.fn().mockResolvedValue(plans[0]),
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
      registryWith(flags) as never,
      paymentProvider as never,
      {} as never,
      { append: vi.fn() } as never,
      trialStub() as never,
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

  it("hands students to the stores while their web checkout is off", async () => {
    const { service } = makeService("fake", {
      "payments.web.enabled": false,
      "payments.mobile.enabled": true,
      "payments.web.redirect_to_mobile": true,
    });

    await expect(service.listPlans()).resolves.toEqual([
      expect.objectContaining({ id: plan.id, purchaseEnabled: false, redirectToMobile: true }),
    ]);
  });

  it("lists a coach plan through the coach store channel alone", async () => {
    const coachPlan = { ...plan, id: "coach-pro-10", seatCount: 10 };
    const { service } = makeService(
      "fake",
      { "mentorship.seats.mobile_billing_enabled": true, "payments.web.redirect_to_mobile": true },
      [plan, coachPlan],
    );

    await expect(service.listPlans()).resolves.toEqual([
      expect.objectContaining({ id: plan.id, purchaseEnabled: true, redirectToMobile: false }),
      expect.objectContaining({ id: coachPlan.id, purchaseEnabled: false, redirectToMobile: true }),
    ]);
  });

  it("refuses a student checkout by id while student web checkout is off", async () => {
    const { service, paymentProvider } = makeService("fake", { "payments.web.enabled": false });

    await expect(service.checkout(USER, plan.id)).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_DISABLED,
      httpStatus: 503,
    });
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
  });
});

describe("SubscriptionsService checkout with a promotion", () => {
  function makeService(
    offer: typeof LIST_OFFER,
    flags: Partial<Record<ConfigKey, unknown>> = {},
  ) {
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
      lockById: vi.fn().mockResolvedValue({ id: "sub-1", status: "INCOMPLETE" }),
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
    const trials = trialStub();
    const users = { lockActiveAccount: vi.fn(async () => true) };
    const events = { emit: vi.fn() };
    (subsRepo as unknown as { update: unknown }).update = vi.fn();
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
      registryWith(flags) as never,
      paymentProvider as never,
      {} as never,
      { append: vi.fn() } as never,
      trials as never,
      new CheckoutService(db as never, subsRepo as never, promotions as never, trials as never, paymentProvider as never, users as never, events as never),
    );
    return { service, subsRepo, promotions, paymentProvider, db, tx, trials, users, events };
  }

  /** A subscriber whose paid period ran out last month: the win-back audience. */
  const LAPSED_SUBSCRIPTION = {
    id: "sub-0",
    userId: USER.id,
    planId: plan.id,
    status: "EXPIRED",
    provider: "FAKE",
    providerRef: "ref-0",
    sponsorLinkId: null,
    trialEndsAt: null,
    currentPeriodStart: new Date("2026-07-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-08-01T00:00:00Z"),
    cancelAtPeriodEnd: false,
    createdAt: new Date("2026-07-01T00:00:00Z"),
  };

  it("resolves no promotion for plans the web cannot sell", async () => {
    const { service } = makeService(DISCOUNTED_OFFER, { "payments.web.enabled": false });

    await expect(service.resolveOffers(USER)).resolves.toEqual({ offers: {}, available: [] });
  });

  it("rejects a typed code while the web cannot sell any plan", async () => {
    const { service } = makeService(DISCOUNTED_OFFER, { "payments.web.enabled": false });

    await expect(service.resolveOffers(USER, "HOSGELDIN")).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_DISABLED,
      httpStatus: 503,
    });
  });

  it("offers a lapsed subscriber the win-back discount while the web sells the plan", async () => {
    const { service, subsRepo } = makeService(DISCOUNTED_OFFER);
    subsRepo.findLatestForUser.mockResolvedValue(LAPSED_SUBSCRIPTION);

    await expect(service.findWinBackOffer(USER.id)).resolves.toMatchObject({
      planId: plan.id,
      discountMinor: 4980,
    });
  });

  it("stays silent on win-back while the web cannot sell the plan", async () => {
    const { service, subsRepo } = makeService(DISCOUNTED_OFFER, { "payments.web.enabled": false });
    subsRepo.findLatestForUser.mockResolvedValue(LAPSED_SUBSCRIPTION);

    await expect(service.findWinBackOffer(USER.id)).resolves.toBeNull();
  });

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

    expect(db.transaction).toHaveBeenCalled();
    expect(subsRepo.create).toHaveBeenCalledWith(expect.any(Object), tx);
    expect(promotions.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ tx, subscriptionId: "sub-1", offer: DISCOUNTED_OFFER }),
    );
  });

  it("rejects trial eligibility before retiring a sponsored seat or calling the provider", async () => {
    const { service, subsRepo, trials, paymentProvider } = makeService(LIST_OFFER);
    const expire = vi.fn();
    (subsRepo as unknown as { expireSponsorship: unknown }).expireSponsorship = expire;
    subsRepo.findOpenForUser.mockResolvedValue({ id: "sponsor", status: "ACTIVE", provider: "SPONSOR" });
    trials.selectTrial.mockRejectedValue(new DomainError("AUTH_PHONE_REQUIRED", 403));
    await expect(service.checkout(USER, plan.id, undefined, true)).rejects.toMatchObject({ code: "AUTH_PHONE_REQUIRED" });
    expect(expire).not.toHaveBeenCalled();
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
  });

  it("returns a known pending URL without opening another provider checkout", async () => {
    const { service, trials, paymentProvider } = makeService(LIST_OFFER);
    trials.resume.mockResolvedValue({ checkoutUrl: "https://pay/original" } as never);
    expect(await service.checkout(USER, plan.id, undefined, true)).toEqual({ checkoutUrl: "https://pay/original" });
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
  });

  it("retains an unknown provider outcome and rejects rather than opening another checkout", async () => {
    const { service, trials, paymentProvider } = makeService(LIST_OFFER);
    paymentProvider.createCheckout.mockRejectedValue(new Error("connection lost"));
    await expect(service.checkout(USER, plan.id, undefined, true)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
    expect(trials.release).not.toHaveBeenCalled();
  });

  it("releases only a definitive provider rejection and discards the unconfirmed row", async () => {
    const { service, subsRepo, trials, paymentProvider, tx, events } = makeService(LIST_OFFER);
    const remove = vi.fn();
    (subsRepo as unknown as { deleteById: unknown }).deleteById = remove;
    paymentProvider.createCheckout.mockRejectedValue(new CheckoutRejectedError());
    await expect(service.checkout(USER, plan.id, undefined, true)).rejects.toMatchObject({ code: "PAYMENT_PROVIDER_ERROR" });
    expect(trials.release).toHaveBeenCalledWith("claim-1", tx);
    expect(remove).toHaveBeenCalledWith("sub-1", tx);
    expect(events.emit).toHaveBeenCalledWith("payments.subscription.expired", expect.objectContaining({ userId: USER.id }));
  });

  it("maps a concurrent subscription race before any provider call; the claim rolls back with the transaction", async () => {
    const { service, subsRepo, trials, paymentProvider } = makeService(LIST_OFFER);
    subsRepo.create.mockRejectedValue({ cause: { code: "23505" } });
    await expect(service.checkout(USER, plan.id, undefined, true)).rejects.toMatchObject({ code: "PAYMENT_ALREADY_SUBSCRIBED" });
    expect(trials.release).not.toHaveBeenCalled();
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
  });

  it("persists a paid checkout before provider I/O so a subscription race cannot charge twice", async () => {
    const { service, subsRepo, paymentProvider } = makeService(LIST_OFFER);
    subsRepo.create.mockRejectedValue({ cause: { code: "23505" } });
    await expect(service.checkout(USER, plan.id, undefined, false)).rejects.toMatchObject({ code: "PAYMENT_ALREADY_SUBSCRIBED" });
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
  });

  it("retains an ambiguous paid checkout instead of discarding it for another provider call", async () => {
    const { service, subsRepo, paymentProvider } = makeService(LIST_OFFER);
    paymentProvider.createCheckout.mockRejectedValue(new Error("timeout"));
    await expect(service.checkout(USER, plan.id, undefined, false)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
    subsRepo.findOpenForUser.mockResolvedValue({ id: "sub-1", planId: plan.id, status: "INCOMPLETE", checkoutUrl: null });
    await expect(service.checkout(USER, plan.id, undefined, false)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
    expect(paymentProvider.createCheckout).toHaveBeenCalledTimes(1);
  });

  it("consumes the reserved phone in the same transaction as instant trial access", async () => {
    const { service, trials, tx } = makeService(LIST_OFFER);
    await service.checkout(USER, plan.id, undefined, true);
    expect(trials.bind).toHaveBeenCalledWith("claim-1", "sub-1", USER.id, tx);
    expect(trials.consume).toHaveBeenCalledWith("sub-1", tx);
  });

  it("fails a typed code that does not stick rather than charging the list price", async () => {
    const { service, paymentProvider } = makeService({ ...LIST_OFFER, reason: "NOT_FOUND" });

    await expect(service.checkout(USER, plan.id, "YANLIS")).rejects.toMatchObject({
      code: ErrorCode.PROMOTION_NOT_FOUND,
      httpStatus: 422,
    });
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
  });

  it("retains a legacy INCOMPLETE checkout without provider evidence", async () => {
    const { service, subsRepo, promotions } = makeService(LIST_OFFER);
    subsRepo.findOpenForUser.mockResolvedValueOnce({ id: "old-sub", status: "INCOMPLETE" });
    (subsRepo as unknown as { deleteById: unknown }).deleteById = vi.fn();

    await expect(service.checkout(USER, plan.id)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });

    expect(promotions.voidForSubscription).not.toHaveBeenCalled();
    expect(subsRepo.deleteById).not.toHaveBeenCalled();
  });

  it("resumes a matching paid checkout before phone eligibility and without provider I/O", async () => {
    const { service, subsRepo, trials, paymentProvider } = makeService(LIST_OFFER);
    subsRepo.findOpenForUser.mockResolvedValue({ id: "paid", planId: plan.id, status: "INCOMPLETE", trialEndsAt: null,
      checkoutUrl: "https://pay/paid", checkoutCode: null });
    expect(await service.checkout(USER, plan.id)).toEqual({ checkoutUrl: "https://pay/paid" });
    expect(trials.selectTrial).not.toHaveBeenCalled();
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
  });

  it("rechecks a pending trial under the account lock when advisory reads missed it", async () => {
    const { service, trials, paymentProvider, subsRepo, users, tx } = makeService(LIST_OFFER);
    trials.resume.mockResolvedValueOnce(null).mockRejectedValueOnce(new DomainError("PAYMENT_TRIAL_PENDING", 409));
    await expect(service.checkout(USER, plan.id, undefined, false)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
    expect(users.lockActiveAccount).toHaveBeenCalledWith(USER.id, tx);
    expect(subsRepo.create).not.toHaveBeenCalled();
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
  });

  it("maps a competing phone fingerprint claim to trial unavailability before provider I/O", async () => {
    const { service, trials, paymentProvider } = makeService(LIST_OFFER);
    trials.reserve.mockRejectedValue({ cause: { code: "23505", constraint: "phone_trial_claims_fingerprint_unique" } });
    await expect(service.checkout(USER, plan.id, undefined, true)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
    expect(paymentProvider.createCheckout).not.toHaveBeenCalled();
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
    const eventsRepo = { appendTransaction: vi.fn(), hasSuccessfulCharge: vi.fn().mockResolvedValue(false) };
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
      {} as never,
      { append: vi.fn() } as never,
      trialStub() as never,
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

describe("SubscriptionView pending trial checkout", () => {
  it("returns a current-owner stored resume URL without opening another provider checkout", async () => {
    const trials = trialStub();
    trials.eligibility.mockResolvedValue({ eligible: false, reason: "PENDING" });
    trials.pendingCheckoutUrl.mockResolvedValue("https://provider/current-owner" as never);
    const provider = { createCheckout: vi.fn() };
    const service = new SubscriptionsService({} as never, {} as never,
      { findOpenForUser: vi.fn(async () => undefined) } as never, {} as never,
      { getEntitlement: vi.fn(async () => ({ isPremium: false })) } as never,
      { listPolicies: vi.fn(async () => ({})) } as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, provider as never, {} as never,
      {} as never, trials as never, {} as never);
    expect(await service.getView(USER.id)).toMatchObject({
      trialEligibility: { eligible: false, reason: "PENDING" },
      pendingTrialCheckoutUrl: "https://provider/current-owner",
    });
    expect(trials.pendingCheckoutUrl).toHaveBeenCalledWith(USER.id);
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it.each(["INCOMPLETE", "ACTIVE"])("exposes a paid resume URL only for the owner's INCOMPLETE row (status=%s)", async (status) => {
    const repo = { findOpenForUser: vi.fn(async () => ({ id: "paid", planId: plan.id, status, provider: "FAKE",
      checkoutUrl: "https://provider/paid-owner", createdAt: new Date(), trialEndsAt: null })) };
    const service = new SubscriptionsService({} as never, {} as never, repo as never, {} as never,
      { getEntitlement: vi.fn(async () => ({ isPremium: false })) } as never,
      { listPolicies: vi.fn(async () => ({})) } as never,
      { findActiveForSubscription: vi.fn() } as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, trialStub() as never, {} as never);
    expect((await service.getView(USER.id)).pendingCheckoutUrl)
      .toBe(status === "INCOMPLETE" ? "https://provider/paid-owner" : null);
    expect(repo.findOpenForUser).toHaveBeenCalledWith(USER.id);
  });
});

describe("trial activation and cancellation", () => {
  function setup() {
    const tx = { execute: vi.fn() };
    const db = { transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)) };
    const sub = { id: "sub-trial", userId: USER.id, planId: plan.id, providerRef: "ref-trial",
      status: "INCOMPLETE", currentPeriodStart: new Date(), trialEndsAt: new Date(Date.now() + 86_400_000), currentPeriodEnd: null };
    const repo = { findByProviderRef: vi.fn(async () => sub), findOpenForUser: vi.fn(async () => sub),
      lockById: vi.fn(async () => sub), update: vi.fn(), deleteById: vi.fn() };
    const provider = { cancel: vi.fn() };
    const promotions = { markApplied: vi.fn(), voidForSubscription: vi.fn(), findActiveForSubscription: vi.fn() };
    const trials = trialStub();
    const ledger = { appendTransaction: vi.fn(), hasSuccessfulCharge: vi.fn(async () => false) };
    const service = new SubscriptionsService(db as never, { findById: vi.fn(async () => plan) } as never,
      repo as never, ledger as never, {} as never, {} as never, promotions as never, {} as never,
      { emit: vi.fn() } as never, {} as never, {} as never, provider as never, {} as never, { append: vi.fn() } as never,
      trials as never, {} as never);
    vi.spyOn(service, "getView").mockResolvedValue({} as never);
    return { service, sub, repo, trials, provider, ledger, tx };
  }
  const event = (type: "checkout_completed" | "payment_succeeded" | "payment_failed" | "subscription_canceled" | "trial_started") =>
    ({ eventId: "event", providerRef: "ref-trial", occurredAt: new Date().toISOString(), type });

  it.each(["checkout_completed", "payment_succeeded"] as const)("consumes the frozen phone on %s in the activation transaction", async (type) => {
    const { service, trials, tx } = setup();
    await service.applyProviderEvent(event(type), tx as never);
    expect(trials.consume).toHaveBeenCalledWith("sub-trial", tx);
  });

  it("does not grant access when consumption fails", async () => {
    const { service, trials, repo, tx } = setup();
    trials.consume.mockRejectedValue(new DomainError("PAYMENT_TRIAL_UNAVAILABLE", 409));
    await expect(service.applyProviderEvent(event("payment_succeeded"), tx as never)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("a delayed confirmed checkout starts the intended trial instead of switching to paid", async () => {
    const { service, sub, repo, tx } = setup();
    sub.currentPeriodStart = new Date("2020-01-01T00:00:00Z");
    sub.trialEndsAt = new Date("2020-01-08T00:00:00Z");
    const before = Date.now();
    await service.applyProviderEvent(event("checkout_completed"), tx as never);
    const patch = repo.update.mock.calls[0][1] as { status: string; trialEndsAt: Date; currentPeriodStart: Date; currentPeriodEnd: Date };
    expect(patch.status).toBe("TRIALING");
    expect(patch.trialEndsAt.getTime()).toBeGreaterThanOrEqual(before + 7 * 86_400_000);
    expect(patch.currentPeriodEnd).toEqual(patch.trialEndsAt);
  });

  it.each(["payment_failed", "subscription_canceled"] as const)("releases pending holds on definitive %s without granting access", async (type) => {
    const { service, trials, repo, tx } = setup();
    const effects = await service.applyProviderEvent(event(type), tx as never);
    expect(trials.releaseForSubscription).toHaveBeenCalledWith("sub-trial", tx);
    expect(repo.deleteById).toHaveBeenCalledWith("sub-trial", tx);
    expect(repo.update).not.toHaveBeenCalled();
    expect(effects.emits).toEqual([expect.objectContaining({ topic: "payments.subscription.expired" })]);
  });

  it("does not append an unactivated trial event that would prevent safe rejection cleanup", async () => {
    const { service, ledger, tx } = setup();
    await service.applyProviderEvent(event("trial_started"), tx as never);
    expect(ledger.appendTransaction).not.toHaveBeenCalled();
  });

  it("cancels a known pending checkout without changing it into granting CANCELED access", async () => {
    const { service, trials, repo, tx } = setup();
    await service.cancel(USER.id);
    expect(trials.releaseForSubscription).toHaveBeenCalledWith("sub-trial", tx);
    expect(repo.deleteById).toHaveBeenCalledWith("sub-trial", tx);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("also discards a paid pending checkout only after confirmed cancellation", async () => {
    const { service, sub, provider, repo, tx } = setup();
    sub.trialEndsAt = null as never;
    await service.cancel(USER.id);
    expect(provider.cancel).toHaveBeenCalledWith("ref-trial");
    expect(repo.deleteById).toHaveBeenCalledWith("sub-trial", tx);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("cannot cancel an unknown paid checkout into premium access", async () => {
    const { service, sub, provider, repo } = setup();
    sub.trialEndsAt = null as never;
    sub.providerRef = null as never;
    await expect(service.cancel(USER.id)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(repo.deleteById).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("retains pending holds when cancellation has an unknown outcome", async () => {
    const { service, trials, provider } = setup();
    provider.cancel.mockRejectedValue(new Error("timeout"));
    await expect(service.cancel(USER.id)).rejects.toThrow();
    expect(trials.releaseForSubscription).not.toHaveBeenCalled();
  });

  it("preserves a trial activated while the cancellation call was in flight", async () => {
    const { service, sub, repo, trials, provider, tx } = setup();
    provider.cancel.mockImplementation(async () => { sub.status = "TRIALING"; });
    await service.cancel(USER.id);
    expect(repo.deleteById).not.toHaveBeenCalled();
    expect(trials.releaseForSubscription).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith("sub-trial", expect.objectContaining({ status: "CANCELED", cancelAtPeriodEnd: true }), tx);
  });

  it("does not resurrect access ended by a cancellation webhook while provider.cancel was in flight", async () => {
    const { service, sub, repo, provider } = setup();
    provider.cancel.mockImplementation(async () => { sub.status = "EXPIRED"; });
    await service.cancel(USER.id);
    expect(repo.update).not.toHaveBeenCalled();
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
      {} as never,
      { append: vi.fn() } as never,
      trialStub() as never,
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

/**
 * W8's one-payer rule reads this: a student who pays for their own Premium holds no coach seat.
 * "Pays" is the whole question, so a coach's seat, a checkout that bought nothing yet and time that
 * already ran out are all "no".
 */
describe("SubscriptionsService self-paying users", () => {
  const future = new Date(Date.now() + 10 * 86_400_000);
  const past = new Date(Date.now() - 10 * 86_400_000);
  const row = (userId: string, over: Record<string, unknown> = {}) => ({
    userId,
    status: "ACTIVE",
    provider: "fake",
    currentPeriodEnd: future,
    trialEndsAt: null,
    updatedAt: new Date(),
    ...over,
  });
  function makeService(rows: unknown[]) {
    const subsRepo = { listOpenForUsers: vi.fn().mockResolvedValue(rows) };
    const service = new SubscriptionsService(
      {} as never,
      {} as never,
      subsRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { append: vi.fn() } as never,
      trialStub() as never,
      {} as never,
    );
    return { service, subsRepo };
  }

  it("names only the users whose own subscription gives them Premium right now", async () => {
    const { service } = makeService([
      row("paying"),
      row("sponsored", { provider: "SPONSOR", currentPeriodEnd: null }),
      row("checkout", { status: "INCOMPLETE" }),
      row("lapsed", { currentPeriodEnd: past }),
    ]);
    const paying = await service.listSelfPayingUserIds([
      "paying",
      "sponsored",
      "checkout",
      "lapsed",
      "nobody",
    ]);
    expect([...paying]).toEqual(["paying"]);
  });

  it("asks nothing when there is nobody to ask about", async () => {
    const { service, subsRepo } = makeService([]);
    expect((await service.listSelfPayingUserIds([])).size).toBe(0);
    expect(subsRepo.listOpenForUsers).not.toHaveBeenCalled();
  });
});
