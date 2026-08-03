import { beforeEach, describe, expect, it } from "vitest";
import { VisionService } from "./vision.service";

const USER = "u1";
const KONYA = "42";
const ANKARA = "06";
const SELCUK = "11111111-1111-4111-8111-111111111111";
const HACETTEPE = "22222222-2222-4222-8222-222222222222";
const VHKI = "33333333-3333-4333-8333-333333333333";
const SGK = "44444444-4444-4444-8444-444444444444";

const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

interface FakeRow {
  goalTitle: string;
  targetCityCode: string | null;
  targetCity: string | null;
  targetUniversityId: string | null;
  targetTitleId: string | null;
  targetInstitutionId: string | null;
  careerGroup: string | null;
  motivation: string | null;
  aiNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type FakeInput = Omit<FakeRow, "aiNote" | "createdAt" | "updatedAt">;

/**
 * Mirrors the repository's "invalidate AI note only on an actual content change" semantics.
 * Every goal-defining field is compared here, exactly as the real `unchanged` SQL predicate does —
 * if the two ever drift, a stale motivation note survives a goal change in production.
 */
function makeVisionsFake() {
  let row: FakeRow | undefined;
  const GOAL_FIELDS = [
    "goalTitle",
    "targetCityCode",
    "targetCity",
    "targetUniversityId",
    "targetTitleId",
    "targetInstitutionId",
    "careerGroup",
    "motivation",
  ] as const;

  return {
    get row() {
      return row;
    },
    upsert: async (_tx: unknown, _userId: string, input: FakeInput) => {
      if (row) {
        const current = row;
        const changed = GOAL_FIELDS.some((f) => current[f] !== input[f]);
        Object.assign(row, input);
        if (changed) row.aiNote = null;
        return row;
      }
      row = { ...input, aiNote: null, createdAt: new Date(), updatedAt: new Date() };
      return row;
    },
    setAiNote: async (_tx: unknown, _userId: string, note: string) => {
      if (row) row.aiNote = note;
    },
    findByUser: async () => row,
  };
}

/** Only the listed KPSS ids exist; anything else is a dangling reference. */
function makeKpssFake(known: ReadonlyArray<string> = [VHKI, SGK]) {
  return {
    assertTargetsExist: async (titleId: string | null, institutionId: string | null) =>
      (!titleId || known.includes(titleId)) &&
      (!institutionId || known.includes(institutionId)),
    resolveNames: async () => ({ titleName: null, institutionName: null }),
  };
}

/** Only the listed (university, city) pairs exist — everything else is a mismatch. */
function makeGeoFake(pairs: ReadonlyArray<readonly [string, string]>) {
  return {
    universityExistsInCity: async (universityId: string, cityCode: string) =>
      pairs.some(([u, c]) => u === universityId && c === cityCode),
  };
}

describe("VisionService", () => {
  let visions: ReturnType<typeof makeVisionsFake>;
  let service: VisionService;

  beforeEach(() => {
    visions = makeVisionsFake();
    service = new VisionService(
      fakeDb,
      visions as never,
      makeGeoFake([
        [SELCUK, KONYA],
        [HACETTEPE, ANKARA],
      ]) as never,
      makeKpssFake() as never,
    );
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

  it("stores a university once it really sits in the selected city", async () => {
    const dto = await service.upsert(USER, {
      goalTitle: "Bilgisayar mühendisi olmak",
      targetCityCode: KONYA,
      targetUniversityId: SELCUK,
      careerGroup: "YAZILIM",
    });
    expect(dto.targetCityCode).toBe(KONYA);
    expect(dto.targetUniversityId).toBe(SELCUK);
    expect(dto.careerGroup).toBe("YAZILIM");
  });

  it("rejects a university that does not belong to the selected city", async () => {
    await expect(
      service.upsert(USER, {
        goalTitle: "Bilgisayar mühendisi olmak",
        targetCityCode: ANKARA,
        targetUniversityId: SELCUK,
      }),
    ).rejects.toMatchObject({ details: { reason: "university_city_mismatch" } });
    expect(visions.row).toBeUndefined();
  });

  it("invalidates the cached AI note when the target city changes", async () => {
    await service.upsert(USER, { goalTitle: "Tıp", targetCityCode: KONYA });
    await service.setAiNote(USER, "Konya seni bekliyor!", "fake");
    await service.upsert(USER, { goalTitle: "Tıp", targetCityCode: ANKARA });
    expect((await service.getMine(USER))?.aiNote).toBeNull();
  });

  it("invalidates the cached AI note when the career group changes", async () => {
    await service.upsert(USER, { goalTitle: "Üniversite", careerGroup: "SAGLIK" });
    await service.setAiNote(USER, "Beyaz önlük yolda!", "fake");
    await service.upsert(USER, { goalTitle: "Üniversite", careerGroup: "YAZILIM" });
    expect((await service.getMine(USER))?.aiNote).toBeNull();
  });

  it("invalidates the cached AI note when the target university changes", async () => {
    await service.upsert(USER, {
      goalTitle: "Mühendislik",
      targetCityCode: KONYA,
      targetUniversityId: SELCUK,
    });
    await service.setAiNote(USER, "Selçuk yolda!", "fake");
    await service.upsert(USER, {
      goalTitle: "Mühendislik",
      targetCityCode: ANKARA,
      targetUniversityId: HACETTEPE,
    });
    expect((await service.getMine(USER))?.aiNote).toBeNull();
  });

  it("keeps the cached AI note when a map-based goal is re-saved unchanged", async () => {
    const goal = {
      goalTitle: "Mühendislik",
      targetCityCode: KONYA,
      targetUniversityId: SELCUK,
      careerGroup: "YAZILIM" as const,
    };
    await service.upsert(USER, goal);
    await service.setAiNote(USER, "Selçuk yolda!", "fake");
    await service.upsert(USER, goal);
    expect((await service.getMine(USER))?.aiNote).toBe("Selçuk yolda!");
  });

  it("stores a KPSS goal as title plus optional institution", async () => {
    const dto = await service.upsert(USER, {
      goalTitle: "Memur olmak",
      targetCityCode: KONYA,
      targetTitleId: VHKI,
      targetInstitutionId: SGK,
    });
    expect(dto.targetTitleId).toBe(VHKI);
    expect(dto.targetInstitutionId).toBe(SGK);
    // No city cross-check on the KPSS side: an institution is national, and a round's postings are
    // not a claim about where it operates — so Konya + SGK is a perfectly valid pair.
    expect(dto.targetCityCode).toBe(KONYA);
  });

  it("rejects a KPSS target id that does not exist", async () => {
    await expect(
      service.upsert(USER, {
        goalTitle: "Memur olmak",
        targetTitleId: "99999999-9999-4999-8999-999999999999",
      }),
    ).rejects.toMatchObject({ details: { reason: "unknown_kpss_target" } });
    expect(visions.row).toBeUndefined();
  });

  it("invalidates the cached AI note when the target title changes", async () => {
    await service.upsert(USER, { goalTitle: "Memur olmak", targetTitleId: VHKI });
    await service.setAiNote(USER, "VHKİ yolunda!", "fake");
    await service.upsert(USER, { goalTitle: "Memur olmak", targetTitleId: SGK });
    expect((await service.getMine(USER))?.aiNote).toBeNull();
  });

  it("keeps the cached AI note when a KPSS goal is re-saved unchanged", async () => {
    const goal = {
      goalTitle: "Memur olmak",
      targetCityCode: KONYA,
      targetTitleId: VHKI,
      targetInstitutionId: SGK,
    };
    await service.upsert(USER, goal);
    await service.setAiNote(USER, "VHKİ yolunda!", "fake");
    await service.upsert(USER, goal);
    expect((await service.getMine(USER))?.aiNote).toBe("VHKİ yolunda!");
  });
});
