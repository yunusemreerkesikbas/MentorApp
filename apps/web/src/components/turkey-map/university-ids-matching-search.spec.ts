// The repository reuses apps/api's Vitest runner; apps/web intentionally has no test dependency.
// @ts-expect-error -- resolved by the explicit @mentor/api Vitest command used for this spec.
import { describe, expect, it } from "vitest";
import type { CityDto, GeoSearchResultDto } from "@mentor/types";
import { universityIdsMatchingSearch } from "./search-pin-filter";

const cities = [
  {
    code: "42",
    name: "Konya",
    slug: "konya",
    region: "IC_ANADOLU",
    universities: [
      { id: "konya-a", name: "A", slug: "a", kind: "STATE", foundedYear: null, websiteUrl: null, latitude: 1, longitude: 1, programCount: 1 },
      { id: "konya-b", name: "B", slug: "b", kind: "STATE", foundedYear: null, websiteUrl: null, latitude: 1, longitude: 1, programCount: 1 },
    ],
  },
  {
    code: "34",
    name: "İstanbul",
    slug: "istanbul",
    region: "MARMARA",
    universities: [
      { id: "ist-a", name: "C", slug: "c", kind: "STATE", foundedYear: null, websiteUrl: null, latitude: 1, longitude: 1, programCount: 1 },
    ],
  },
] as CityDto[];

function emptyResults(over: Partial<GeoSearchResultDto> = {}): GeoSearchResultDto {
  return { cities: [], universities: [], programs: [], ...over };
}

describe("universityIdsMatchingSearch", () => {
  it("keeps every campus in a matched city", () => {
    const ids = universityIdsMatchingSearch(
      emptyResults({
        cities: [{ code: "42", name: "Konya", slug: "konya", region: "IC_ANADOLU" }],
      }),
      cities,
    );
    expect([...ids].sort()).toEqual(["konya-a", "konya-b"]);
  });

  it("unions university and program hits", () => {
    const ids = universityIdsMatchingSearch(
      emptyResults({
        universities: [
          {
            id: "ist-a",
            name: "C",
            slug: "c",
            kind: "STATE",
            foundedYear: null,
            websiteUrl: null,
            latitude: 1,
            longitude: 1,
            programCount: 1,
            cityCode: "34",
            cityName: "İstanbul",
          },
        ],
        programs: [
          {
            code: "1",
            name: "Gemi",
            faculty: "F",
            level: "LISANS",
            universityId: "konya-a",
            universityName: "A",
            cityCode: "42",
            cityName: "Konya",
          },
        ],
      }),
      cities,
    );
    expect([...ids].sort()).toEqual(["ist-a", "konya-a"]);
  });
});
