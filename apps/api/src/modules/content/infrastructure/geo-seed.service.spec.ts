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

describe("GeoSeedService", () => {
  it("seeds provinces and universities in a SINGLE call — one batched statement per table", async () => {
    const calls: Array<{ cities: NewCity[]; universities: NewUniversity[] }> = [];
    const service = new GeoSeedService({
      seedGeo: async (input: {
        cities: NewCity[];
        universities: NewUniversity[];
      }) => {
        calls.push(input);
      },
    } as never);

    await service.onModuleInit();

    // One call carrying the whole set. If this ever becomes hundreds of calls, the seed has
    // regressed to per-row awaits and every cold start pays that many round-trips to Neon.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.cities).toHaveLength(81);
    expect(calls[0]!.universities).toHaveLength(uniSeed.universities.length);
  });
});
