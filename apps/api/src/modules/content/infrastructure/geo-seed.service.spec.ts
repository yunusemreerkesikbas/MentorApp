import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GEO_REGIONS, UNIVERSITY_KINDS } from "@mentor/types";
import { GeoSeedService } from "./geo-seed.service";
import type { NewCity, NewUniversity } from "./geo.repository";

interface CitySeedFile {
  cities: Array<{ code: string; name: string; slug: string; region: string }>;
}

interface UniversitySeedFile {
  source: string;
  sourceUrl: string;
  verifiedAt: string | null;
  universities: Array<{
    cityCode: string;
    name: string;
    slug: string;
    kind: string;
    latitude: string | null;
    longitude: string | null;
  }>;
}

const read = <T>(file: string): T =>
  JSON.parse(readFileSync(resolve(__dirname, `../seed/${file}`), "utf8")) as T;

const cities = read<CitySeedFile>("cities.seed.json").cities;
const uniSeed = read<UniversitySeedFile>("universities.seed.json");

describe("cities seed file", () => {
  it("covers all 81 provinces with contiguous plate codes 01–81", () => {
    const expected = Array.from({ length: 81 }, (_, i) =>
      String(i + 1).padStart(2, "0"),
    );
    expect(cities.map((c) => c.code)).toEqual(expected);
  });

  it("has unique ASCII slugs — the map build script joins GeoJSON features on them", () => {
    const slugs = cities.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(81);
    expect(slugs.filter((s) => !/^[a-z]+$/.test(s))).toEqual([]);
  });

  it("assigns every province to one of the seven regions", () => {
    const invalid = cities.filter(
      (c) => !(GEO_REGIONS as readonly string[]).includes(c.region),
    );
    expect(invalid).toEqual([]);
  });
});

