import { describe, expect, it } from "vitest";
import { GeoService } from "./geo.service";
import type { ProgramWithScoreRow } from "../infrastructure/geo.repository";

const UNIVERSITY = {
  id: "11111111-1111-4111-8111-111111111111",
  cityCode: "42",
  name: "SELÇUK ÜNİVERSİTESİ",
  slug: "selcuk-universitesi",
  kind: "STATE",
  foundedYear: null,
  websiteUrl: null,
  latitude: "38.024207",
  longitude: "32.505705",
};

function row(over: Partial<ProgramWithScoreRow>): ProgramWithScoreRow {
  return {
    code: "108911205",
    faculty: "TEKNOLOJİ FAKÜLTESİ",
    name: "Bilgisayar Mühendisliği",
    level: "LISANS",
    durationYears: 4,
    scoreType: "SAY",
    quota: 69,
    guideYear: 2026,
    scoreYear: 2025,
    minScore: "411.79234",
    successRank: 85150,
    ...over,
  };
}

/** Records the folded needle the service hands to SQL, so we can assert on it. */
function makeGeoFake(rows: ProgramWithScoreRow[] = []) {
  const needles: string[] = [];
  return {
    needles,
    findUniversityById: async () => UNIVERSITY,
    findUniversitySource: async () => ({
      source: "ÖSYM",
      sourceUrl: "https://www.osym.gov.tr",
      verifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    }),
    listProgramsByUniversity: async () => rows,
    countProgramsByUniversity: async () => new Map([[UNIVERSITY.id, rows.length]]),
    searchCities: async (_db: unknown, needle: string) => {
      needles.push(needle);
      return [];
    },
    searchUniversities: async () => [],
    searchPrograms: async () => [],
  };
}

const service = (fake: ReturnType<typeof makeGeoFake>) =>
  new GeoService({} as never, fake as never);

describe("GeoService.getUniversityPrograms", () => {
  it("folds the (program, year) join rows back into one program per code", async () => {
    const fake = makeGeoFake([
      row({ scoreYear: 2025, minScore: "411.79234", successRank: 85150 }),
      row({ scoreYear: 2024, minScore: "402.10000", successRank: 91000 }),
      row({ code: "108911206", name: "Makine Mühendisliği", scoreYear: 2025 }),
    ]);

    const result = await service(fake).getUniversityPrograms(UNIVERSITY.id);

    expect(result.programs).toHaveLength(2);
    const computer = result.programs.find((p) => p.code === "108911205")!;
    // Both years survive on one program — this is what makes a year-over-year comparison possible
    // at all; a single `minScore` column would have kept only the newer row.
    expect(computer.scores).toEqual([
      { year: 2025, minScore: 411.79234, successRank: 85150 },
      { year: 2024, minScore: 402.1, successRank: 91000 },
    ]);
    expect(computer.quota).toBe(69);
    expect(computer.guideYear).toBe(2026);
  });

  it("keeps a program that never took a placement, with no score rows", async () => {
    const fake = makeGeoFake([
      row({ scoreYear: null, minScore: null, successRank: null }),
    ]);

    const result = await service(fake).getUniversityPrograms(UNIVERSITY.id);

    // ~13% of the guide has no cutoff ("----"). Such a program is still offered and must be
    // listed; dropping it would silently hide real options.
    expect(result.programs).toHaveLength(1);
    expect(result.programs[0]!.scores).toEqual([]);
  });

  it("reports the program count on the university it belongs to", async () => {
    const fake = makeGeoFake([row({}), row({ code: "108911206" })]);
    const result = await service(fake).getUniversityPrograms(UNIVERSITY.id);
    expect(result.university.programCount).toBe(2);
    expect(result.university.latitude).toBe(38.024207);
  });
});

describe("GeoService.search", () => {
  it("folds Turkish letters so an ASCII query still matches", async () => {
    const fake = makeGeoFake();
    await service(fake).search("İSTANBUL Şehir Üniversitesi");
    // "İ" must become "i" — a plain toLowerCase() leaves a combining dot behind and the SQL side,
    // which folds with translate(), would then never agree with us.
    expect(fake.needles).toEqual(["istanbul sehir universitesi"]);
  });

  it("returns nothing for a query too short to be meaningful", async () => {
    const fake = makeGeoFake();
    const result = await service(fake).search("k");
    expect(result).toEqual({ cities: [], universities: [], programs: [] });
    expect(fake.needles).toEqual([]);
  });
});
