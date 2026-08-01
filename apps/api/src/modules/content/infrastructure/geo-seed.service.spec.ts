import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GEO_REGIONS } from "@mentor/types";
import { GeoSeedService } from "./geo-seed.service";
import type { NewCity, NewUniversity } from "./geo.repository";

interface CitySeedFile {
  cities: Array<{ code: string; name: string; slug: string; region: string }>;
}

const seed = JSON.parse(
  readFileSync(resolve(__dirname, "../seed/cities.seed.json"), "utf8"),
) as CitySeedFile;

describe("cities seed file", () => {
  it("covers all 81 provinces with contiguous plate codes 01–81", () => {
    const expected = Array.from({ length: 81 }, (_, i) =>
      String(i + 1).padStart(2, "0"),
    );
    expect(seed.cities.map((c) => c.code)).toEqual(expected);
  });

  it("has unique ASCII slugs — the map build script joins GeoJSON features on them", () => {
    const slugs = seed.cities.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(81);
    expect(slugs.filter((s) => !/^[a-z]+$/.test(s))).toEqual([]);
  });

  it("assigns every province to one of the seven regions", () => {
    const invalid = seed.cities.filter(
      (c) => !(GEO_REGIONS as readonly string[]).includes(c.region),
    );
    expect(invalid).toEqual([]);
  });
});

describe("GeoSeedService", () => {
  it("seeds all 81 provinces in a SINGLE call — one batched statement, not one per row", async () => {
    const calls: Array<{ cities: NewCity[]; universities: NewUniversity[] }> = [];
    const service = new GeoSeedService({
      seedGeo: async (input: { cities: NewCity[]; universities: NewUniversity[] }) => {
        calls.push(input);
      },
    } as never);

    await service.onModuleInit();

    // One call carrying the whole set. If this ever becomes 81 calls, the seed has regressed to
    // per-row awaits and every cold start pays ~81 extra round-trips to Neon.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.cities).toHaveLength(81);
  });

  it("tolerates an empty university dataset — cities alone keep the map usable", async () => {
    let received: NewUniversity[] | undefined;
    const service = new GeoSeedService({
      seedGeo: async (input: { universities: NewUniversity[] }) => {
        received = input.universities;
      },
    } as never);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(received).toEqual([]);
  });
});
