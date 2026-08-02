import { Inject, Injectable } from "@nestjs/common";
import type {
  CityDto,
  GeoRegion,
  GeoResponseDto,
  ExamFamilyWithTargets,
  GeoSearchResultDto,
  ProgramDto,
  ProgramLevel,
  UniversityDto,
  UniversityKind,
  UniversityProgramsDto,
  UniversitySearchHitDto,
} from "@mentor/types";
import { NotFoundError } from "../../../common/errors/domain-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { KpssService } from "./kpss.service";
import {
  GeoRepository,
  type NewCity,
  type NewUniversity,
  type ProgramWithScoreRow,
  type UniversityRow,
  type UniversitySearchRow,
} from "../infrastructure/geo.repository";

/** Per-list cap on search results — a search box, not a paginated report. */
const SEARCH_LIMIT = {
  cities: 5,
  universities: 8,
  programs: 20,
  titles: 10,
  institutions: 10,
} as const;

/**
 * Same folding the SQL does, applied to the incoming query so both sides of the comparison
 * agree. Ordinary `toLowerCase()` is wrong here: "İ" gains a combining dot in JS.
 */
const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", I: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
  â: "a", Â: "a", î: "i", Î: "i", û: "u", Û: "u",
};

function foldTurkish(value: string): string {
  return [...value].map((ch) => TR_MAP[ch] ?? ch).join("").toLowerCase();
}

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
    private readonly kpss: KpssService,
  ) {}

  /**
   * Whole geo payload in one shot (~30KB). Deliberately not paginated and not split into a
   * per-city detail endpoint: the map hovers over provinces, and a network round-trip per hover
   * is exactly the experience this avoids.
   */
  async getGeo(): Promise<GeoResponseDto> {
    const [cityRows, universityRows, sourceRow, programCounts] =
      await Promise.all([
        this.geo.listCities(this.db),
        this.geo.listUniversities(this.db),
        this.geo.findUniversitySource(this.db),
        this.geo.countProgramsByUniversity(this.db),
      ]);

    const byCity = new Map<string, UniversityDto[]>();
    for (const row of universityRows) {
      const list = byCity.get(row.cityCode) ?? [];
      list.push(this.toUniversityDto(row, programCounts.get(row.id) ?? 0));
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
   * Reference ids → display names, for callers that hold a stored goal and need to say something
   * about it (the AI motivation note). Both lookups are independent, so they go out together.
   */
  async resolveNames(
    cityCode: string | null,
    universityId: string | null,
  ): Promise<{ cityName: string | null; universityName: string | null }> {
    const [city, university] = await Promise.all([
      cityCode ? this.geo.findCityByCode(this.db, cityCode) : undefined,
      universityId ? this.geo.findUniversityById(this.db, universityId) : undefined,
    ]);
    return {
      cityName: city?.name ?? null,
      universityName: university?.name ?? null,
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

  /**
   * Everything one university offers, fetched when a pin or list row is opened.
   *
   * The join returns one row per (program, year); they are folded back into a program with a
   * `scores` array here rather than issuing a second query per program.
   */
  async getUniversityPrograms(
    universityId: string,
  ): Promise<UniversityProgramsDto> {
    const [university, source] = await Promise.all([
      this.geo.findUniversityById(this.db, universityId),
      this.geo.findUniversitySource(this.db),
    ]);
    if (!university) throw new NotFoundError({ resource: "university" });

    const rows = await this.geo.listProgramsByUniversity(this.db, universityId);

    const byCode = new Map<string, ProgramDto>();
    for (const row of rows) {
      let program = byCode.get(row.code);
      if (!program) {
        program = this.toProgramDto(row);
        byCode.set(row.code, program);
      }
      if (row.scoreYear != null) {
        program.scores.push({
          year: row.scoreYear,
          minScore: row.minScore == null ? null : Number(row.minScore),
          successRank: row.successRank,
        });
      }
    }

    const programs = [...byCode.values()];
    return {
      university: this.toUniversityDto(university, programs.length),
      programs,
      source: source
        ? {
            source: source.source,
            sourceUrl: source.sourceUrl,
            verifiedAt: source.verifiedAt.toISOString(),
          }
        : null,
    };
  }

  /**
   * One box, three result kinds. Kept as three capped queries instead of a UNION: the lists are
   * rendered separately anyway, and a shared ranking across cities/universities/programs would
   * have to invent a relevance scale none of them share.
   */
  async search(
    query: string,
    family: ExamFamilyWithTargets = "YKS",
  ): Promise<GeoSearchResultDto> {
    const needle = foldTurkish(query.trim());
    const empty: GeoSearchResultDto = {
      cities: [],
      universities: [],
      programs: [],
      titles: [],
      institutions: [],
    };
    if (needle.length < 2) return empty;

    const cityRows = await this.geo.searchCities(
      this.db,
      needle,
      SEARCH_LIMIT.cities,
    );
    const cities = cityRows.map((c) => ({
      code: c.code,
      name: c.name,
      slug: c.slug,
      region: c.region as GeoRegion,
    }));

    // A KPSS student has no use for university programs; surfacing them was the leak this closes.
    if (family === "KPSS") {
      const { titles, institutions } = await this.kpss.search(needle, {
        titles: SEARCH_LIMIT.titles,
        institutions: SEARCH_LIMIT.institutions,
      });
      return { ...empty, cities, titles, institutions };
    }

    const [universityRows, programRows] = await Promise.all([
      this.geo.searchUniversities(this.db, needle, SEARCH_LIMIT.universities),
      this.geo.searchPrograms(this.db, needle, SEARCH_LIMIT.programs),
    ]);

    const counts = universityRows.length
      ? await this.geo.countProgramsByUniversity(this.db)
      : new Map<string, number>();

    return {
      ...empty,
      cities,
      universities: universityRows.map((u) =>
        this.toUniversitySearchHit(u, counts.get(u.id) ?? 0),
      ),
      programs: programRows.map((p) => ({
        code: p.code,
        name: p.name,
        faculty: p.faculty,
        level: p.level as ProgramLevel,
        universityId: p.universityId,
        universityName: p.universityName,
        cityCode: p.cityCode,
        cityName: p.cityName,
      })),
    };
  }

  private toUniversitySearchHit(
    row: UniversitySearchRow,
    programCount: number,
  ): UniversitySearchHitDto {
    return {
      ...this.toUniversityDto(row, programCount),
      cityCode: row.cityCode,
      cityName: row.cityName,
    };
  }

  private toUniversityDto(row: UniversityRow, programCount: number): UniversityDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      kind: row.kind as UniversityKind,
      foundedYear: row.foundedYear,
      websiteUrl: row.websiteUrl,
      // Drizzle returns `numeric` as a string to protect precision; the map needs numbers, and
      // six decimal places of latitude sit well inside what a double represents exactly.
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      programCount,
    };
  }

  private toProgramDto(row: ProgramWithScoreRow): ProgramDto {
    return {
      code: row.code,
      faculty: row.faculty,
      name: row.name,
      level: row.level as ProgramLevel,
      durationYears: row.durationYears,
      scoreType: row.scoreType,
      quota: row.quota,
      guideYear: row.guideYear,
      scores: [],
    };
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
