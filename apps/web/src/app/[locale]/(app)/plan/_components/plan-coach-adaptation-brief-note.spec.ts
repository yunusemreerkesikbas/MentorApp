import { describe, expect, it } from "vitest";
import {
  formatKnownBrief,
  isMinuteEntry,
  planWindowDays,
  seedBriefSubjects,
  summarizePendingWeek,
} from "./plan-coach-adaptation-brief-note";

describe("pending week", () => {
  it("counts pending tasks and keeps the first spelling of each subject", () => {
    expect(
      summarizePendingWeek({
        "2026-09-22": [
          { status: "PENDING", subject: "Tarih" },
          { status: "DONE", subject: "Matematik" },
          { status: "PENDING", subject: " tarih " },
          { status: "PENDING", subject: null },
        ],
      }),
    ).toEqual({ pendingCount: 3, subjects: ["Tarih"] });
  });

  it("seeds chips from taxonomy order, every known subject", () => {
    expect(
      seedBriefSubjects(
        ["Tarih", "Coğrafya", "Vatandaşlık", "Matematik"],
        ["matematik", "Tarih", "Coğrafya", "Fizik", "Vatandaşlık"],
      ),
    ).toEqual(["Tarih", "Coğrafya", "Vatandaşlık", "Matematik"]);
  });
});

describe("known brief", () => {
  it("joins the facts we already have", () => {
    expect(
      formatKnownBrief({
        exam: "KPSS · Lisans",
        goal: "günde 60 dk hedef",
        pending: "bu hafta 8 bekleyen görev",
      }),
    ).toBe("KPSS · Lisans · günde 60 dk hedef · bu hafta 8 bekleyen görev");
    expect(formatKnownBrief({ exam: null, goal: null, pending: null })).toBeNull();
  });
});

describe("plan wizard inputs", () => {
  it("takes any whole minute count between 10 and 600", () => {
    expect([10, 45, 600].every(isMinuteEntry)).toBe(true);
    expect([null, 5, 601, 45.5, Number.NaN].some(isMinuteEntry)).toBe(false);
  });

  it("lists the next seven days as ISO weekdays, starting today", () => {
    // 21 July 2026 is a Tuesday.
    expect(planWindowDays(new Date(2026, 6, 21, 23, 30)).map((day) => day.weekday)).toEqual([
      2, 3, 4, 5, 6, 7, 1,
    ]);
  });
});
