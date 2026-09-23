import { describe, expect, it } from "vitest";
import { groundingFact } from "./grounding-fact";

const sessions = {
  count7d: 4,
  focusMinutes7d: 95,
  subjects: ["Tarih", "Coğrafya"],
};

describe("groundingFact", () => {
  it("names the first subject without assigning the week's minutes to that subject", () => {
    const sentence = groundingFact({
      signal: "RECENT_SESSIONS",
      locale: "tr",
      recentSessions: sessions,
    });

    expect(sentence).toBe(
      "Son 7 günde 4 seansla 95 dakika odaklanmışsın. İçinde Tarih var.",
    );
    expect(sentence).not.toContain("Tarih üzerinde 95");
  });

  it("keeps the session counter when no subject name exists", () => {
    expect(
      groundingFact({
        signal: "RECENT_SESSIONS",
        locale: "tr",
        recentSessions: { count7d: 3, focusMinutes7d: 140, subjects: [] },
      }),
    ).toBe("Son 7 günde 3 seansla 140 dakika odaklanmışsın.");
  });

  it("lets the mock focus replace the session counter", () => {
    expect(
      groundingFact({
        signal: "EVALUATE",
        locale: "tr",
        focus: { subjectName: "Tarih", topicName: "Osmanlı" },
        recentSessions: sessions,
      }),
    ).toBe("Son denemende odak Tarih, Osmanlı.");
  });

  it("uses the mood label instead of the raw score", () => {
    expect(
      groundingFact({ signal: "MOOD", locale: "tr", moodLevel: 2 }),
    ).toBe("Bugünkü ruh halin düşük.");
    expect(
      groundingFact({ signal: "MOOD", locale: "en", moodLevel: 2 }),
    ).toBe("Today's mood is low.");
  });

  it("cites a pending subject and never a task title", () => {
    const title = "Matematik 0555 111 22 33";
    const sentence = groundingFact({
      signal: "PLAN",
      locale: "tr",
      pendingSubjects: ["Tarih"],
      todayPlan: { total: 2, done: 0 },
    });

    expect(sentence).toBe("Bekleyen işlerin arasında Tarih var.");
    expect(sentence).not.toContain(title);
    expect(sentence).not.toContain("0555");
  });

  it("falls back to today's plan count when no pending subject exists", () => {
    expect(
      groundingFact({
        signal: "PLAN",
        locale: "tr",
        pendingSubjects: [],
        todayPlan: { total: 3, done: 1 },
      }),
    ).toBe("Bugünkü planındaki 3 görevin 1 tanesini tamamlamışsın.");
  });

  it("returns null when the snapshot has no safe fact", () => {
    expect(
      groundingFact({
        signal: "PLAN",
        locale: "tr",
        pendingSubjects: [],
        todayPlan: null,
        focus: null,
      }),
    ).toBeNull();
    expect(
      groundingFact({ signal: "EVALUATE", locale: "tr", focus: null }),
    ).toBeNull();
  });
});
