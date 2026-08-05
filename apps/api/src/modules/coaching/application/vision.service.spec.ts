import { beforeEach, describe, expect, it } from "vitest";
import type { VisionBoardDoc } from "@mentor/types";
import { visionBoardDocSchema } from "@mentor/validation";
import { VisionService } from "./vision.service";

/** A real uuid, not "u1": board storage keys embed the user id and the schema checks its shape. */
const USER = "55555555-5555-4555-8555-555555555555";
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
  board: unknown;
  createdAt: Date;
  updatedAt: Date;
}

type FakeInput = Omit<FakeRow, "aiNote" | "board" | "createdAt" | "updatedAt">;

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
      row = {
        ...input,
        aiNote: null,
        board: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return row;
    },
    /** Mirrors the real `updateBoard`: writes `board` and touches nothing else — notably `aiNote`. */
    updateBoard: async (_tx: unknown, _userId: string, board: unknown) => {
      if (!row) return undefined;
      row.board = board;
      return row;
    },
    setAiNote: async (_tx: unknown, _userId: string, note: string) => {
      if (row) row.aiNote = note;
    },
    findByUser: async () => row,
  };
}

/** Records what the service asked storage to delete, so orphan cleanup is observable. */
function makeStorageFake() {
  const deleted: string[] = [];
  return {
    deleted,
    deleteObject: async (key: string) => {
      deleted.push(key);
    },
    getPublicUrl: (key: string) => `/fake-object?key=${key}`,
  };
}

/** Item ids and object names are uuids (the client mints them with `crypto.randomUUID()`). */
const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const imageKey = (n: number) => `vision-board/${USER}/${uid(n)}.jpg`;

const IMAGE_A = imageKey(1);
const IMAGE_B = imageKey(2);

function imageItem(id: string, storageKey: string) {
  return {
    id,
    kind: "image" as const,
    storageKey,
    frame: "polaroid" as const,
    x: 100,
    y: 100,
    width: 300,
    height: 400,
    rotation: -3,
    opacity: 1,
    z: 1,
  };
}

