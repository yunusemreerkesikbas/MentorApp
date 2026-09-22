import { describe, expect, it } from "vitest";
import {
  PLAN_ADAPTATION_NOTE_MAX,
  composePlanAdaptationNote,
  formatKnownBrief,
  isMinuteChoice,
  seedBriefSubjects,
  summarizePendingWeek,
  type PlanAdaptationBriefLabels,
} from "./plan-coach-adaptation-brief-note";

const labels: PlanAdaptationBriefLabels = {
  days: (count) => `Bu hafta ${count} gün.`,
  minutes: (count) => `Günde yaklaşık ${count} dk.`,
  subjects: (names) => `Ağırlık: ${names}.`,
};

describe("composePlanAdaptationNote", () => {
  it("omits empty answers", () => {
    expect(
      composePlanAdaptationNote(
        { days: null, minutes: null, subjects: [], note: "  " },
        labels,
      ),
    ).toBe("");
  });

  it("joins only the answers that were given", () => {
    expect(
      composePlanAdaptationNote(
        {
          days: 5,
          minutes: 60,
          subjects: ["Tarih", "Coğrafya"],
          note: "Cuma hafif.",
        },
        labels,
      ),
    ).toBe(
      "Bu hafta 5 gün. Günde yaklaşık 60 dk. Ağırlık: Tarih, Coğrafya. Cuma hafif.",
    );
  });

  it("keeps the first three distinct subjects", () => {
    expect(
      composePlanAdaptationNote(
        {
          days: null,
          minutes: null,
          subjects: ["Tarih", " tarih ", "Coğrafya", "Vatandaşlık", "Matematik"],
          note: "",
        },
        labels,
      ),
    ).toBe("Ağırlık: Tarih, Coğrafya, Vatandaşlık.");
  });

  it("clips the free note before the structured lines", () => {
    const structured = composePlanAdaptationNote(
      { days: 5, minutes: null, subjects: [], note: "" },
      labels,
    );
    const note = "x".repeat(PLAN_ADAPTATION_NOTE_MAX);
    const composed = composePlanAdaptationNote(
      { days: 5, minutes: null, subjects: [], note },
      labels,
    );
    expect(composed.startsWith(`${structured} `)).toBe(true);
    expect(composed.length).toBeLessThanOrEqual(PLAN_ADAPTATION_NOTE_MAX);
    expect(composed.length).toBeGreaterThan(structured.length);
  });

  it("drops the free note when the structured lines already fill the cap", () => {
    const longLabels: PlanAdaptationBriefLabels = {
      ...labels,
      days: () => "g".repeat(PLAN_ADAPTATION_NOTE_MAX + 20),
    };
    expect(
      composePlanAdaptationNote(
        { days: 5, minutes: null, subjects: [], note: "Cuma hafif" },
        longLabels,
      ),
    ).toBe("g".repeat(PLAN_ADAPTATION_NOTE_MAX));
  });
});

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

  it("seeds chips from taxonomy order, capped at three", () => {
    expect(
      seedBriefSubjects(
        ["Tarih", "Coğrafya", "Vatandaşlık", "Matematik"],
        ["matematik", "Tarih", "Coğrafya", "Fizik", "Vatandaşlık"],
      ),
    ).toEqual(["Tarih", "Coğrafya", "Vatandaşlık"]);
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
    expect(isMinuteChoice(60)).toBe(true);
    expect(isMinuteChoice(45)).toBe(false);
  });
});
