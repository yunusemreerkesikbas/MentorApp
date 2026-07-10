import { describe, expect, it } from "vitest";
import { parseAnalysisPlanPrefill } from "../../web/src/lib/analysis-plan-prefill";

describe("parseAnalysisPlanPrefill", () => {
  it("returns a trimmed Plan task prefill only for the analysis add intent", () => {
    expect(
      parseAnalysisPlanPrefill({
        add: "1",
        subject: "  Tarih  ",
        title: "  Tarih tekrar et  ",
      }),
    ).toEqual({ subject: "Tarih", title: "Tarih tekrar et" });
  });

  it("returns null when the add intent or task title is missing", () => {
    expect(parseAnalysisPlanPrefill({ add: null, subject: "Tarih", title: "Tarih tekrar et" })).toBeNull();
    expect(parseAnalysisPlanPrefill({ add: "1", subject: "Tarih", title: "   " })).toBeNull();
  });

  it("caps query values to the existing task validation limits", () => {
    expect(
      parseAnalysisPlanPrefill({
        add: "1",
        subject: "s".repeat(100),
        title: "t".repeat(220),
      }),
    ).toEqual({ subject: "s".repeat(80), title: "t".repeat(200) });
  });
});