function boardWith(items: VisionBoardDoc["items"]): VisionBoardDoc {
  return {
    version: 1,
    status: "DRAFT",
    frame: "wood",
    background: { kind: "texture", value: "cork" },
    items,
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
  let storage: ReturnType<typeof makeStorageFake>;
  let service: VisionService;

  beforeEach(() => {
    visions = makeVisionsFake();
    storage = makeStorageFake();
    service = new VisionService(
      fakeDb,
      visions as never,
      makeGeoFake([
        [SELCUK, KONYA],
        [HACETTEPE, ANKARA],
      ]) as never,
      makeKpssFake() as never,
      storage as never,
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

  /* --------------------------------- collage board --------------------------------- */

  describe("putBoard", () => {
    /**
     * The reason the board has its own endpoint at all. If saving a layout ever went through the
     * goal upsert, every drag would clear the cached premium note and bill a fresh LLM call.
     */
    it("keeps the cached AI note when the board changes", async () => {
      await service.upsert(USER, { goalTitle: "Memur olmak", targetTitleId: VHKI });
      await service.setAiNote(USER, "VHKİ yolunda!", "fake");

      await service.putBoard(USER, boardWith([imageItem(uid(1), IMAGE_A)]));

      expect((await service.getMine(USER))?.aiNote).toBe("VHKİ yolunda!");
    });

    it("returns the saved board on the vision DTO", async () => {
      await service.upsert(USER, { goalTitle: "Hukuk" });
      const dto = await service.putBoard(USER, boardWith([imageItem(uid(1), IMAGE_A)]));
      expect(dto.board?.frame).toBe("wood");
      expect(dto.board?.items).toHaveLength(1);
      expect((await service.getMine(USER))?.board?.items[0]?.id).toBe(uid(1));
    });

    /** The client cannot build this URL: R2 is absolute, the dev fake store is API-relative. */
    it("resolves each image key to a loadable url on read", async () => {
      await service.upsert(USER, { goalTitle: "Hukuk" });
      await service.putBoard(USER, boardWith([imageItem(uid(1), IMAGE_A)]));

      const item = (await service.getMine(USER))?.board?.items[0];
      expect(item?.kind === "image" && item.url).toBe(`/fake-object?key=${IMAGE_A}`);
    });

    it("rejects an image key belonging to another user", async () => {
      await service.upsert(USER, { goalTitle: "Hukuk" });
      const foreign = "vision-board/someone-else/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg";

      await expect(
        service.putBoard(USER, boardWith([imageItem(uid(1), foreign)])),
      ).rejects.toMatchObject({ details: { reason: "foreign_storage_key" } });
      expect(visions.row?.board).toBeNull();
    });

    it("refuses to save a board when the user has no goal yet", async () => {
      await expect(service.putBoard(USER, boardWith([]))).rejects.toMatchObject({
        details: { reason: "vision_goal_missing" },
      });
    });

    /** A photo dropped from the board must not keep living at a public R2 URL (KVKK). */
    it("deletes the storage objects of images removed from the board", async () => {
      await service.upsert(USER, { goalTitle: "Hukuk" });
      await service.putBoard(
        USER,
        boardWith([imageItem(uid(1), IMAGE_A), imageItem(uid(2), IMAGE_B)]),
      );

      await service.putBoard(USER, boardWith([imageItem(uid(2), IMAGE_B)]));

      expect(storage.deleted).toEqual([IMAGE_A]);
    });

    it("keeps the objects of images that survive the save", async () => {
      await service.upsert(USER, { goalTitle: "Hukuk" });
      const items = [imageItem(uid(1), IMAGE_A)];
      await service.putBoard(USER, boardWith(items));
      // Same photo, moved and re-framed — not a removal.
      await service.putBoard(USER, boardWith([{ ...items[0]!, x: 900, frame: "tape" }]));

      expect(storage.deleted).toEqual([]);
    });

    /** The goal upsert never lists `board`, so re-saving the goal must leave the collage alone. */
    it("survives a later goal upsert", async () => {
      await service.upsert(USER, { goalTitle: "Hukuk" });
      await service.putBoard(USER, boardWith([imageItem(uid(1), IMAGE_A)]));

      await service.upsert(USER, { goalTitle: "Tıp" });

      expect((await service.getMine(USER))?.board?.items).toHaveLength(1);
    });
  });

  /**
   * Boundary limits live in the schema, not the service — these lock the numbers the editor and
   * the panel card are sized against.
   */
  describe("visionBoardDocSchema", () => {
    it("accepts a well-formed board", () => {
      expect(
        visionBoardDocSchema.safeParse(boardWith([imageItem(uid(1), IMAGE_A)])).success,
      ).toBe(true);
    });

    it("rejects more than 20 images", () => {
      const items = Array.from({ length: 21 }, (_, i) =>
        imageItem(`i${i}`, `vision-board/${USER}/${String(i).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`),
      );
      const result = visionBoardDocSchema.safeParse(boardWith(items));
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain("too_many_images");
    });

    it("rejects duplicate item ids", () => {
      const result = visionBoardDocSchema.safeParse(
        boardWith([imageItem(uid(9), IMAGE_A), imageItem(uid(9), IMAGE_B)]),
      );
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain("duplicate_item_id");
    });

    it("rejects a storage key outside the vision-board prefix", () => {
      const result = visionBoardDocSchema.safeParse(
        boardWith([imageItem("i1", `avatars/${USER}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`)]),
      );
      expect(result.success).toBe(false);
    });

    it("rejects a non-finite coordinate", () => {
      const bad = { ...imageItem(uid(1), IMAGE_A), x: Number.POSITIVE_INFINITY };
      expect(visionBoardDocSchema.safeParse(boardWith([bad])).success).toBe(false);
    });
  });
});
