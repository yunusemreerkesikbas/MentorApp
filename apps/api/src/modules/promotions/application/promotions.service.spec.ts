import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import type { PromotionRow } from "../infrastructure/promotion.repository";
import {
  PromotionsService,
  type PromotionUserContext,
  type ResolvedOffer,
} from "./promotions.service";

const NOW = new Date("2026-08-30T12:00:00Z");
const MONTHLY = { id: "premium-monthly", name: "Premium Aylık", priceMinor: 24_900 };
const QUARTERLY = { id: "premium-3m", name: "Premium 3 Aylık", priceMinor: 59_900 };

function promo(overrides: Partial<PromotionRow> = {}): PromotionRow {
  return {
    id: "p1",
    code: null,
    name: "Test",
    labelTr: "Test kampanyası",
    labelEn: "Test campaign",
    eyebrowTr: null,
    eyebrowEn: null,
    descriptionTr: null,
    descriptionEn: null,
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
    lostPremiumAccess: false,
    invitedAt: null,
    hasPaid: false,
    phoneFingerprint: null,
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
    countActiveForPhone: ReturnType<typeof vi.fn>;
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
    phoneUsed?: number;
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
    countActiveForPhone: vi.fn().mockResolvedValue(options.phoneUsed ?? 0),
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

describe("PromotionsService advertised magnitude and scope", () => {
  async function summaryFor(harness: Harness) {
    const resolved = await harness.service.resolveOffers({
      context: context(),
      plans: [MONTHLY, QUARTERLY],
      now: NOW,
    });
    return resolved.offers[MONTHLY.id]!.summary!;
  }

  it("advertises the CLAMPED percentage, never the admin's raw entry", async () => {
    // The DB allows 1..90 while promotions.max_percent defaults to 50. Surfacing 70 here would
    // promise a discount checkout does not give — a false price claim on a commercial surface.
    const harness = makeService({ live: [promo({ discountValue: 70 })], maxPercent: 50 });
    expect((await summaryFor(harness)).discountValue).toBe(50);
  });

  it("advertises a fixed amount no covered plan clamps below", async () => {
    // 15 000 kuruş is unclamped on the 59 900 plan but hits the 50% ceiling on the 24 900 one.
    const harness = makeService({
      live: [promo({ discountType: "FIXED", discountValue: 15_000 })],
      maxPercent: 50,
    });
    expect((await summaryFor(harness)).discountValue).toBe(12_450);
  });

  it("reports no plan scope when the promotion covers every plan", async () => {
    const harness = makeService({ live: [promo({ planIds: null })] });
    // null is the signal for "all plans" — the client says so instead of naming a price.
    expect((await summaryFor(harness)).planNames).toBeNull();
  });

  it("names the covered plans when the promotion is scoped", async () => {
    const harness = makeService({ live: [promo({ planIds: ["premium-3m"] })] });
    const resolved = await harness.service.resolveOffers({
      context: context(),
      plans: [MONTHLY, QUARTERLY],
      now: NOW,
    });
    // The monthly plan gets no discount at all, so the scope shows up on the plan that does.
    expect(resolved.offers[MONTHLY.id]!.summary).toBeNull();
    expect(resolved.offers[QUARTERLY.id]!.summary?.planNames).toEqual(["Premium 3 Aylık"]);
  });

  it("localizes the admin-written modal copy", async () => {
    const written = promo({
      eyebrowTr: "Yaza özel",
      eyebrowEn: "Summer only",
      descriptionTr: "Ağustos boyunca geçerli.",
      descriptionEn: "Valid through August.",
    });

    const tr = await summaryFor(makeService({ live: [written] }));
    expect(tr.eyebrow).toBe("Yaza özel");
    expect(tr.description).toBe("Ağustos boyunca geçerli.");

    const harness = makeService({ live: [written] });
    const en = await harness.service.resolveOffers({
      context: context(),
      plans: [MONTHLY],
      now: NOW,
      locale: "en",
    });
    expect(en.offers[MONTHLY.id]!.summary?.eyebrow).toBe("Summer only");
    expect(en.offers[MONTHLY.id]!.summary?.description).toBe("Valid through August.");
  });

  it("returns null copy when the admin left it blank, so the client uses its default", async () => {
    // Empty must not become "" — the card branches on null to fall back to its own wording.
    const summary = await summaryFor(makeService({ live: [promo()] }));
    expect(summary.eyebrow).toBeNull();
    expect(summary.description).toBeNull();
  });

  it("carries the same clamped magnitude on a waiting coupon", async () => {
    const harness = makeService({ coded: [promo({ code: "BUYUK", discountValue: 80 })], maxPercent: 50 });
    const resolved = await harness.service.resolveOffers({
      context: context(),
      plans: [MONTHLY],
      now: NOW,
    });
    expect(resolved.available[0]?.discountValue).toBe(50);
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

describe("PromotionsService INVITED signal", () => {
  const invitedRule = promo({ ruleType: "INVITED", ruleParams: { withinDays: 30 } });
  const invitedUser = context({
    invitedAt: new Date(NOW.getTime() - 3 * 86_400_000),
    phoneFingerprint: "fp-1",
  });

  it("discounts an invited, phone-verified user who never paid, and names the rule on the offer", async () => {
    const harness = makeService({ live: [invitedRule] });
    const offer = await resolveMonthly(harness, { context: invitedUser });
    expect(offer).toMatchObject({ discountMinor: 4_980, promotionId: "p1", ruleType: "INVITED" });
  });

  it("asks about the phone with the advisory (lock-free) read", async () => {
    const harness = makeService({ live: [invitedRule] });
    await resolveMonthly(harness, { context: invitedUser });
    expect(harness.redemptionsRepo.countActiveForPhone).toHaveBeenCalledWith("p1", "fp-1");
  });

  it("withholds it once the phone already carries this promotion on another account", async () => {
    const harness = makeService({ live: [invitedRule], phoneUsed: 1 });
    expect((await resolveMonthly(harness, { context: invitedUser })).discountMinor).toBe(0);
  });

  it("explains a typed INVITED code the phone already used", async () => {
    const harness = makeService({ byCode: promo({ ...invitedRule, code: "DAVET" }), phoneUsed: 1 });
    const offer = await resolveMonthly(harness, { code: "DAVET", context: invitedUser });
    expect(offer.reason).toBe("PHONE_USED");
  });

  it("withholds it from the same user without a verified phone", async () => {
    const harness = makeService({ live: [invitedRule] });
    const offer = await resolveMonthly(harness, {
      context: { ...invitedUser, phoneFingerprint: null },
    });
    expect(offer.discountMinor).toBe(0);
  });

  it("withholds it when the caller left the fingerprint out (undefined fails closed, like null)", async () => {
    const harness = makeService({ live: [invitedRule] });
    const offer = await resolveMonthly(harness, {
      context: { ...invitedUser, phoneFingerprint: undefined as unknown as string | null },
    });
    expect(offer.discountMinor).toBe(0);
    expect(harness.redemptionsRepo.countActiveForPhone).not.toHaveBeenCalled();
  });

  it("never counts phones for any other rule type", async () => {
    const harness = makeService({ live: [promo()] });
    await resolveMonthly(harness, { context: invitedUser });
    expect(harness.redemptionsRepo.countActiveForPhone).not.toHaveBeenCalled();
  });

  it("reports no rule type on a list-price offer", async () => {
    const harness = makeService();
    expect((await resolveMonthly(harness, { context: invitedUser })).ruleType).toBeNull();
  });
});

describe("PromotionsService.previewByRule (a rule's offer, judged without a user)", () => {
  const invited = (overrides: Partial<PromotionRow> = {}) =>
    promo({ id: "invited", ruleType: "INVITED", ruleParams: { withinDays: 30 }, discountValue: 30, ...overrides });
  const preview = (harness: Harness, plans = [MONTHLY]) => harness.service.previewByRule("INVITED", plans);

  it("summarises a live, automatic promotion of that rule", async () => {
    const harness = makeService({ live: [invited()] });

    await expect(preview(harness)).resolves.toMatchObject({
      id: "invited",
      code: null,
      discountType: "PERCENT",
      discountValue: 30,
      planNames: null,
    });
  });

  it("evaluates no user rule and no per-user or per-phone quota", async () => {
    const harness = makeService({ live: [invited()], userUsed: 5, phoneUsed: 5 });

    await expect(preview(harness)).resolves.not.toBeNull();
    expect(harness.redemptionsRepo.countForUser).not.toHaveBeenCalled();
    expect(harness.redemptionsRepo.countActiveForPhone).not.toHaveBeenCalled();
  });

  it("ignores other rule types and promotions that need a code typed", async () => {
    const harness = makeService({
      live: [promo({ id: "anyone" }), promo({ id: "new", ruleType: "NEW_USER" }), invited({ id: "coded", code: "ARKADAS" })],
    });

    await expect(preview(harness)).resolves.toBeNull();
  });

  it("is null while promotions are switched off", async () => {
    const harness = makeService({ live: [invited()], enabled: false });

    await expect(preview(harness)).resolves.toBeNull();
    expect(harness.promotionsRepo.findLive).not.toHaveBeenCalled();
  });

  it("is null when no plan is sellable", async () => {
    const harness = makeService({ live: [invited()] });

    await expect(preview(harness, [])).resolves.toBeNull();
  });

  it("is null for a promotion scoped to plans the caller cannot sell", async () => {
    const harness = makeService({ live: [invited({ planIds: [QUARTERLY.id] })] });

    await expect(preview(harness, [MONTHLY])).resolves.toBeNull();
  });

  it("names the covered sellable plans when the promotion is scoped", async () => {
    const harness = makeService({ live: [invited({ planIds: [QUARTERLY.id] })] });

    await expect(preview(harness, [MONTHLY, QUARTERLY])).resolves.toMatchObject({ planNames: [QUARTERLY.name] });
  });

  it("is null once the global cap is spent, since checkout would refuse every taker", async () => {
    const harness = makeService({ live: [invited({ maxRedemptions: 10 })], globalUsed: 10 });

    await expect(preview(harness)).resolves.toBeNull();
  });

  it("is null when the discount computes to nothing", async () => {
    const harness = makeService({ live: [invited({ discountType: "FIXED", discountValue: 0 })] });

    await expect(preview(harness)).resolves.toBeNull();
  });

  it("advertises the clamped magnitude checkout applies, never the admin's raw entry", async () => {
    const harness = makeService({ live: [invited({ discountValue: 70 })], maxPercent: 50 });

    await expect(preview(harness)).resolves.toMatchObject({ discountValue: 50 });
  });

  it("picks the biggest discount among several", async () => {
    const harness = makeService({ live: [invited({ id: "small", discountValue: 10 }), invited({ id: "big", discountValue: 40 })] });

    await expect(preview(harness)).resolves.toMatchObject({ id: "big", discountValue: 40 });
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
      ruleType: "ANYONE",
      summary: null,
      reason: null,
    };
  });

  describe("an INVITED promotion (once per verified phone)", () => {
    const invitedRule = promo({ ruleType: "INVITED", ruleParams: { withinDays: 30 } });
    const reserveFor = (harness: Harness, userId: string, phoneFingerprint: string | null) =>
      harness.service.reserve({
        tx,
        offer: { ...offer, ruleType: "INVITED" },
        userId,
        orgId: null,
        subscriptionId: `sub-${userId}`,
        phoneFingerprint,
      });

    /**
     * In-memory ledger. The phone count skips VOIDED rows exactly like the repository's SQL, so the
     * test can walk one phone through APPLIED → VOIDED (Review Focus 4: an abandoned checkout frees it).
     */
    function ledger() {
      const harness = makeService({ byCode: invitedRule });
      const rows: Array<{ promotionId: string; userId: string; phoneFingerprint: string | null; status: string }> = [];
      harness.redemptionsRepo.create.mockImplementation(async (entry: (typeof rows)[number]) => {
        rows.push({ ...entry });
        return entry;
      });
      harness.redemptionsRepo.countForUser.mockImplementation(async (promotionId: string, userId: string) =>
        rows.filter((r) => r.promotionId === promotionId && r.userId === userId && r.status !== "VOIDED").length,
      );
      harness.redemptionsRepo.countActiveForPhone.mockImplementation(async (promotionId: string, fp: string) =>
        rows.filter((r) => r.promotionId === promotionId && r.phoneFingerprint === fp && r.status !== "VOIDED").length,
      );
      return { harness, rows };
    }

    it("stores the phone fingerprint on the redemption row", async () => {
      const { harness, rows } = ledger();
      await reserveFor(harness, "u1", "fp-1");
      expect(rows).toEqual([expect.objectContaining({ userId: "u1", phoneFingerprint: "fp-1", status: "RESERVED" })]);
    });

    it("refuses a user without a verified phone before writing anything", async () => {
      const { harness } = ledger();
      await expect(reserveFor(harness, "u1", null)).rejects.toMatchObject({
        code: ErrorCode.PROMOTION_NOT_ELIGIBLE,
        httpStatus: 409,
        details: { reason: "PHONE_REQUIRED" },
      });
      expect(harness.redemptionsRepo.create).not.toHaveBeenCalled();
    });

    it("fails closed when the caller omits the fingerprint (undefined is not a phone)", async () => {
      const { harness } = ledger();
      await expect(
        harness.service.reserve({
          tx,
          offer: { ...offer, ruleType: "INVITED" },
          userId: "u1",
          orgId: null,
          subscriptionId: "sub-u1",
          phoneFingerprint: undefined as unknown as string | null,
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.PROMOTION_NOT_ELIGIBLE,
        httpStatus: 409,
        details: { reason: "PHONE_REQUIRED" },
      });
      expect(harness.redemptionsRepo.countActiveForPhone).not.toHaveBeenCalled();
      expect(harness.redemptionsRepo.create).not.toHaveBeenCalled();
    });

    it("is judged by the promotion row, not the offer: a row now INVITED still needs the phone", async () => {
      const { harness } = ledger(); // the row is INVITED
      await expect(
        harness.service.reserve({
          tx,
          offer: { ...offer, ruleType: "ANYONE" }, // resolved before an admin changed the rule
          userId: "u1",
          orgId: null,
          subscriptionId: "sub-u1",
          phoneFingerprint: null,
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.PROMOTION_NOT_ELIGIBLE,
        details: { reason: "PHONE_REQUIRED" },
      });
      expect(harness.redemptionsRepo.create).not.toHaveBeenCalled();
    });

    it("refuses a second account on a phone that already redeemed it, then frees the phone once that checkout is voided", async () => {
      const { harness, rows } = ledger();
      await reserveFor(harness, "u1", "fp-1");
      rows[0]!.status = "APPLIED";

      await expect(reserveFor(harness, "u2", "fp-1")).rejects.toMatchObject({
        code: ErrorCode.PROMOTION_NOT_ELIGIBLE,
        httpStatus: 409,
        details: { reason: "PHONE_USED" },
      });
      expect(rows).toHaveLength(1);

      rows[0]!.status = "VOIDED"; // the first checkout was abandoned
      await expect(reserveFor(harness, "u2", "fp-1")).resolves.toMatchObject({
        userId: "u2",
        phoneFingerprint: "fp-1",
      });
    });

    it("counts the phone inside the checkout transaction, under the promotion lock", async () => {
      const { harness } = ledger();
      await reserveFor(harness, "u1", "fp-1");
      expect(harness.redemptionsRepo.countActiveForPhone).toHaveBeenCalledWith("p1", "fp-1", tx);
      const lock = harness.redemptionsRepo.acquirePromotionLock.mock.invocationCallOrder[0]!;
      const count = harness.redemptionsRepo.countActiveForPhone.mock.invocationCallOrder[0]!;
      expect(lock).toBeLessThan(count);
    });

    it("keeps the phone off redemptions of every other rule type", async () => {
      const harness = makeService({ byCode: promo() });
      await harness.service.reserve({
        tx,
        offer,
        userId: "u1",
        orgId: null,
        subscriptionId: "s1",
        phoneFingerprint: "fp-1",
      });
      expect(harness.redemptionsRepo.countActiveForPhone).not.toHaveBeenCalled();
      expect(harness.redemptionsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ phoneFingerprint: null }),
        tx,
      );
    });
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
