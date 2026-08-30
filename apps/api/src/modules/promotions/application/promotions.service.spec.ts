import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import type { PromotionRow } from "../infrastructure/promotion.repository";
import {
  PromotionsService,
  type PromotionUserContext,
  type ResolvedOffer,
} from "./promotions.service";

const NOW = new Date("2026-08-30T12:00:00Z");
const MONTHLY = { id: "premium-monthly", priceMinor: 24_900 };
const QUARTERLY = { id: "premium-3m", priceMinor: 59_900 };

function promo(overrides: Partial<PromotionRow> = {}): PromotionRow {
  return {
    id: "p1",
    code: null,
    name: "Test",
    labelTr: "Test kampanyası",
    labelEn: "Test campaign",
    ruleType: "ANYONE",
    ruleParams: {},
    discountType: "PERCENT",
    discountValue: 20,
    appliesToPeriods: 1,
    planIds: null,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    maxRedemptionsPerUser: 1,
    isActive: true,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as PromotionRow;
}

function context(overrides: Partial<PromotionUserContext> = {}): PromotionUserContext {
  return {
    userId: "u1",
    orgId: null,
    userCreatedAt: NOW,
    hadAnySubscription: false,
    lastSubscriptionStatus: null,
    ...overrides,
  };
}

interface Harness {
  service: PromotionsService;
  promotionsRepo: {
    findLive: ReturnType<typeof vi.fn>;
    findLiveCoded: ReturnType<typeof vi.fn>;
    findActiveByCode: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  redemptionsRepo: {
    countForPromotion: ReturnType<typeof vi.fn>;
    countForUser: ReturnType<typeof vi.fn>;
    acquirePromotionLock: ReturnType<typeof vi.fn>;
    acquireUserLock: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

function makeService(
  options: {
    live?: PromotionRow[];
    byCode?: PromotionRow | undefined;
    enabled?: boolean;
    maxPercent?: number;
    globalUsed?: number;
    userUsed?: number;
    coded?: PromotionRow[];
  } = {},
): Harness {
  const promotionsRepo = {
    findLive: vi.fn().mockResolvedValue(options.live ?? []),
    findLiveCoded: vi.fn().mockResolvedValue(options.coded ?? []),
    findActiveByCode: vi.fn().mockResolvedValue(options.byCode),
    findById: vi.fn().mockResolvedValue(options.byCode ?? options.live?.[0]),
  };
  const redemptionsRepo = {
    countForPromotion: vi.fn().mockResolvedValue(options.globalUsed ?? 0),
    countForUser: vi.fn().mockResolvedValue(options.userUsed ?? 0),
    acquirePromotionLock: vi.fn().mockResolvedValue(undefined),
    acquireUserLock: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(async (entry: unknown) => entry),
  };
  const config = {
    get: vi.fn(async (key: string) => {
      if (key === "promotions.enabled") return options.enabled ?? true;
      if (key === "promotions.max_percent") return options.maxPercent ?? 50;
      return undefined;
    }),
  };
  const service = new PromotionsService(
    promotionsRepo as never,
    redemptionsRepo as never,
    config as never,
  );
  return { service, promotionsRepo, redemptionsRepo };
}

async function resolveMonthly(
  harness: Harness,
  extra: {
    code?: string;
    context?: PromotionUserContext;
    activeDates?: (windowDays: number) => Promise<readonly string[]>;
  } = {},
): Promise<ResolvedOffer> {
  const resolved = await harness.service.resolveOffers({
    context: extra.context ?? context(),
    plans: [MONTHLY],
    code: extra.code,
    activeDates: extra.activeDates,
    now: NOW,
  });
  return resolved.offers[MONTHLY.id]!;
}

describe("PromotionsService.resolveOffers", () => {
  it("returns the list price when promotions are disabled", async () => {
    const harness = makeService({ enabled: false, live: [promo()] });
    const offer = await resolveMonthly(harness);
    expect(offer).toMatchObject({
      chargedPriceMinor: 24_900,
      discountMinor: 0,
      promotionId: null,
      reason: null,
    });
  });

  it("tells a user who typed a code that promotions are off", async () => {
    const harness = makeService({ enabled: false });
    const offer = await resolveMonthly(harness, { code: "HOSGELDIN" });
    expect(offer.reason).toBe("DISABLED");
  });

  it("applies a code-less promotion automatically", async () => {
    const harness = makeService({ live: [promo()] });
    const offer = await resolveMonthly(harness);
    expect(offer).toMatchObject({
      listPriceMinor: 24_900,
      discountMinor: 4_980,
      chargedPriceMinor: 19_920,
      renewalPriceMinor: 24_900,
      promotionId: "p1",
    });
    expect(offer.summary?.label).toBe("Test kampanyası");
  });

  it("never applies a coded promotion without the code", async () => {
    const harness = makeService({ live: [promo({ code: "HOSGELDIN" })] });
    const offer = await resolveMonthly(harness);
    expect(offer.discountMinor).toBe(0);
  });

  it("resolves a typed code", async () => {
    const harness = makeService({ byCode: promo({ code: "HOSGELDIN" }) });
    const offer = await resolveMonthly(harness, { code: "HOSGELDIN" });
    expect(offer.chargedPriceMinor).toBe(19_920);
    expect(offer.summary?.code).toBe("HOSGELDIN");
  });

  it("reports an unknown code", async () => {
    const harness = makeService({ byCode: undefined });
    expect((await resolveMonthly(harness, { code: "YOK" })).reason).toBe("NOT_FOUND");
  });

  it("distinguishes a not-yet-started campaign from an expired one", async () => {
    const early = makeService({
      byCode: promo({ code: "EARLY", startsAt: new Date("2026-09-01T00:00:00Z") }),
    });
    expect((await resolveMonthly(early, { code: "EARLY" })).reason).toBe("NOT_STARTED");

    const late = makeService({
      byCode: promo({ code: "LATE", endsAt: new Date("2026-08-01T00:00:00Z") }),
    });
    expect((await resolveMonthly(late, { code: "LATE" })).reason).toBe("EXPIRED");
  });

  it("rejects a NEW_USER promotion for an established account", async () => {
    const harness = makeService({
      byCode: promo({ code: "HOSGELDIN", ruleType: "NEW_USER", ruleParams: { withinDays: 7 } }),
    });
    const old = context({ userCreatedAt: new Date("2026-01-01T00:00:00Z") });
    expect((await resolveMonthly(harness, { code: "HOSGELDIN", context: old })).reason).toBe(
      "RULE_UNMET",
    );
  });

  it("picks the single largest discount and never stacks", async () => {
    const harness = makeService({
      live: [
        promo({ id: "small", discountValue: 10 }),
        promo({ id: "big", discountValue: 30 }),
        promo({ id: "mid", discountValue: 20 }),
      ],
    });
    const offer = await resolveMonthly(harness);
    expect(offer.promotionId).toBe("big");
    expect(offer.discountMinor).toBe(7_470); // 30% of 24 900 — not 10+30+20
  });

  it("honours the configured percentage ceiling", async () => {
    const harness = makeService({ live: [promo({ discountValue: 90 })], maxPercent: 25 });
    expect((await resolveMonthly(harness)).discountMinor).toBe(6_225); // 25%, not 90%
  });

  it("skips plans the promotion does not cover", async () => {
    const harness = makeService({ live: [promo({ planIds: ["premium-3m"] })] });
    const { offers } = await harness.service.resolveOffers({
      context: context(),
      plans: [MONTHLY, QUARTERLY],
      now: NOW,
    });
    expect(offers[MONTHLY.id]!.discountMinor).toBe(0);
    expect(offers[QUARTERLY.id]!.discountMinor).toBe(11_980); // 20% of 59 900
  });

  it("reports an exhausted global quota", async () => {
    const harness = makeService({
      byCode: promo({ code: "SON", maxRedemptions: 100 }),
      globalUsed: 100,
    });
    expect((await resolveMonthly(harness, { code: "SON" })).reason).toBe("EXHAUSTED");
  });

  it("reports a per-user quota that is already spent", async () => {
    const harness = makeService({ byCode: promo({ code: "BIRKEZ" }), userUsed: 1 });
    expect((await resolveMonthly(harness, { code: "BIRKEZ" })).reason).toBe("USER_LIMIT_REACHED");
  });
});

describe("PromotionsService ACTIVE_DAYS signal", () => {
  const activeRule = promo({
    ruleType: "ACTIVE_DAYS",
    ruleParams: { days: 5, windowDays: 7 },
  });
  // 2026-08-24 … 2026-08-28 — five studied days inside the seven ending on NOW (08-30).
  const fiveDays = ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];

  it("never queries coaching when no live rule needs studied days", async () => {
    const harness = makeService({ live: [promo()] });
    const activeDates = vi.fn().mockResolvedValue(fiveDays);

    await resolveMonthly(harness, { activeDates });

    // Checkout is the money path: an ACTIVE_DAYS-free catalog must not pay for this query.
    expect(activeDates).not.toHaveBeenCalled();
  });

  it("applies the discount once the user has enough studied days", async () => {
    const harness = makeService({ live: [activeRule] });
    const offer = await resolveMonthly(harness, {
      activeDates: vi.fn().mockResolvedValue(fiveDays),
    });
    expect(offer.discountMinor).toBe(4_980);
  });

  it("withholds it when the user is one day short", async () => {
    const harness = makeService({ live: [activeRule] });
    const offer = await resolveMonthly(harness, {
      activeDates: vi.fn().mockResolvedValue(fiveDays.slice(1)),
    });
    expect(offer.discountMinor).toBe(0);
  });

  it("stays inert when no supplier is wired at all", async () => {
    const harness = makeService({ live: [activeRule] });
    expect((await resolveMonthly(harness)).discountMinor).toBe(0);
  });

  it("fetches studied days at most once, shared by the offer and coupon paths", async () => {
    const harness = makeService({
      live: [activeRule],
      coded: [promo({ id: "coded", code: "CALIS", ruleType: "ACTIVE_DAYS",
        ruleParams: { days: 5, windowDays: 7 } })],
    });
    const activeDates = vi.fn().mockResolvedValue(fiveDays);

    const resolved = await harness.service.resolveOffers({
      context: context(),
      plans: [MONTHLY],
      activeDates,
      now: NOW,
    });

    expect(activeDates).toHaveBeenCalledTimes(1);
    expect(activeDates).toHaveBeenCalledWith(90); // the widest window a rule may ask for
    expect(resolved.offers[MONTHLY.id]!.discountMinor).toBe(4_980);
    expect(resolved.available).toHaveLength(1);
  });
});

describe("PromotionsService waiting coupons", () => {
  async function available(harness: Harness, code?: string) {
    const resolved = await harness.service.resolveOffers({
      context: context(),
      plans: [MONTHLY],
      code,
      now: NOW,
    });
    return resolved.available;
  }

  it("surfaces a coded promotion the user qualifies for, so the client never hardcodes a code", async () => {
    const harness = makeService({ coded: [promo({ code: "HOSGELDIN" })] });
    expect(await available(harness)).toEqual([
      expect.objectContaining({ code: "HOSGELDIN", label: "Test kampanyası", discountValue: 20 }),
    ]);
  });

  it("hides a coded promotion whose rule the user fails", async () => {
    const harness = makeService({
      coded: [promo({ code: "HOSGELDIN", ruleType: "NEW_USER", ruleParams: { withinDays: 7 } })],
    });
    const resolved = await harness.service.resolveOffers({
      context: context({ userCreatedAt: new Date("2026-01-01T00:00:00Z") }),
      plans: [MONTHLY],
      now: NOW,
    });
    expect(resolved.available).toEqual([]);
  });

  it("hides a coded promotion the user has already redeemed", async () => {
    const harness = makeService({ coded: [promo({ code: "BIRKEZ" })], userUsed: 1 });
    expect(await available(harness)).toEqual([]);
  });

  it("stays empty when the user already typed a code", async () => {
    const harness = makeService({ coded: [promo({ code: "HOSGELDIN" })], byCode: promo() });
    expect(await available(harness, "HOSGELDIN")).toEqual([]);
  });
});

describe("PromotionsService.reserve", () => {
  const tx = {} as never;
  let offer: ResolvedOffer;

  beforeEach(() => {
    offer = {
      planId: MONTHLY.id,
      listPriceMinor: 24_900,
      discountMinor: 4_980,
      chargedPriceMinor: 19_920,
      renewalPriceMinor: 24_900,
      promotionId: "p1",
      summary: null,
      reason: null,
    };
  });

  it("freezes the agreed price on the redemption row", async () => {
    const harness = makeService({ byCode: promo() });
    await harness.service.reserve({
      tx,
      offer,
      userId: "u1",
      orgId: null,
      subscriptionId: "s1",
    });
    expect(harness.redemptionsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        listPriceMinor: 24_900,
        discountMinor: 4_980,
        chargedPriceMinor: 19_920,
        periodsRemaining: 1,
        status: "RESERVED",
        subscriptionId: "s1",
      }),
      tx,
    );
  });

  it("takes the promotion lock before the user lock, so racing reservations cannot deadlock", async () => {
    const harness = makeService({ byCode: promo() });
    await harness.service.reserve({ tx, offer, userId: "u1", orgId: null, subscriptionId: "s1" });
    const promotionLock = harness.redemptionsRepo.acquirePromotionLock.mock.invocationCallOrder[0]!;
    const userLock = harness.redemptionsRepo.acquireUserLock.mock.invocationCallOrder[0]!;
    expect(promotionLock).toBeLessThan(userLock);
  });

  it("rejects a quota that filled between resolve and reserve", async () => {
    const harness = makeService({ byCode: promo({ maxRedemptions: 10 }), globalUsed: 10 });
    await expect(
      harness.service.reserve({ tx, offer, userId: "u1", orgId: null, subscriptionId: "s1" }),
    ).rejects.toMatchObject({ code: ErrorCode.PROMOTION_EXHAUSTED, httpStatus: 409 });
    expect(harness.redemptionsRepo.create).not.toHaveBeenCalled();
  });

  it("does nothing when no promotion applies", async () => {
    const harness = makeService();
    const result = await harness.service.reserve({
      tx,
      offer: { ...offer, promotionId: null, discountMinor: 0 },
      userId: "u1",
      orgId: null,
      subscriptionId: "s1",
    });
    expect(result).toBeNull();
    expect(harness.redemptionsRepo.create).not.toHaveBeenCalled();
  });
});
