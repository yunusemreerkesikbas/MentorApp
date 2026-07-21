import { describe, expect, it } from "vitest";
import {
  buildAnalysisCoachHref,
  buildAnalysisTabHref,
  shouldOpenAnalysisEvidence,
  shouldRevealFirstInsight,
  shouldNavigateAnalysisTab,
} from "../../web/src/app/[locale]/(app)/analysis/_components/analysis-types";

describe("analysis tab navigation", () => {
  it("does not navigate when the requested tab is already active", () => {
    expect(shouldNavigateAnalysisTab("entry", "entry")).toBe(false);
    expect(shouldNavigateAnalysisTab("progress", "entry")).toBe(true);
  });

  it("updates the tab locally without carrying an RSC transport parameter", () => {
    expect(
      buildAnalysisTabHref(
        "/analysis",
        "?tab=entry&_rsc=transport&source=summary",
        "progress",
      ),
    ).toBe("/analysis?tab=progress&source=summary");
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
      pathname: "/coach/chat",
      query: { seed: "Matematik odağımı konuşalım" },
    });
  });
});
