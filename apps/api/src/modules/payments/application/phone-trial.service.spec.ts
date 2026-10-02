import { describe, expect, it, vi } from "vitest";
import { PhoneTrialService, trialClaimExpiresAt } from "./phone-trial.service";

function setup(over: { phone?: string | null; used?: boolean; claim?: object; pending?: object } = {}) {
  const tx = { execute: vi.fn() };
  const db = { transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)) };
  const users = { getVerifiedPhoneFingerprint: vi.fn(async () => over.phone === undefined ? "keyed-hash" : over.phone) };
  const subscriptions = { hasAnyForUser: vi.fn(async () => over.used ?? false) };
  const claims = {
    findPendingForUser: vi.fn(async () => over.pending),
    findByFingerprint: vi.fn(async () => over.claim),
    purgeFingerprint: vi.fn(),
    reserve: vi.fn(async () => ({ id: "claim-1" })),
    findForSubscription: vi.fn(async () => over.claim ?? { userId: "user" }),
    bind: vi.fn(async () => true),
    consumeForSubscription: vi.fn(async () => true),
    release: vi.fn(),
  };
  return { service: new PhoneTrialService(db as never, users as never, claims as never, subscriptions as never), claims, users, tx };
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
