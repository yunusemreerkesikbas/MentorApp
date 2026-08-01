import { Injectable } from "@nestjs/common";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import {
  cities,
  programScores,
  programs,
  universities,
} from "../../../database/schema";

/**
 * Diacritic-insensitive comparison for Turkish text.
 *
 * Turkish users routinely type ASCII ("bilgisayar muhendisligi"), which a plain ILIKE never
 * matches against "Bilgisayar Mühendisliği". `translate` runs before `lower` on purpose:
 * `lower('İ')` yields "i" plus a combining dot in Postgres, which would defeat the mapping.
 *
 * No index and no pg_trgm: a sequential scan over the ~21.5k programs measures ~2.5 ms. Revisit
 * only if that stops being true.
 */
const TR_FROM = "çÇğĞıIİöÖşŞüÜâÂîÎûÛ";
const TR_TO = "ccggiiioossuuaaiiuu";
const foldTurkish = (column: unknown) =>
  sql`lower(translate(${column}, ${TR_FROM}, ${TR_TO}))`;

export type CityRow = typeof cities.$inferSelect;
export type NewCity = typeof cities.$inferInsert;
export type UniversityRow = typeof universities.$inferSelect;
export type NewUniversity = typeof universities.$inferInsert;

export interface UniversitySourceRow {
  source: string;
  sourceUrl: string;
  verifiedAt: Date;
}

/** One row per (program, year); a program with no recorded year still returns one row of nulls. */
export interface ProgramWithScoreRow {
  code: string;
  faculty: string;
  name: string;
  level: string;
  durationYears: number;
  scoreType: string;
  quota: number;
  guideYear: number;
  scoreYear: number | null;
  minScore: string | null;
  successRank: number | null;
}

export interface ProgramSearchRow {
  code: string;
  name: string;
  faculty: string;
  level: string;
  universityId: string;
  universityName: string;
  cityCode: string;
  cityName: string;
}

/**
 * Data access for the `cities` / `universities` geo reference tables.
 *
 * Both upserts are BATCH — a single statement for the whole set, not one per row. The seed runs on
 * every boot, and ~289 sequential round-trips to Neon would show up as real cold-start latency.
 * Batch upserts need `excluded.*` rather than a captured value, since one statement covers all rows.
 */
@Injectable()
export class GeoRepository {
  async upsertCities(tx: DatabaseTx, rows: NewCity[]): Promise<void> {
    if (rows.length === 0) return;
    await tx
      .insert(cities)
      .values(rows)
      .onConflictDoUpdate({
        target: cities.code,
        set: {
          name: sql`excluded.name`,
          slug: sql`excluded.slug`,
          region: sql`excluded.region`,
          updatedAt: sql`now()`,
        },
      });
  }

  /**
   * Upserts on `slug`, so an existing university keeps its `id` across re-seeds — otherwise every
   * boot would orphan the `vision_boards.target_university_id` rows pointing at it.
   */
  async upsertUniversities(tx: DatabaseTx, rows: NewUniversity[]): Promise<void> {
    if (rows.length === 0) return;
    await tx
      .insert(universities)
      .values(rows)
      .onConflictDoUpdate({
        target: universities.slug,
        set: {
          cityCode: sql`excluded.city_code`,
          name: sql`excluded.name`,
          kind: sql`excluded.kind`,
          foundedYear: sql`excluded.founded_year`,
          websiteUrl: sql`excluded.website_url`,
          latitude: sql`excluded.latitude`,
          longitude: sql`excluded.longitude`,
          source: sql`excluded.source`,
          sourceUrl: sql`excluded.source_url`,
          verifiedAt: sql`excluded.verified_at`,
          updatedAt: sql`now()`,
        },
      });
  }

  async listCities(db: Database | DatabaseTx): Promise<CityRow[]> {
    return db.select().from(cities).orderBy(asc(cities.code));
  }

  async listUniversities(db: Database | DatabaseTx): Promise<UniversityRow[]> {
    return db.select().from(universities).orderBy(asc(universities.name));
  }

