import { describe, expect, it } from "vitest";
import type { CoachPersonalizationDto } from "@mentor/types";
import {
  applyCoachPersonalizationMarker,
  createPersonalizationMarkerFilter,
  enforceNeedsInputReply,
} from "./personalization-marker";

const grounded: CoachPersonalizationDto = {
  mode: "GROUNDED",
  examType: "KPSS",
  moodLevel: null,
  recentSessions: {
    count7d: 3,
    focusMinutes7d: 140,
    subjects: ["Türkçe"],
  },
  todayPlan: null,
};

describe("coach personalization marker", () => {
  it("turns a verified signal marker into visible evidence inside the answer", () => {
    const result = applyCoachPersonalizationMarker(
      "<<PERSONALIZATION:RECENT_SESSIONS>>\nBugün tek bir paragraf bloğu dene.",
      grounded,
      "tr",
    );

    expect(result.text).toBe(
      "Son 7 günde 3 seansla 140 dakika odaklanmışsın. Bugün tek bir paragraf bloğu dene.",
    );
    expect(result.personalization.usedSignals).toEqual(["RECENT_SESSIONS"]);
    expect(result.text).not.toContain("<<PERSONALIZATION");
  });

  it("does not expose or claim personalization when actionable evidence is absent", () => {
    const result = applyCoachPersonalizationMarker(
      "<<PERSONALIZATION:NONE>>\nEn çok nerede zorlanıyorsun?",
      {
        mode: "NEEDS_INPUT",
        examType: "KPSS",
        moodLevel: null,
        recentSessions: null,
        todayPlan: null,
      },
      "tr",
    );

    expect(result.text).toBe("En çok nerede zorlanıyorsun?");
    expect(result.personalization.usedSignals).toEqual([]);
  });

  it("falls back to verified evidence when a grounded model omits the marker", () => {
    const result = applyCoachPersonalizationMarker(
      "Bugün tek bir paragraf bloğu dene.",
      grounded,
      "tr",
    );

    expect(result.text).toContain("Son 7 günde 3 seansla 140 dakika odaklanmışsın.");
    expect(result.personalization.usedSignals).toEqual(["RECENT_SESSIONS"]);
  });

  it("keeps a split leading marker out of streamed deltas", () => {
    const filter = createPersonalizationMarkerFilter(grounded, "tr");

    expect(filter.push("<<PERSONAL")).toBe("");
    expect(filter.push("IZATION:RECENT_SESSIONS>>\nBugün ")).toBe(
      "Son 7 günde 3 seansla 140 dakika odaklanmışsın. Bugün ",
    );
    expect(filter.push("başla.")).toBe("başla.");
    expect(filter.flush()).toBe("");
  });

  it("replaces a generic method list with one diagnostic question when data is absent", () => {
    const reply = enforceNeedsInputReply(
      "1. Pomodoro\n2. Zaman bloklama\n3. Hedef belirleme",
      "NEEDS_INPUT",
      "tr",
    );

    expect(reply).toBe(
      "Sana uygun tek bir adım seçebilmem için en çok nerede zorlandığını söyler misin?",
    );
  });

  it("preserves a concise diagnostic question", () => {
    expect(
      enforceNeedsInputReply(
        "Çalışmaya başlamakta mı, odağını sürdürmekte mi zorlanıyorsun?",
        "NEEDS_INPUT",
        "tr",
      ),
    ).toBe("Çalışmaya başlamakta mı, odağını sürdürmekte mi zorlanıyorsun?");
  });
});
