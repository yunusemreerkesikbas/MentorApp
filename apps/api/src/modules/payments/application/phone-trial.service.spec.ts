import { describe, expect, it, vi } from "vitest";
import { PhoneTrialService, trialClaimExpiresAt } from "./phone-trial.service";

function setup(over: { phone?: string | null; used?: boolean; claim?: object; pending?: object; phoneRequired?: boolean; active?: boolean } = {}) {
  const tx = { execute: vi.fn() };
  const db = { transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)) };
  const users = { lockActiveAccount: vi.fn(async () => over.active ?? true), getVerifiedPhoneFingerprint: vi.fn(async () => over.phone === undefined ? "keyed-hash" : over.phone) };
  const subscriptions = { hasAnyForUser: vi.fn(async () => over.used ?? false) };
  const claims = {
    findPendingForUser: vi.fn(async () => over.pending),
    findByFingerprint: vi.fn(async () => over.claim),
    purgeFingerprint: vi.fn(),
    reserve: vi.fn(async () => ({ id: "claim-1" })),
    findForSubscription: vi.fn(async () => over.claim ?? { userId: "user", phoneFingerprint: "keyed-hash" }),
    findById: vi.fn(async () => over.claim ?? { userId: "user", phoneFingerprint: "keyed-hash" }),
    bind: vi.fn(async () => true),
    saveCheckout: vi.fn(async () => true),
    consumeForSubscription: vi.fn(async () => true),
    release: vi.fn(),
  };
  const policy = { required: over.phoneRequired ?? true };
  const config = { get: vi.fn(async () => policy.required) };
  return { service: new PhoneTrialService(db as never, users as never, claims as never, subscriptions as never, config as never), claims, users, tx, policy };
}

describe("PhoneTrialService", () => {
  it("paid checkout bypasses verification", async () => {
    const { service, users } = setup({ phone: null });
    expect(await service.selectTrial("user", 7, false, false)).toBe(false);
    expect(users.getVerifiedPhoneFingerprint).not.toHaveBeenCalled();
  });

  it("explicit trial never silently falls back to paid", async () => {
    const { service } = setup({ used: true });
    await expect(service.selectTrial("user", 7, true, true)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
    expect(await service.selectTrial("user", 7, undefined, true)).toBe(false);
  });

  it("requires an ACTIVE verified phone for an otherwise eligible automatic trial", async () => {
    const { service, claims } = setup({ phone: null });
    await expect(service.selectTrial("user", 7, undefined, false)).rejects.toMatchObject({ code: "AUTH_PHONE_REQUIRED" });
    expect(claims.reserve).not.toHaveBeenCalled();
  });

  it("blocks a phone already consumed by a different or erased account", async () => {
    const { service } = setup({ claim: { status: "CONSUMED" } });
    await expect(service.selectTrial("user", 7, true, false)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
  });

  it("rechecks the verified phone while locking identity before reserving", async () => {
    const { service, users, tx, claims } = setup();
    await service.reserve("user", "plan", undefined);
    expect(users.getVerifiedPhoneFingerprint).toHaveBeenCalledWith("user", tx);
    expect(claims.reserve).toHaveBeenCalledWith({ userId: "user", phoneFingerprint: "keyed-hash", planId: "plan", code: null }, tx);
  });

  it("returns the original hosted URL for a matching retry", async () => {
    const { service } = setup({ pending: { planId: "plan", code: null, checkoutUrl: "https://provider/once" } });
    expect(await service.resume("user", "plan", undefined, true)).toEqual({ checkoutUrl: "https://provider/once" });
  });

  it("exposes only the current owner's known pending hosted URL", async () => {
    const known = setup({ pending: { checkoutUrl: "https://provider/known" } });
    expect(await known.service.pendingCheckoutUrl("user")).toBe("https://provider/known");
    expect(await setup({ pending: { checkoutUrl: null } }).service.pendingCheckoutUrl("user")).toBeNull();
    expect(await setup().service.pendingCheckoutUrl("user")).toBeNull();
  });

  it("does not age out an unknown outcome or permit a paid/different-plan retry", async () => {
    const pending = { planId: "plan", code: null, checkoutUrl: null, createdAt: new Date(0) };
    const { service } = setup({ pending });
    await expect(service.resume("user", "plan", undefined, true)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
    await expect(service.resume("user", "different", undefined, true)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
    await expect(service.resume("user", "plan", undefined, false)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
  });

  it("does not consume a detached claim or activate an erased account", async () => {
    const detached = setup({ claim: { userId: null } });
    await expect(detached.service.consume("sub", detached.tx as never)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
    expect(detached.claims.consumeForSubscription).not.toHaveBeenCalled();
    const erased = setup({ phone: null });
    await expect(erased.service.consume("sub", erased.tx as never)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
    expect(erased.claims.consumeForSubscription).not.toHaveBeenCalled();
  });

  it("cannot bind a reservation detached during account erasure", async () => {
    const { service, tx, claims } = setup();
    claims.bind.mockResolvedValue(false);
    await expect(service.bind("claim", "sub", "user", tx as never)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
  });
});

describe("trial claim retention", () => {
  it("is twelve calendar months and clamps leap day to February 28", () => {
    expect(trialClaimExpiresAt(new Date("2024-02-29T12:34:56Z")).toISOString()).toBe("2025-02-28T12:34:56.000Z");
    expect(trialClaimExpiresAt(new Date("2026-10-02T12:34:56Z")).toISOString()).toBe("2027-10-02T12:34:56.000Z");
  });
});


describe("carded trials without mandatory phone verification", () => {
  it("allows an unused account without reading phone secrets when the requirement is off", async () => {
    const { service, users, claims } = setup({ phone: null, phoneRequired: false });
    expect(await service.eligibility("user")).toEqual({ eligible: true, reason: "AVAILABLE", phoneVerificationRequired: false });
    expect(await service.selectTrial("user", 7, true, false)).toBe(true);
    await service.reserve("user", "plan");
    expect(users.getVerifiedPhoneFingerprint).not.toHaveBeenCalled();
    expect(claims.reserve).toHaveBeenCalledWith({ userId: "user", phoneFingerprint: null, planId: "plan", code: null }, expect.anything());
  });

  it("still refuses an account that already subscribed", async () => {
    const { service } = setup({ used: true, phoneRequired: false });
    await expect(service.selectTrial("user", 7, true, true)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
    await expect(service.reserve("user", "plan")).rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
  });

  it("completes a phone-optional reservation after the requirement is switched on", async () => {
    const { service, policy, tx, users } = setup({ phone: null, phoneRequired: false, claim: { userId: "user", phoneFingerprint: null } });
    policy.required = true;
    await service.bind("claim", "sub", "user", tx as never);
    await service.saveCheckout("claim", { providerRef: "ref", checkoutUrl: "https://provider/once" }, "user", tx as never);
    await service.consume("sub", tx as never);
    expect(users.getVerifiedPhoneFingerprint).not.toHaveBeenCalled();
    expect(users.lockActiveAccount).toHaveBeenCalled();
  });

  it("does not relax an existing phone-bound claim when the requirement is switched off", async () => {
    const { service, tx } = setup({ phone: null, phoneRequired: false, claim: { userId: "user", phoneFingerprint: "existing-hash" } });
    await expect(service.consume("sub", tx as never)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
  });

  it("refuses erased or fenced accounts even for phone-optional claims", async () => {
    const { service, tx, claims } = setup({ active: false, phoneRequired: false, claim: { userId: "user", phoneFingerprint: null } });
    await expect(service.consume("sub", tx as never)).rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
    expect(claims.consumeForSubscription).not.toHaveBeenCalled();
  });
});
