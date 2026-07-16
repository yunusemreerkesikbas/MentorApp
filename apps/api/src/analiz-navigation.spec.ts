import { describe, expect, it } from "vitest";
import {
  buildAnalysisCoachHref,
  buildAnalizTabHref,
  shouldOpenAnalysisEvidence,
  shouldRevealFirstInsight,
  shouldNavigateAnalizTab,
} from "../../web/src/app/[locale]/(app)/analiz/_components/analiz-types";

describe("analysis tab navigation", () => {
  it("does not navigate when the requested tab is already active", () => {
    expect(shouldNavigateAnalizTab("gir", "gir")).toBe(false);
    expect(shouldNavigateAnalizTab("gelisim", "gir")).toBe(true);
  });

  it("updates the tab locally without carrying an RSC transport parameter", () => {
    expect(
      buildAnalizTabHref(
        "/analiz",
        "?tab=gir&_rsc=transport&source=summary",
        "gelisim",
      ),
    ).toBe("/analiz?tab=gelisim&source=summary");
  });

  it("reveals development only after the first saved attempt", () => {
    expect(shouldRevealFirstInsight(0)).toBe(true);
    expect(shouldRevealFirstInsight(1)).toBe(false);
  });

  it("keeps evidence collapsed when a next focus is available", () => {
    expect(shouldOpenAnalysisEvidence(true)).toBe(false);
    expect(shouldOpenAnalysisEvidence(false)).toBe(true);
  });

  it("opens an editable coach seed without attaching or sending context", () => {
    expect(buildAnalysisCoachHref("Matematik odağımı konuşalım")).toEqual({
      pathname: "/koc/chat",
      query: { seed: "Matematik odağımı konuşalım" },
    });
  });
});
