import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSystemPrompt } from "../domain/ai.constants";
import { ContextBuilder } from "./context-builder.service";

describe("ContextBuilder (mood grounding)", () => {
  let getMe: ReturnType<typeof vi.fn>;
  let getExamCalendarByFamily: ReturnType<typeof vi.fn>;
  let getToday: ReturnType<typeof vi.fn>;
  let builder: ContextBuilder;

  beforeEach(() => {
    getMe = vi.fn(async () => ({ examType: "KPSS" }));
    getExamCalendarByFamily = vi.fn(async () => ({ daysRemaining: 90, examDateLabel: "12 Tem 2026" }));
    getToday = vi.fn(async () => ({ mood: 2, struggleNote: "matematik" }));
    builder = new ContextBuilder(
      { getMe } as never,
      { getExamCalendarByFamily } as never,
      { getToday } as never,
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
});
