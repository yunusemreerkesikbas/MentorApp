import { describe, expect, it, vi } from "vitest";
import { addDays, todayIso } from "../domain/date.util";
import { TodayService } from "./today.service";

const USER = "u1";

const i18nFake = { translate: (key: string) => key } as never;

function build(overrides: {
  examType?: string | null;
  calendar?: unknown;
  currentStreak?: number;
  mood?: unknown;
}) {
  const users = {
    getMe: vi.fn(async () => ({ displayName: "Elif", examType: overrides.examType ?? "KPSS" })),
  };
  const plan = {
    listForDate: vi.fn(async () => [
      { id: "t1", title: "Paragraf", subject: "Türkçe", status: "DONE", sortOrder: 0, taskDate: todayIso() },
    ]),
  };
  const streak = {
    getSummary: vi.fn(async () => ({
      currentStreak: overrides.currentStreak ?? 7,
      longestStreak: 21,
      freezeTokens: 2,
    })),
  };
  const mood = { getToday: vi.fn(async () => overrides.mood ?? null) };
  const content = {
    getExamCalendar: vi.fn(async () =>
      overrides.calendar === undefined
        ? {
            examType: "KPSS",
            examName: "KPSS Lisans 2026",
            examDate: addDays(todayIso(), 30),
            source: "ÖSYM",
            sourceUrl: "https://www.osym.gov.tr",
          }
        : overrides.calendar,
    ),
  };
  const service = new TodayService(
    users as never,
    plan as never,
    streak as never,
    mood as never,
    content as never,
    i18nFake,
  );
  return { service, users, plan, streak, mood, content };
}

describe("TodayService — composite panel payload", () => {
  it("assembles the full daily-hub payload (matches the panel mock shape)", async () => {
    const { service } = build({});
    const result = await service.getToday(USER);

    expect(result.greetingName).toBe("Elif");
    expect(result.motivationalLine).toBe("coaching.motivation.GOING"); // streak > 0
    expect(result.countdown).not.toBeNull();
    expect(result.countdown?.examName).toBe("KPSS Lisans 2026");
    expect(result.countdown?.daysRemaining).toBe(30);
    expect(result.streak).toEqual({ currentStreak: 7, longestStreak: 21, freezeTokens: 2 });
    expect(result.tasks).toHaveLength(1);
    expect(result.sessionPresets.map((p) => p.id)).toEqual(["25_5", "50_10"]);
    expect(result.mood).toBeNull();
  });

  it("uses the START motivational line when the streak is zero", async () => {
    const { service } = build({ currentStreak: 0 });
    const result = await service.getToday(USER);
    expect(result.motivationalLine).toBe("coaching.motivation.START");
  });

  it("returns a null countdown when there is no exam calendar (no silent fallback)", async () => {
    const { service } = build({ calendar: null });
    const result = await service.getToday(USER);
    expect(result.countdown).toBeNull();
  });
});
