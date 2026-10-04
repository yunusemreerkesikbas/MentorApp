import { describe, expect, it, vi } from "vitest";
import { CheckoutService } from "./checkout.service";
import type { SubscriptionRow } from "../infrastructure/payments.repositories";

const input = {
  user: { id: "user", email: "test@example.com", createdAt: new Date() },
  plan: { id: "premium-monthly", name: "Premium", periodMonths: 1, priceMinor: 24900,
    currency: "TRY", trialDays: 7, seatCount: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  offer: { planId: "premium-monthly", listPriceMinor: 24900, discountMinor: 0,
    chargedPriceMinor: 24900, renewalPriceMinor: 24900, promotionId: null, summary: null, reason: null },
  returnUrl: "https://app.test/result",
} as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function setup() {
  // The fake transaction models the single account lock. Provider HTTP has its own explicit gate.
  let queue = Promise.resolve();
  const tx = { execute: vi.fn() };
  const db = { transaction: async (run: (tx: unknown) => Promise<unknown>) => {
    const prior = queue;
    const released = deferred<void>();
    queue = released.promise;
    await prior;
    try { return await run(tx); } finally { released.resolve(); }
  } };
  let row: SubscriptionRow | undefined;
  const subscriptions = {
    findOpenForUser: vi.fn(async () => row),
    create: vi.fn(async (data: object) => { row = { id: "sub", ...data } as SubscriptionRow; return row; }),
    lockById: vi.fn(async () => row),
    update: vi.fn(async (_id: string, patch: object) => { row = { ...row, ...patch } as SubscriptionRow; return row; }),
    deleteById: vi.fn(async () => { row = undefined; }),
  };
  const promotions = { reserve: vi.fn(), voidForSubscription: vi.fn() };
  const trials = { resume: vi.fn(async () => null), reserve: vi.fn(async () => ({ id: "claim" })),
    bind: vi.fn(), saveCheckout: vi.fn(), consume: vi.fn(), release: vi.fn() };
  const called = deferred<void>();
  const providerResult = deferred<{ checkoutUrl: string; providerRef: string }>();
  const provider = { provider: "FAKE", instantCheckout: false, createCheckout: vi.fn(async () => {
    expect(row?.status).toBe("INCOMPLETE");
    expect(promotions.reserve).toHaveBeenCalledWith(expect.objectContaining({ tx, subscriptionId: "sub" }));
    called.resolve();
    return providerResult.promise;
  }) };
  const users = { lockActiveAccount: vi.fn(async () => true) };
  const events = { emit: vi.fn() };
  const service = new CheckoutService(db as never, subscriptions as never, promotions as never, trials as never,
    provider as never, users as never, events as never);
  return { service, subscriptions, provider, trials, called, providerResult, getRow: () => row };
}

describe("CheckoutService reservation overlap", () => {
  it.each([true, false])("allows one provider call when the first checkout has trial=%s", async (withTrial) => {
    const state = setup();
    const first = state.service.start({ ...input, withTrial, useTrial: withTrial });
    await state.called.promise;
    try {
      await expect(state.service.start({ ...input, withTrial: !withTrial, useTrial: !withTrial }))
        .rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
      expect(state.subscriptions.create).toHaveBeenCalledTimes(1);
      expect(state.subscriptions.deleteById).not.toHaveBeenCalled();
      expect(state.provider.createCheckout).toHaveBeenCalledTimes(1);
      expect(Boolean(state.getRow()?.trialEndsAt)).toBe(withTrial);
    } finally {
      state.providerResult.resolve({ checkoutUrl: "https://pay.test/original", providerRef: "ref" });
      await first;
    }
    expect(await state.service.start({ ...input, withTrial, useTrial: withTrial }))
      .toEqual({ checkoutUrl: "https://pay.test/original" });
    expect(state.provider.createCheckout).toHaveBeenCalledTimes(1);
  });
});
