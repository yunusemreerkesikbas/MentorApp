import { Inject, Injectable } from "@nestjs/common";
import type {
  CityDto,
  GeoRegion,
  GeoResponseDto,
  UniversityDto,
  UniversityKind,
} from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  GeoRepository,
  type NewCity,
  type NewUniversity,
} from "../infrastructure/geo.repository";

/**
 * Geo reference data (provinces + universities) behind the panel's goal map.
 *
 * Lives apart from `ContentService` on purpose: that file is already over a thousand lines and this
 * is an unrelated concern with its own two tables.
 *
 * No in-memory cache here — the response is served with a long `Cache-Control` and Next revalidates
 * on its side. A service-level cache would add invalidation logic for a gain nobody has measured.
 */
@Injectable()
export class GeoService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly geo: GeoRepository,
  ) {}

  /**
   * Whole geo payload in one shot (~30KB). Deliberately not paginated and not split into a
   * per-city detail endpoint: the map hovers over provinces, and a network round-trip per hover
   * is exactly the experience this avoids.
   */
  async getGeo(): Promise<GeoResponseDto> {
    const [cityRows, universityRows, sourceRow] = await Promise.all([
      this.geo.listCities(this.db),
      this.geo.listUniversities(this.db),
      this.geo.findUniversitySource(this.db),
    ]);

    const byCity = new Map<string, UniversityDto[]>();
    for (const row of universityRows) {
      const list = byCity.get(row.cityCode) ?? [];
      list.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        kind: row.kind as UniversityKind,
        foundedYear: row.foundedYear,
        websiteUrl: row.websiteUrl,
      });
      byCity.set(row.cityCode, list);
    }

    const cities: CityDto[] = cityRows.map((row) => ({
      code: row.code,
      name: row.name,
      slug: row.slug,
      region: row.region as GeoRegion,
      universities: byCity.get(row.code) ?? [],
    }));

    return {
      cities,
      universitySource: sourceRow
        ? {
            source: sourceRow.source,
            sourceUrl: sourceRow.sourceUrl,
            verifiedAt: sourceRow.verifiedAt.toISOString(),
          }
        : null,
    };
  }

  /**
   * Guards the `vision_boards.target_university_id` write. The client picks the university from the
   * map, but nothing stops it from posting a valid university id with someone else's city code —
   * so the pair is re-checked server-side before it is stored.
   */
  async universityExistsInCity(
    universityId: string,
    cityCode: string,
  ): Promise<boolean> {
    return this.geo.existsInCity(this.db, universityId, cityCode);
  }

  /** Seed entry point — one batched statement per table inside a single SERVICE-context tx. */
  async seedGeo(input: {
    cities: NewCity[];
    universities: NewUniversity[];
  }): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await this.geo.upsertCities(tx, input.cities);
      await this.geo.upsertUniversities(tx, input.universities);
    });
  }
}
