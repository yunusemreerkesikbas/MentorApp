import { describe, expect, it } from "vitest";
import { historyDateRange } from "../../web/src/lib/history-date-range";

describe("historyDateRange", () => {
  const now = new Date("2026-07-12T15:30:00.000Z");

  it("returns empty for all", () => {
    expect(historyDateRange("all", now)).toEqual({});
  });

  it("maps today to a single UTC day", () => {
    expect(historyDateRange("today", now)).toEqual({ from: "2026-07-12", to: "2026-07-12" });
  });

  it("maps 7d to inclusive 7 UTC days ending today", () => {
    expect(historyDateRange("7d", now)).toEqual({ from: "2026-07-06", to: "2026-07-12" });
  });

  it("maps 30d to inclusive 30 UTC days ending today", () => {
    expect(historyDateRange("30d", now)).toEqual({ from: "2026-06-13", to: "2026-07-12" });
  });
});
