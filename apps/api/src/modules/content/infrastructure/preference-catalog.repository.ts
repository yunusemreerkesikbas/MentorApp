import { Injectable } from "@nestjs/common";
import { and, asc, count, eq, inArray, or, sql } from "drizzle-orm";
import type { Database } from "../../../database/drizzle";
import {
  campusExperiences,
  campusPois,
  cities,
  programCatalogDatasets,
  programScores,
  programs,
  universities,
} from "../../../database/schema";
import { foldTurkish } from "./turkish-sql";

export type ProgramCatalogDatasetRow =
  typeof programCatalogDatasets.$inferSelect;

export interface ProgramCatalogRow {
  code: string;
  name: string;
  faculty: string;
  level: string;
  scoreType: string;
  quota: number;
  guideYear: number;
  placementYear: number;
  successRank: number | null;
  universityId: string;
  universityName: string;
  cityCode: string;
  cityName: string;
  source: string;
  sourceUrl: string;
  verifiedAt: Date;
}

export interface CampusExperienceRow {
  experience: typeof campusExperiences.$inferSelect;
  universityName: string;
  pois: Array<typeof campusPois.$inferSelect>;
}

@Injectable()
export class PreferenceCatalogRepository {
  findActiveDataset(
    db: Database,
  ): Promise<ProgramCatalogDatasetRow | undefined> {
    return db
      .select()
      .from(programCatalogDatasets)
      .where(
        and(
          eq(programCatalogDatasets.examType, "YKS"),
          eq(programCatalogDatasets.isActive, true),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);
  }

  async searchPrograms(
    db: Database,
    dataset: ProgramCatalogDatasetRow,
    query: string,
    scoreType: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ rows: ProgramCatalogRow[]; total: number }> {
    const needle = `%${query}%`;
    const textMatch = or(
      sql`${foldTurkish(programs.name)} LIKE ${needle}`,
      sql`${foldTurkish(programs.faculty)} LIKE ${needle}`,
      sql`${foldTurkish(universities.name)} LIKE ${needle}`,
    );
    const where = and(
      eq(programs.guideYear, dataset.guideYear),
      scoreType ? eq(programs.scoreType, scoreType) : undefined,
      textMatch,
    );

    const baseSelection = {
      code: programs.code,
      name: programs.name,
      faculty: programs.faculty,
      level: programs.level,
      scoreType: programs.scoreType,
      quota: programs.quota,
      guideYear: programs.guideYear,
      placementYear: sql<number>`${dataset.placementYear}::int`,
      successRank: programScores.successRank,
      universityId: universities.id,
      universityName: universities.name,
      cityCode: cities.code,
      cityName: cities.name,
      source: programs.source,
      sourceUrl: programs.sourceUrl,
      verifiedAt: programs.verifiedAt,
    };

    const [rows, totals] = await Promise.all([
      db
        .select(baseSelection)
        .from(programs)
        .innerJoin(universities, eq(universities.id, programs.universityId))
        .innerJoin(cities, eq(cities.code, universities.cityCode))
        .leftJoin(
          programScores,
          and(
            eq(programScores.programCode, programs.code),
            eq(programScores.scoreYear, dataset.placementYear),
          ),
        )
        .where(where)
        .orderBy(asc(programs.name), asc(universities.name))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ value: count() })
        .from(programs)
        .innerJoin(universities, eq(universities.id, programs.universityId))
        .where(where),
    ]);

    return { rows, total: totals[0]?.value ?? 0 };
  }

  async findProgramsByCodes(
    db: Database,
    dataset: ProgramCatalogDatasetRow,
    codes: string[],
  ): Promise<ProgramCatalogRow[]> {
    if (codes.length === 0) return [];
    return db
      .select({
        code: programs.code,
        name: programs.name,
        faculty: programs.faculty,
        level: programs.level,
        scoreType: programs.scoreType,
        quota: programs.quota,
        guideYear: programs.guideYear,
        placementYear: sql<number>`${dataset.placementYear}::int`,
        successRank: programScores.successRank,
        universityId: universities.id,
        universityName: universities.name,
        cityCode: cities.code,
        cityName: cities.name,
        source: programs.source,
        sourceUrl: programs.sourceUrl,
        verifiedAt: programs.verifiedAt,
      })
      .from(programs)
      .innerJoin(universities, eq(universities.id, programs.universityId))
      .innerJoin(cities, eq(cities.code, universities.cityCode))
      .leftJoin(
        programScores,
        and(
          eq(programScores.programCode, programs.code),
          eq(programScores.scoreYear, dataset.placementYear),
        ),
      )
      .where(
        and(
          eq(programs.guideYear, dataset.guideYear),
          inArray(programs.code, codes),
        ),
      );
  }

  async findCampusExperience(
    db: Database,
    universityId: string,
  ): Promise<CampusExperienceRow | undefined> {
    const rows = await db
      .select({
        experience: campusExperiences,
        universityName: universities.name,
      })
      .from(campusExperiences)
      .innerJoin(universities, eq(universities.id, campusExperiences.universityId))
      .where(
        and(
          eq(campusExperiences.universityId, universityId),
          eq(campusExperiences.isEnabled, true),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;

    const pois = await db
      .select()
      .from(campusPois)
      .where(eq(campusPois.campusExperienceId, row.experience.id))
      .orderBy(asc(campusPois.position));
    return { ...row, pois };
  }
}
