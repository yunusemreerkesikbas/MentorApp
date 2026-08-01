import { describe, expect, it } from "vitest";
import {
  buildCoachPersonalization,
  buildSystemPrompt,
  type CoachContext,
} from "./ai.constants";

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

  it("requires evidence-led coaching when personal study context exists", () => {
    const prompt = buildSystemPrompt({
      examType: "KPSS",
      moodLevel: 3,
      recentSessions: {
        count7d: 3,
        focusMinutes7d: 140,
        subjects: ["Türkçe", "Matematik"],
      },
      todayPlan: { total: 4, done: 1 },
    });

    expect(prompt).toContain("Son 7 gün: 3 seans, 140 dk odak");
    expect(prompt).toContain("Bugünün planı: 1/4 tamam");
    expect(prompt).toContain("en az bir somut BAĞLAM sinyalini doğal bir cümlede kullan");
    expect(prompt).toContain("tek uygulanabilir öneri seç");
    expect(prompt).toContain("neden bu öğrenciye uygun olduğunu açıkla");
  });

  it("requires one diagnostic question when actionable context is absent", () => {
    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain("kişiselleştirilmiş gibi davranma");
    expect(prompt).toContain("tek kısa teşhis sorusu sor");
  });

  it("does not treat empty aggregates as personalization evidence", () => {
    const personalization = buildCoachPersonalization({
      examType: "KPSS",
      moodLevel: null,
      recentSessions: { count7d: 0, focusMinutes7d: 0, subjects: [] },
      todayPlan: { total: 0, done: 0 },
    });

    expect(personalization).toMatchObject({
      mode: "NEEDS_INPUT",
      recentSessions: null,
      todayPlan: null,
    });
    const prompt = buildSystemPrompt({
      examType: "KPSS",
      moodLevel: null,
      recentSessions: { count7d: 0, focusMinutes7d: 0, subjects: [] },
      todayPlan: { total: 0, done: 0 },
    });
    expect(prompt).not.toContain("Son 7 gün:");
    expect(prompt).not.toContain("Bugünün planı:");
  });

  it("requires a machine-readable signal marker before the visible answer", () => {
    const prompt = buildSystemPrompt({
      examType: "KPSS",
      moodLevel: null,
      recentSessions: {
        count7d: 3,
        focusMinutes7d: 140,
        subjects: ["Türkçe"],
      },
      todayPlan: null,
    });

    expect(prompt).toContain("<<PERSONALIZATION:RECENT_SESSIONS>>");
    expect(prompt).toContain("yanıtın ilk satırında");
  });
});