describe("universities seed file", () => {
  const codes = new Set(cities.map((c) => c.code));

  it("carries the trust metadata the UI renders as a source badge", () => {
    expect(uniSeed.source).toMatch(/ÖSYM/);
    expect(uniSeed.sourceUrl).toMatch(/^https:\/\//);
    expect(Number.isNaN(Date.parse(uniSeed.verifiedAt ?? ""))).toBe(false);
  });

  it("points every university at a real province with a unique slug and known kind", () => {
    const orphans = uniSeed.universities.filter((u) => !codes.has(u.cityCode));
    expect(orphans).toEqual([]);

    expect(new Set(uniSeed.universities.map((u) => u.slug)).size).toBe(
      uniSeed.universities.length,
    );

    const badKind = uniSeed.universities.filter(
      (u) => !(UNIVERSITY_KINDS as readonly string[]).includes(u.kind),
    );
    expect(badKind).toEqual([]);
  });

  it("keeps every geocoded coordinate inside Turkey", () => {
    // Catches the failure mode that matters: a lookup that silently resolved to another country
    // would put a pin in the sea. Turkey spans roughly 25.6–45.0 E, 35.8–42.2 N.
    const outside = uniSeed.universities
      .filter((u) => u.latitude != null && u.longitude != null)
      .filter((u) => {
        const lat = Number(u.latitude);
        const lng = Number(u.longitude);
        return lat < 35.8 || lat > 42.2 || lng < 25.6 || lng > 45.0;
      })
      .map((u) => `${u.name} (${u.latitude}, ${u.longitude})`);
    expect(outside).toEqual([]);
  });

  it("has coordinates for the large majority — a gap means a missing pin, not a wrong one", () => {
    const withCoords = uniSeed.universities.filter(
      (u) => u.latitude != null,
    ).length;
    expect(withCoords / uniSeed.universities.length).toBeGreaterThan(0.9);
  });
});

interface KpssSeedFile {
  round: string;
  titles: Array<{ name: string; slug: string }>;
  institutions: Array<{ name: string; slug: string }>;
  postings: Array<{
    osymCode: string;
    cityCode: string;
    titleName: string;
    institutionName: string;
    quota: number;
  }>;
}

const kpssSeed = read<KpssSeedFile>("kpss.2026-1.seed.json");

describe("kpss seed file", () => {
  it("points every posting at a province, a known title and a known institution", () => {
    const codes = new Set(cities.map((c) => c.code));
    const titleNames = new Set(kpssSeed.titles.map((t) => t.name));
    const institutionNames = new Set(kpssSeed.institutions.map((i) => i.name));

    const broken = kpssSeed.postings.filter(
      (p) =>
        !codes.has(p.cityCode) ||
        !titleNames.has(p.titleName) ||
        !institutionNames.has(p.institutionName),
    );
    expect(broken).toEqual([]);
  });

  it("has one row per ÖSYM code and no whitespace-variant duplicates", () => {
    expect(new Set(kpssSeed.postings.map((p) => p.osymCode)).size).toBe(
      kpssSeed.postings.length,
    );
    // The guides wrap long cells with a literal CRLF at whatever column happened to be narrow, so
    // "KORUMA VE GÜVENLİK\r\nGÖREVLİSİ" and "KORUMA VE\r\nGÜVENLİK GÖREVLİSİ" arrived as two
    // titles for one job. Collapsing internal whitespace is what keeps the reference lists honest.
    for (const list of [kpssSeed.titles, kpssSeed.institutions]) {
      expect(list.filter((x) => /\s{2,}|[\r\n]/.test(x.name))).toEqual([]);
      expect(new Set(list.map((x) => x.slug)).size).toBe(list.length);
    }
  });
});

describe("GeoSeedService", () => {
  function run() {
    const geoCalls: Array<{ cities: NewCity[]; universities: NewUniversity[] }> = [];
    const datasetCalls: unknown[][] = [];
    const kpssCalls: Array<{
      dataset: { period: string; sortKey: number; isCurrent: boolean };
      titles: unknown[];
      institutions: unknown[];
      postings: unknown[];
    }> = [];
    const service = new GeoSeedService(
      {
        seedGeo: async (input: {
          cities: NewCity[];
          universities: NewUniversity[];
        }) => {
          geoCalls.push(input);
        },
      } as never,
      {
        seedKpss: async (input: {
          dataset: { period: string; sortKey: number; isCurrent: boolean };
          titles: unknown[];
          institutions: unknown[];
          postings: unknown[];
        }) => {
          kpssCalls.push(input);
          return "dataset-id";
        },
      } as never,
      {
        seedDatasets: async (rows: unknown[]) => {
          datasetCalls.push(rows);
        },
      } as never,
    );
    return { service, geoCalls, kpssCalls, datasetCalls };
  }

  it("seeds provinces and universities in a SINGLE call — one batched statement per table", async () => {
    const { service, geoCalls } = run();
    await service.onModuleInit();

    // One call carrying the whole set. If this ever becomes hundreds of calls, the seed has
    // regressed to per-row awaits and every cold start pays that many round-trips to Neon.
    expect(geoCalls).toHaveLength(1);
    expect(geoCalls[0]!.cities).toHaveLength(81);
    expect(geoCalls[0]!.universities).toHaveLength(uniSeed.universities.length);
  });

  it("seeds each KPSS round in a single call", async () => {
    const { service, kpssCalls } = run();
    await service.onModuleInit();

    // One call per period file, each carrying its whole set — never per-row awaits.
    expect(kpssCalls).toHaveLength(1);
    expect(kpssCalls[0]!.titles).toHaveLength(kpssSeed.titles.length);
    expect(kpssCalls[0]!.institutions).toHaveLength(kpssSeed.institutions.length);
    expect(kpssCalls[0]!.postings).toHaveLength(kpssSeed.postings.length);
  });

  it("labels the round and promotes exactly one edition as current", async () => {
    const { service, kpssCalls } = run();
    await service.onModuleInit();

    expect(kpssCalls[0]!.dataset.period).toBe(kpssSeed.round);
    // "2026-1" -> 20261. Sorting the text would put a later "2026-10" behind "2026-2".
    expect(kpssCalls[0]!.dataset.sortKey).toBe(20261);
    // Exactly one current edition, decided by the loader rather than trusting the files to agree.
    expect(kpssCalls.filter((c) => c.dataset.isCurrent)).toHaveLength(1);
    expect(kpssCalls.at(-1)!.dataset.isCurrent).toBe(true);
  });

  it("seeds rounds oldest-first so the newest one ends up current", async () => {
    const { service, kpssCalls } = run();
    await service.onModuleInit();

    const keys = kpssCalls.map((c) => c.dataset.sortKey);
    expect([...keys].sort((a, b) => a - b)).toEqual(keys);
  });
});
