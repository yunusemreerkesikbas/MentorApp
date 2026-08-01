import { Injectable } from "@nestjs/common";
import { asc, desc, sql } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { cities, universities } from "../../../database/schema";

export type CityRow = typeof cities.$inferSelect;
export type NewCity = typeof cities.$inferInsert;
export type UniversityRow = typeof universities.$inferSelect;
export type NewUniversity = typeof universities.$inferInsert;

export interface UniversitySourceRow {
  source: string;
  sourceUrl: string;
  verifiedAt: Date;
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
