import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { VisionNoteService } from "./vision-note.service";

const USER = { id: "u1", roles: ["STUDENT"] } as never;

describe("VisionNoteService locale cache", () => {
  let complete: ReturnType<typeof vi.fn>;
  let getMine: ReturnType<typeof vi.fn>;
  let getAiNoteLocale: ReturnType<typeof vi.fn>;
  let setAiNote: ReturnType<typeof vi.fn>;
  let service: VisionNoteService;

  beforeEach(() => {
    complete = vi.fn(async () => ({
      text: "Hedefine bugün küçük bir adımla yaklaş.",
      model: "fake",
      promptTokens: 4,
      completionTokens: 5,
    }));
    getMine = vi.fn(async () => ({
      goalTitle: "Öğretmen olmak",
      targetCity: null,
      motivation: null,
      aiNote: "Önceki not.",
    }));
    getAiNoteLocale = vi.fn(async () => "tr");
    setAiNote = vi.fn(async () => undefined);
    service = new VisionNoteService(
      { complete } as never,
      { build: vi.fn(async () => ({ examType: "KPSS", moodLevel: null, recentSessions: null, todayPlan: null })) } as never,
      { append: vi.fn(async () => undefined) } as never,
      { get: vi.fn(async (key: string) => key === FeatureFlag.AI_ENABLED) } as never,
      { getEntitlement: vi.fn(async () => ({ isPremium: true })) } as never,
      { getMine, getAiNoteLocale, setAiNote } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
    );
  });

  it("reuses a note only when the locale matches", async () => {
    await expect(service.note(USER)).resolves.toEqual({
      note: "Önceki not.",
      model: "cache",
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("regenerates a legacy or different-locale note and records the locale", async () => {
    getAiNoteLocale.mockResolvedValue(null);
    await service.note(USER);
    expect(complete).toHaveBeenCalledOnce();
    expect(setAiNote).toHaveBeenCalledWith(
      "u1",
      "Hedefine bugün küçük bir adımla yaklaş.",
      "fake",
      "tr",
    );
  });
});
