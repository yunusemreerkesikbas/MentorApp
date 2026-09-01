import { describe, expect, it } from "vitest";
import type { PromotionOffersView, PromotionSummary } from "@mentor/types";
import { pickBannerPromotion, pickPromotionForDialog } from "./promotions";

function summary(overrides: Partial<PromotionSummary> = {}): PromotionSummary {
  return {
    id: "promo-1",
    code: null,
    label: "Hoş geldin hediyesi",
    eyebrow: null,
    description: null,
    discountType: "PERCENT",
    discountValue: 20,
    planNames: null,
    appliesToPeriods: 1,
    endsAt: null,
    ...overrides,
  };
}

function offers(input: {
  available?: PromotionSummary[];
  applied?: PromotionSummary | null;
}): PromotionOffersView {
  return {
    offers: {
      "premium-monthly": {
        planId: "premium-monthly",
        listPriceMinor: 24900,
        discountMinor: input.applied ? 4980 : 0,
        chargedPriceMinor: input.applied ? 19920 : 24900,
        renewalPriceMinor: 24900,
        promotion: input.applied ?? null,
        reason: null,
      },
    },
    available: input.available ?? [],
  };
}

const NOTHING_SEEN: ReadonlySet<string> = new Set<string>();

describe("pickPromotionForDialog", () => {
  it("announces nothing when no promotion applies", () => {
    expect(pickPromotionForDialog(offers({}), NOTHING_SEEN)).toBeNull();
  });

  it("prefers a coded promotion — it is the one the user must act on", () => {
    const gift = pickPromotionForDialog(
      offers({
        available: [summary({ id: "coded", code: "HOSGELDIN" })],
        applied: summary({ id: "auto", label: "Otomatik kampanya" }),
      }),
      NOTHING_SEEN,
    );
    expect(gift?.code).toBe("HOSGELDIN");
  });

  it("falls back to the automatically applied promotion", () => {
    const gift = pickPromotionForDialog(
      offers({ applied: summary({ label: "Ağustos kampanyası" }) }),
      NOTHING_SEEN,
    );
    expect(gift).toMatchObject({ code: null, label: "Ağustos kampanyası" });
  });

  it("carries the code and label straight from the API, never a hardcoded campaign", () => {
    const gift = pickPromotionForDialog(
      offers({ available: [summary({ code: "YAZ2026", label: "Yaz indirimi" })] }),
      NOTHING_SEEN,
    );
    expect(gift).toMatchObject({ code: "YAZ2026", label: "Yaz indirimi" });
  });

  it("stays quiet about a campaign already shown on this device", () => {
    const shown = offers({ available: [summary({ id: "promo-1" })] });
    expect(pickPromotionForDialog(shown, new Set(["promo-1"]))).toBeNull();
  });

  it("still announces a NEW campaign after an earlier one was seen", () => {
    // The whole point of keying on campaign id: a single "seen" flag would swallow this one.
    const next = offers({
      available: [summary({ id: "old" }), summary({ id: "new", label: "Eylül kampanyası" })],
    });
    expect(pickPromotionForDialog(next, new Set(["old"]))?.id).toBe("new");
  });

  it("falls through to an unseen automatic promotion when the coded one is seen", () => {
    const mixed = offers({
      available: [summary({ id: "coded", code: "ESKI" })],
      applied: summary({ id: "auto", label: "Otomatik" }),
    });
    expect(pickPromotionForDialog(mixed, new Set(["coded"]))?.id).toBe("auto");
  });
});

describe("pickBannerPromotion", () => {
  it("says nothing when no promotion applies", () => {
    expect(pickBannerPromotion(offers({}), false)).toBeNull();
  });

  it("never nudges a Premium user", () => {
    const withDiscount = offers({ applied: summary({ label: "Ağustos kampanyası" }) });
    expect(pickBannerPromotion(withDiscount, true)).toBeNull();
  });

  it("advertises an applied discount", () => {
    const gift = pickBannerPromotion(offers({ applied: summary({ label: "Ağustos" }) }), false);
    expect(gift).toMatchObject({ label: "Ağustos" });
  });

  it("carries a coupon the user has not typed yet, so a dismissed modal leaves it behind", () => {
    const waiting = offers({ available: [summary({ code: "HOSGELDIN" })] });
    expect(pickBannerPromotion(waiting, false)).toMatchObject({ code: "HOSGELDIN" });
  });

  it("prefers the coupon over an applied discount, matching the modal's own priority", () => {
    // Both surfaces must agree on which campaign is "the" campaign.
    const both = offers({
      applied: summary({ id: "auto", label: "Otomatik" }),
      available: [summary({ id: "coded", code: "HOSGELDIN" })],
    });
    expect(pickBannerPromotion(both, false)).toMatchObject({ id: "coded" });
  });

  it("picks the largest discount across plans", () => {
    const many: PromotionOffersView = {
      available: [],
      offers: {
        "premium-monthly": {
          planId: "premium-monthly",
          listPriceMinor: 24900,
          discountMinor: 2490,
          chargedPriceMinor: 22410,
          renewalPriceMinor: 24900,
          promotion: summary({ label: "Küçük" }),
          reason: null,
        },
        "premium-3m": {
          planId: "premium-3m",
          listPriceMinor: 59900,
          discountMinor: 11980,
          chargedPriceMinor: 47920,
          renewalPriceMinor: 59900,
          promotion: summary({ label: "Büyük" }),
          reason: null,
        },
      },
    };
    expect(pickBannerPromotion(many, false)?.label).toBe("Büyük");
  });

  it("survives a failed offers fetch", () => {
    expect(pickBannerPromotion(null, false)).toBeNull();
  });
});
