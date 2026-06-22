import { beforeEach, describe, expect, it } from "vitest";
import { VisionService } from "./vision.service";

const USER = "u1";

const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

interface FakeRow {
  goalTitle: string;
  targetCity: string | null;
  motivation: string | null;
  aiNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Mirrors the repository's "invalidate AI note only on an actual content change" semantics. */
function makeVisionsFake() {
  let row: FakeRow | undefined;
  return {
    get row() {
      return row;
    },
    upsert: async (
      _tx: unknown,
      _userId: string,
      input: { goalTitle: string; targetCity: string | null; motivation: string | null },
    ) => {
      if (row) {
        const changed =
          row.goalTitle !== input.goalTitle ||
          row.targetCity !== input.targetCity ||
          row.motivation !== input.motivation;
        row.goalTitle = input.goalTitle;
        row.targetCity = input.targetCity;
        row.motivation = input.motivation;
        if (changed) row.aiNote = null;
        return row;
      }
      row = {
        goalTitle: input.goalTitle,
        targetCity: input.targetCity,
        motivation: input.motivation,
        aiNote: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return row;
    },
    setAiNote: async (_tx: unknown, _userId: string, note: string) => {
      if (row) row.aiNote = note;
    },
    findByUser: async () => row,
  };
}

describe("VisionService", () => {
  let visions: ReturnType<typeof makeVisionsFake>;
  let service: VisionService;

  beforeEach(() => {
    visions = makeVisionsFake();
    service = new VisionService(fakeDb, visions as never);
  });

  it("getMine returns null when no board is set yet", async () => {
    expect(await service.getMine(USER)).toBeNull();
  });

  it("upserts the goal and normalizes blank optionals to null", async () => {
    const dto = await service.upsert(USER, {
      goalTitle: "Öğretmen olmak",
      targetCity: "  ",
      motivation: "Ailem için",
    });
    expect(dto.goalTitle).toBe("Öğretmen olmak");
    expect(dto.targetCity).toBeNull();
    expect(dto.motivation).toBe("Ailem için");
    expect(dto.aiNote).toBeNull();
  });

  it("keeps the cached AI note when identical content is re-saved (cost control)", async () => {
    await service.upsert(USER, { goalTitle: "Hukuk", targetCity: "İzmir", motivation: null });
    await service.setAiNote(USER, "Hedefine bir adım daha!", "fake");
    await service.upsert(USER, { goalTitle: "Hukuk", targetCity: "İzmir", motivation: null });
    expect((await service.getMine(USER))?.aiNote).toBe("Hedefine bir adım daha!");
  });

  it("invalidates the cached AI note when the goal/motivation changes", async () => {
    await service.upsert(USER, { goalTitle: "Hukuk", targetCity: "İzmir", motivation: null });
    await service.setAiNote(USER, "Devam et!", "fake");
    await service.upsert(USER, { goalTitle: "Tıp", targetCity: "İzmir", motivation: null });
    expect((await service.getMine(USER))?.aiNote).toBeNull();
  });
});
