import { describe, expect, it } from "vitest";
import {
  buildDemoWeekPreview,
  getDemoConfig,
  getSampleWeekRows,
} from "./study-program-lp-presets";

describe("study-program-lp-presets", () => {
  it("returns 7 crawlable sample rows for each exam variant", () => {
    expect(getSampleWeekRows("yks", "tr")).toHaveLength(7);
    expect(getSampleWeekRows("tyt", "tr")).toHaveLength(7);
    expect(getSampleWeekRows("lgs", "tr")).toHaveLength(7);
    expect(getSampleWeekRows("lgs", "en")[0]?.day).toBe("Mon");
  });

  it("builds a 7-day interactive schedule preview for YKS, TYT and LGS", () => {
    const yksConfig = getDemoConfig("yks", "tr");
    const yksWeek = buildDemoWeekPreview("yks", "ea", "4", "balanced", yksConfig.days);
    expect(yksWeek).toHaveLength(7);
    expect(yksWeek[0]?.tasks[0]).toContain("AYT Edebiyat / Mat");

    const lgsConfig = getDemoConfig("lgs", "tr");
    const lgsWeek = buildDemoWeekPreview("lgs", "holiday", "2", "science", lgsConfig.days);
    expect(lgsWeek).toHaveLength(7);
    expect(lgsWeek[0]?.tasks[0]).toContain("Fen Bilimleri");
  });
});
