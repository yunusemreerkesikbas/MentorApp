import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { VisionNoteService } from "./vision-note.service";

const USER = { id: "u1", roles: ["STUDENT"] } as never;

describe("VisionNoteService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let getMine: ReturnType<typeof vi.fn>;
  let getAiNoteLocale: ReturnType<typeof vi.fn>;
  let setAiNote: ReturnType<typeof vi.fn>;
  let resolveTargetNames: ReturnType<typeof vi.fn>;
  let service: VisionNoteService;

  /** What the LLM actually received on the last call. */
  const lastUserPrompt = () => complete.mock.calls.at(-1)?.[0].user as string;

  beforeEach(() => {
    complete = vi.fn(async () => ({
      text: "Hedefine bugün küçük bir adımla yaklaş.",
      model: "fake",
      promptTokens: 4,
      completionTokens: 5,
    }));
    getMine = vi.fn(async () => ({
      goalTitle: "Öğretmen olmak",
      targetCityCode: "42",
      targetCity: null,
      targetUniversityId: null,
      careerGroup: null,
      motivation: null,
      aiNote: "Önceki not.",
    }));
    resolveTargetNames = vi.fn(async () => ({
      cityName: "Konya",
      universityName: null,
    }));
    getAiNoteLocale = vi.fn(async () => "tr");
    setAiNote = vi.fn(async () => undefined);
    service = new VisionNoteService(
      { complete } as never,
      {
        build: vi.fn(async () => ({
          examType: "KPSS",
          moodLevel: null,
          recentSessions: null,
          todayPlan: null,
        })),
      } as never,
      { append: vi.fn(async () => undefined) } as never,
      { get: vi.fn(async (key: string) => key === FeatureFlag.AI_ENABLED) } as never,
      { getEntitlement: vi.fn(async () => ({ isPremium: true })) } as never,
      { getMine, getAiNoteLocale, setAiNote, resolveTargetNames } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
      { translate: vi.fn((key: string) => key.split(".").at(-1)) } as never,
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

  it("names the city when the goal only carries a plate code", async () => {
    // The regression this guards: the map writes `targetCityCode` and leaves the legacy
    // `targetCity` text null, so a prompt reading that field alone lost the city entirely.
    getAiNoteLocale.mockResolvedValue(null);
    await service.note(USER);
    expect(lastUserPrompt()).toContain("Konya");
  });

  it("prefers the target university and drops the bare city line", async () => {
    getAiNoteLocale.mockResolvedValue(null);
    resolveTargetNames.mockResolvedValue({
      cityName: "Konya",
      universityName: "SELÇUK ÜNİVERSİTESİ",
    });
    await service.note(USER);
    const prompt = lastUserPrompt();
    expect(prompt).toContain("SELÇUK ÜNİVERSİTESİ");
    // The university already implies its city, so it appears once, in parentheses.
    expect(prompt).not.toContain("Hedef şehir");
  });

  it("passes the career field as its localized label, not the raw enum", async () => {
    getAiNoteLocale.mockResolvedValue(null);
    getMine.mockResolvedValue({
      goalTitle: "Öğretmen olmak",
      targetCityCode: null,
      targetCity: null,
      targetUniversityId: null,
      careerGroup: "EGITIM",
      motivation: null,
      aiNote: null,
    });
    await service.note(USER);
    // The fake translator returns the last key segment, so a raw enum would surface as "EGITIM".
    expect(lastUserPrompt()).toContain("Hedef alan: EGITIM");
  });
});
