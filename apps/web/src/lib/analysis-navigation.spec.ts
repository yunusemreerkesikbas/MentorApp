import { describe, expect, it } from "vitest";
import {
  buildAnalysisCoachHref,
  buildAnalysisTabHref,
  shouldNavigateAnalysisTab,
} from "../app/[locale]/(app)/analysis/_components/analysis-types";

describe("analysis tab navigation", () => {
  it("does not navigate when the requested tab is already active", () => {
    expect(shouldNavigateAnalysisTab("entry", "entry")).toBe(false);
    expect(shouldNavigateAnalysisTab("progress", "entry")).toBe(true);
  });

  it("preserves ordinary query parameters without carrying an RSC transport parameter", () => {
    expect(buildAnalysisTabHref("/analysis", "?tab=entry&_rsc=transport&source=summary", "progress"))
      .toBe("/analysis?tab=progress&source=summary");
  });

  it("opens an editable coach seed without sending context", () => {
    expect(buildAnalysisCoachHref("Matematik odağımı konuşalım")).toEqual({
      pathname: "/coach/chat",
      query: { seed: "Matematik odağımı konuşalım" },
    });
  });
});
