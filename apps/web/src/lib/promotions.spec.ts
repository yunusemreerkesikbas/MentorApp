import { describe, expect, it } from "vitest";
import type { PromotionOffersView, PromotionSummary } from "@mentor/types";
import { pickWelcomeGift } from "./promotions";

function summary(overrides: Partial<PromotionSummary> = {}): PromotionSummary {
  return {
    code: null,
    label: "Hoş geldin hediyesi",
    discountType: "PERCENT",
    discountValue: 20,
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

describe("pickWelcomeGift", () => {
  it("announces nothing when no promotion applies", () => {
    expect(pickWelcomeGift(offers({}))).toBeNull();
  });

  it("prefers a coded promotion — it is the one the user must act on", () => {
    const gift = pickWelcomeGift(
      offers({
        available: [summary({ code: "HOSGELDIN" })],
        applied: summary({ label: "Otomatik kampanya" }),
      }),
    );
    expect(gift?.code).toBe("HOSGELDIN");
  });

  it("falls back to the automatically applied promotion", () => {
    const gift = pickWelcomeGift(offers({ applied: summary({ label: "Ağustos kampanyası" }) }));
    expect(gift).toMatchObject({ code: null, label: "Ağustos kampanyası" });
  });

  it("carries the code and label straight from the API, never a hardcoded campaign", () => {
    const gift = pickWelcomeGift(
      offers({ available: [summary({ code: "YAZ2026", label: "Yaz indirimi" })] }),
    );
    expect(gift).toMatchObject({ code: "YAZ2026", label: "Yaz indirimi" });
  });
});
