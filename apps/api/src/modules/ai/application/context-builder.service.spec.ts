import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSystemPrompt } from "../domain/ai.constants";
import { ContextBuilder } from "./context-builder.service";

describe("ContextBuilder (mood grounding)", () => {
  let getMe: ReturnType<typeof vi.fn>;
  let getExamCalendarByFamily: ReturnType<typeof vi.fn>;
  let getToday: ReturnType<typeof vi.fn>;
  let getRecentSummary: ReturnType<typeof vi.fn>;
  let getTodaySummary: ReturnType<typeof vi.fn>;
  let getMemory: ReturnType<typeof vi.fn>;
  let builder: ContextBuilder;

  beforeEach(() => {
    getMe = vi.fn(async () => ({ examType: "KPSS" }));
    getExamCalendarByFamily = vi.fn(async () => ({ daysRemaining: 90, examDateLabel: "12 Tem 2026" }));
    getToday = vi.fn(async () => ({ mood: 2, struggleNote: "matematik" }));
    getRecentSummary = vi.fn(async () => null);
    getTodaySummary = vi.fn(async () => null);
    getMemory = vi.fn(async () => null);
    builder = new ContextBuilder(
      { getMe } as never,
      { getExamCalendarByFamily } as never,
      { getToday } as never,
      { getTodaySummary } as never,
      { getRecentSummary } as never,
      { get: getMemory } as never,
    );
  });

  it("includes today's coarse mood signal in the context", async () => {
    const ctx = await builder.build("u1");
    expect(ctx.moodLevel).toBe(2);
    expect(ctx.struggleNote).toBe("matematik");
    expect(buildSystemPrompt(ctx)).toContain("Bugünkü ruh hali");
  });

  it("leaves mood null when there is no check-in today", async () => {
    getToday.mockResolvedValue(null);
    const ctx = await builder.build("u1");
    expect(ctx.moodLevel).toBeNull();
    expect(ctx.struggleNote).toBeNull();
    expect(buildSystemPrompt(ctx)).not.toContain("Bugünkü ruh hali");
  });

  it("includes the recent-session summary in the context and grounds the prompt", async () => {
    getRecentSummary.mockResolvedValue({
      count7d: 4,
      focusMinutes7d: 120,
      subjects: ["Matematik", "Tarih"],
      lastStruggleNote: "paragraf",
    });
    const ctx = await builder.build("u1");
    expect(ctx.recentSessions).toEqual({
      count7d: 4,
      focusMinutes7d: 120,
      subjects: ["Matematik", "Tarih"],
      lastStruggleNote: "paragraf",
    });
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("Son 7 gün: 4 seans, 120 dk odak");
    expect(prompt).toContain("çalıştığı konular: Matematik, Tarih");
    expect(prompt).toContain('son zorlandığı: "paragraf"');
  });

  it("omits the session line when there is no recent activity", async () => {
    getRecentSummary.mockResolvedValue(null);
    const ctx = await builder.build("u1");
    expect(ctx.recentSessions).toBeNull();
    expect(buildSystemPrompt(ctx)).not.toContain("Son 7 gün");
  });

  it("includes today's plan summary in the context and grounds the prompt", async () => {
    getTodaySummary.mockResolvedValue({
      total: 5,
      done: 2,
      pendingTitles: ["Matematik tekrarı", "Coğrafya özeti"],
    });
    const ctx = await builder.build("u1");
    expect(ctx.todayPlan).toEqual({
      total: 5,
      done: 2,
      pendingTitles: ["Matematik tekrarı", "Coğrafya özeti"],
    });
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("Bugünün planı: 2/5 tamam");
    expect(prompt).toContain('kalan: "Matematik tekrarı", "Coğrafya özeti"');
  });

  it("omits the plan line when there are no tasks today", async () => {
    getTodaySummary.mockResolvedValue(null);
    const ctx = await builder.build("u1");
    expect(ctx.todayPlan).toBeNull();
    expect(buildSystemPrompt(ctx)).not.toContain("Bugünün planı");
  });

  it("grounds the prompt with the memory profile when one exists", async () => {
    getMemory.mockResolvedValue({
      summary: "Hedefi: KPSS 90 net. Zorlandığı: paragraf.",
      model: "fake",
      messageCount: 10,
      updatedAt: new Date(),
    });
    const ctx = await builder.build("u1");
    expect(ctx.memoryProfile).toContain("Hedefi: KPSS 90 net");
    expect(buildSystemPrompt(ctx)).toContain("Kullanıcı profili (geçmiş sohbetlerden):");
  });

  it("omits the profile line when there is no memory yet", async () => {
    getMemory.mockResolvedValue(null);
    const ctx = await builder.build("u1");
    expect(ctx.memoryProfile).toBeNull();
    expect(buildSystemPrompt(ctx)).not.toContain("Kullanıcı profili");
  });

  it("still builds context (mood + sessions) when the user has no exam type", async () => {
    getMe.mockResolvedValue({ examType: null });
    getRecentSummary.mockResolvedValue({
      count7d: 1,
      focusMinutes7d: 25,
      subjects: [],
      lastStruggleNote: null,
    });
    const ctx = await builder.build("u1");
    expect(ctx.examType).toBeNull();
    expect(ctx.recentSessions?.count7d).toBe(1);
    expect(buildSystemPrompt(ctx)).toContain("Son 7 gün: 1 seans, 25 dk odak");
  });
  it("grounds the prompt with authoritative mock-exam results without publisher data", async () => {
    const ctx = await builder.build("u1");
    const prompt = buildSystemPrompt(ctx, [], {
      id: "00000000-0000-4000-8000-0000000000e1",
      examId: "00000000-0000-4000-8000-0000000000e2",
      examName: "KPSS Genel Yetenek",
      takenAt: "2026-07-13T12:00:00.000Z",
      totalNet: "72.50",
      publisherName: "SECRET PUBLISHER",
      subjects: [
        {
          subjectRef: "math",
          subjectName: "Matematik",
          correct: 30,
          wrong: 8,
          blank: 2,
          net: "28.00",
        },
      ],
    });

    expect(prompt).toContain("KPSS Genel Yetenek");
    expect(prompt).toContain("13.07.2026");
    expect(prompt).toContain("toplam net: 72.50");
    expect(prompt).toContain("Matematik: D 30, Y 8, Boş 2, net 28.00");
    expect(prompt).not.toContain("SECRET PUBLISHER");
  });

});