  /** Program count per university id — one grouped query, not one per university. */
  async countProgramsByUniversity(
    db: Database | DatabaseTx,
  ): Promise<Map<string, number>> {
    const rows = await db
      .select({
        universityId: programs.universityId,
        count: sql<number>`count(*)::int`,
      })
      .from(programs)
      .groupBy(programs.universityId);
    return new Map(rows.map((r) => [r.universityId, r.count]));
  }

  /**
   * Every program of one university with all its recorded years, newest first.
   * Loaded on demand (a map pin click), never as part of the country-wide payload.
   */
  async listProgramsByUniversity(
    db: Database | DatabaseTx,
    universityId: string,
  ): Promise<ProgramWithScoreRow[]> {
    return db
      .select({
        code: programs.code,
        faculty: programs.faculty,
        name: programs.name,
        level: programs.level,
        durationYears: programs.durationYears,
        scoreType: programs.scoreType,
        quota: programs.quota,
        guideYear: programs.guideYear,
        scoreYear: programScores.scoreYear,
        minScore: programScores.minScore,
        successRank: programScores.successRank,
      })
      .from(programs)
      .leftJoin(programScores, eq(programScores.programCode, programs.code))
      .where(eq(programs.universityId, universityId))
      .orderBy(
        asc(programs.faculty),
        asc(programs.name),
        desc(programScores.scoreYear),
      );
  }

  async searchCities(
    db: Database | DatabaseTx,
    needle: string,
    limit: number,
  ): Promise<CityRow[]> {
    return db
      .select()
      .from(cities)
      .where(sql`${foldTurkish(cities.name)} LIKE ${`%${needle}%`}`)
      .orderBy(asc(cities.name))
      .limit(limit);
  }

  async searchUniversities(
    db: Database | DatabaseTx,
    needle: string,
    limit: number,
  ): Promise<UniversityRow[]> {
    return db
      .select()
      .from(universities)
      .where(sql`${foldTurkish(universities.name)} LIKE ${`%${needle}%`}`)
      .orderBy(asc(universities.name))
      .limit(limit);
  }

  async searchPrograms(
    db: Database | DatabaseTx,
    needle: string,
    limit: number,
  ): Promise<ProgramSearchRow[]> {
    return db
      .select({
        code: programs.code,
        name: programs.name,
        faculty: programs.faculty,
        level: programs.level,
        universityId: universities.id,
        universityName: universities.name,
        cityCode: cities.code,
        cityName: cities.name,
      })
      .from(programs)
      .innerJoin(universities, eq(universities.id, programs.universityId))
      .innerJoin(cities, eq(cities.code, universities.cityCode))
      .where(sql`${foldTurkish(programs.name)} LIKE ${`%${needle}%`}`)
      .orderBy(asc(programs.name), asc(universities.name))
      .limit(limit);
  }

  async findUniversityById(
    db: Database | DatabaseTx,
    id: string,
  ): Promise<UniversityRow | undefined> {
    const rows = await db
      .select()
      .from(universities)
      .where(eq(universities.id, id))
      .limit(1);
    return rows[0];
  }

  /** Most recently verified import — the single "source + last verified" badge shown in the UI. */
  async findUniversitySource(
    db: Database | DatabaseTx,
  ): Promise<UniversitySourceRow | undefined> {
    const rows = await db
      .select({
        source: universities.source,
        sourceUrl: universities.sourceUrl,
        verifiedAt: universities.verifiedAt,
      })
      .from(universities)
      .orderBy(desc(universities.verifiedAt))
      .limit(1);
    return rows[0];
  }

  /** True when a university exists with this id AND it sits in the given city. */
  async existsInCity(
    db: Database | DatabaseTx,
    universityId: string,
    cityCode: string,
  ): Promise<boolean> {
    const rows = await db
      .select({ id: universities.id })
      .from(universities)
      .where(
        sql`${universities.id} = ${universityId} AND ${universities.cityCode} = ${cityCode}`,
      )
      .limit(1);
    return rows.length > 0;
  }
}
