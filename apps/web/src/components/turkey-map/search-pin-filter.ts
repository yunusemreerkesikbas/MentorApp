import type { CityDto, GeoSearchResultDto } from "@mentor/types";

/**
 * University ids whose pins should stay visible while a geo search is active.
 * City hits → every campus in that province; university/program hits → those campuses only.
 */
export function universityIdsMatchingSearch(
  results: GeoSearchResultDto,
  cities: CityDto[],
): Set<string> {
  const ids = new Set<string>();
  for (const hit of results.cities) {
    const city = cities.find((c) => c.code === hit.code);
    if (!city) continue;
    for (const university of city.universities) ids.add(university.id);
  }
  for (const university of results.universities) ids.add(university.id);
  for (const program of results.programs) ids.add(program.universityId);
  return ids;
}
