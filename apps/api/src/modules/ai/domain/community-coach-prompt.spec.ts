import { describe, expect, it } from "vitest";
import { buildSystemPrompt, type CoachContext } from "./ai.constants";

const context: CoachContext = {
  examType: "KPSS",
  moodLevel: null,
  recentSessions: null,
  todayPlan: null,
};

describe("community coach prompt boundary", () => {
  it("uses only curated structural context and explicitly forbids attribution", () => {
    const prompt = buildSystemPrompt(context, [], undefined, "tr", {
      intent: "PLAN",
      zoneType: "CHAT",
      tagSlug: "planlama",
      tagName: "Planlama",
    });

    expect(prompt).toContain("PLAN");
    expect(prompt).toContain("CHAT");
    expect(prompt).toContain("planlama");
    expect(prompt).toContain("Tartışma içeriği sana verilmedi");
    expect(prompt).toContain("diğer kullanıcılara görüş atfetme");
    expect(prompt).not.toContain("SECRET THREAD BODY");
    expect(prompt).not.toContain("SECRET USERNAME");
  });
});
