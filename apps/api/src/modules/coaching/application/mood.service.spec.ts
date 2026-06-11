import { beforeEach, describe, expect, it } from "vitest";
import { MoodService } from "./mood.service";

const USER = "u1";
const TODAY = new Date().toISOString().slice(0, 10);

const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

/** i18n fake: echoes the key so we can assert which message key was resolved. */
const i18nFake = { translate: (key: string) => key } as never;

function makeMoodsFake() {
  const rows: { checkinDate: string; mood: number }[] = [];
  return {
    rows,
    upsert: async (_tx: unknown, _userId: string, date: string, mood: number) => {
      const existing = rows.find((r) => r.checkinDate === date);
      if (existing) {
        existing.mood = mood;
        return existing;
      }
      const row = { checkinDate: date, mood };
      rows.push(row);
      return row;
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
    service = new MoodService(fakeDb, moods as never, i18nFake);
  });

  it("upserts today's mood and returns the rule-based code + localized message", async () => {
    const dto = await service.upsertToday(USER, 1);
    expect(dto).toEqual({
      checkinDate: TODAY,
      mood: 1,
      code: "COACHING_MOOD_VERY_LOW",
      message: "coaching.mood.VERY_LOW",
    });
  });

  it("re-checking the same day replaces the value (one per day)", async () => {
    await service.upsertToday(USER, 2);
    const dto = await service.upsertToday(USER, 5);
    expect(moods.rows).toHaveLength(1);
    expect(dto.mood).toBe(5);
    expect(dto.code).toBe("COACHING_MOOD_GREAT");
  });

  it("getToday returns null when there is no check-in yet", async () => {
    expect(await service.getToday(USER)).toBeNull();
  });
});
