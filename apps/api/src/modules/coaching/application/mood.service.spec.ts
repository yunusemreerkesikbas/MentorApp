import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { todayInIstanbul } from "../domain/date.util";
import { MoodService } from "./mood.service";

const USER = "u1";
const TODAY = todayInIstanbul();

const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

/** i18n fake: echoes the key so we can assert which message key was resolved. */
const i18nFake = { translate: (key: string) => key } as never;

interface FakeRow {
  checkinDate: string;
  mood: number;
  struggleNote: string | null;
  aiReflection: string | null;
}

function makeMoodsFake() {
  const rows: FakeRow[] = [];
  return {
    rows,
    upsert: async (
      _tx: unknown,
      _userId: string,
      date: string,
      mood: number,
      struggleNote: string | null,
    ) => {
      const existing = rows.find((r) => r.checkinDate === date);
      if (existing) {
        const changed = existing.mood !== mood || existing.struggleNote !== struggleNote;
        existing.mood = mood;
        existing.struggleNote = struggleNote;
        if (changed) existing.aiReflection = null; // only an actual change invalidates the cache
        return existing;
      }
      const row: FakeRow = { checkinDate: date, mood, struggleNote, aiReflection: null };
      rows.push(row);
      return row;
    },
    setAiReflection: async (
      _tx: unknown,
      _userId: string,
      date: string,
      reflection: string,
    ) => {
      const row = rows.find((r) => r.checkinDate === date);
      if (row) row.aiReflection = reflection;
    },
    findByDate: async (_tx: unknown, _userId: string, date: string) =>
      rows.find((r) => r.checkinDate === date),
    listPaged: async () => ({ items: rows, total: rows.length }),
  };
}

describe("MoodService", () => {
  let moods: ReturnType<typeof makeMoodsFake>;
  let service: MoodService;

  beforeEach(() => {
    moods = makeMoodsFake();
    service = new MoodService(fakeDb, moods as never, i18nFake, { emit: () => {}, emitAsync: async () => [] } as never);
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    ["2026-11-02T20:59:59.999Z", "2026-11-02"],
    ["2026-11-02T21:00:00.000Z", "2026-11-03"],
    ["2026-11-02T23:18:24.004Z", "2026-11-03"],
  ])("saves and reads the Istanbul mood day at %s", async (instant, date) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant));
    const saved = await service.upsertToday(USER, 2);
    await service.setTodayAiReflection(USER, "Küçük bir adım yeter.", "fake", "tr");

    expect(saved.checkinDate).toBe(date);
    expect(await service.getToday(USER)).toMatchObject({
      checkinDate: date, mood: 2, aiReflection: "Küçük bir adım yeter.",
    });
  });

  it("starts a new mood check-in at Istanbul midnight without reusing yesterday's mood", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T20:59:59.999Z"));
    await service.upsertToday(USER, 2);
    vi.setSystemTime(new Date("2026-11-02T21:00:00.000Z"));

    expect(await service.getToday(USER)).toBeNull();
    await service.upsertToday(USER, 4);
    expect(moods.rows.map((row) => row.checkinDate)).toEqual(["2026-11-02", "2026-11-03"]);
  });

  it("upserts today's mood and returns the rule-based code + localized message", async () => {
    const dto = await service.upsertToday(USER, 1);
    expect(dto).toEqual({
      checkinDate: TODAY,
      mood: 1,
      code: "COACHING_MOOD_VERY_LOW",
      message: "coaching.mood.VERY_LOW",
      struggleNote: null,
      aiReflection: null,
    });
  });

  it("persists an optional struggle note (blank → null)", async () => {
    const withNote = await service.upsertToday(USER, 3, "matematik");
    expect(withNote.struggleNote).toBe("matematik");
    const blank = await service.upsertToday(USER, 3, "   ");
    expect(blank.struggleNote).toBeNull();
  });

  it("re-checking the same day replaces the value (one per day)", async () => {
    await service.upsertToday(USER, 2);
    const dto = await service.upsertToday(USER, 5);
    expect(moods.rows).toHaveLength(1);
    expect(dto.mood).toBe(5);
    expect(dto.code).toBe("COACHING_MOOD_GREAT");
  });

  it("caches today's AI reflection in place and exposes it via getToday", async () => {
    await service.upsertToday(USER, 4);
    await service.setTodayAiReflection(USER, "Harika gidiyorsun!", "fake", "tr");
    const today = await service.getToday(USER);
    expect(today?.aiReflection).toBe("Harika gidiyorsun!");
  });

  it("keeps the cached reflection when the same mood is re-submitted (cost control)", async () => {
    await service.upsertToday(USER, 4);
    await service.setTodayAiReflection(USER, "Devam et!", "fake", "tr");
    await service.upsertToday(USER, 4); // identical → cache must survive
    expect((await service.getToday(USER))?.aiReflection).toBe("Devam et!");

    await service.upsertToday(USER, 2); // actual change → cache invalidated
    expect((await service.getToday(USER))?.aiReflection).toBeNull();
  });

  it("getToday returns null when there is no check-in yet", async () => {
    expect(await service.getToday(USER)).toBeNull();
  });
});
