import { Injectable } from "@nestjs/common";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import {
  cities,
  institutions,
  kpssPostings,
  titles,
} from "../../../database/schema";
import { foldTurkish } from "./turkish-sql";

export type TitleRow = typeof titles.$inferSelect;
export type NewTitle = typeof titles.$inferInsert;
export type InstitutionRow = typeof institutions.$inferSelect;
export type NewInstitution = typeof institutions.$inferInsert;
export type NewPosting = typeof kpssPostings.$inferInsert;

export interface CityPostingCountRow {
  cityCode: string;
  postings: number;
  quota: number;
}

export interface PostingRow {
  osymCode: string;
  round: string;
  educationLevel: string;
  titleName: string;
  institutionName: string;
  cityCode: string;
  district: string | null;
  employmentType: string;
  serviceClass: string | null;
  quota: number;
}

/**
 * Data access for the KPSS reference tables.
 *
 * Same batch-upsert discipline as the geo tables: one statement per table, `excluded.*` because a
 * single statement covers every row. The seed runs on boot, and ~1.2k sequential round-trips would
 * be a visible cold start.
 */
@Injectable()
export class KpssRepository {
  async upsertTitles(tx: DatabaseTx, rows: NewTitle[]): Promise<void> {
    if (rows.length === 0) return;
    await tx
      .insert(titles)
      .values(rows)
      .onConflictDoUpdate({
        target: titles.slug,
        set: {
          name: sql`excluded.name`,
          source: sql`excluded.source`,
          sourceUrl: sql`excluded.source_url`,
          verifiedAt: sql`excluded.verified_at`,
          updatedAt: sql`now()`,
        },
      });
  }

  async upsertInstitutions(tx: DatabaseTx, rows: NewInstitution[]): Promise<void> {
    if (rows.length === 0) return;
    await tx
      .insert(institutions)
      .values(rows)
      .onConflictDoUpdate({
        target: institutions.slug,
        set: {
          name: sql`excluded.name`,
          source: sql`excluded.source`,
          sourceUrl: sql`excluded.source_url`,
          verifiedAt: sql`excluded.verified_at`,
          updatedAt: sql`now()`,
        },
      });
  }

  async upsertPostings(tx: DatabaseTx, rows: NewPosting[]): Promise<void> {
    if (rows.length === 0) return;
    await tx
      .insert(kpssPostings)
      .values(rows)
      .onConflictDoUpdate({
        target: kpssPostings.osymCode,
        set: {
          round: sql`excluded.round`,
          educationLevel: sql`excluded.education_level`,
          institutionId: sql`excluded.institution_id`,
          titleId: sql`excluded.title_id`,
          cityCode: sql`excluded.city_code`,
          district: sql`excluded.district`,
          employmentType: sql`excluded.employment_type`,
          serviceClass: sql`excluded.service_class`,
          grade: sql`excluded.grade`,
          quota: sql`excluded.quota`,
          source: sql`excluded.source`,
          sourceUrl: sql`excluded.source_url`,
          verifiedAt: sql`excluded.verified_at`,
          updatedAt: sql`now()`,
        },
      });
  }

  async listTitles(db: Database | DatabaseTx): Promise<TitleRow[]> {
    return db.select().from(titles).orderBy(asc(titles.name));
  }

  async listInstitutions(db: Database | DatabaseTx): Promise<InstitutionRow[]> {
    return db.select().from(institutions).orderBy(asc(institutions.name));
  }

  /** Per-province totals — what the map draws instead of 1.1k individual pins. */
  async countPostingsByCity(
    db: Database | DatabaseTx,
  ): Promise<CityPostingCountRow[]> {
    return db
      .select({
        cityCode: kpssPostings.cityCode,
        postings: sql<number>`count(*)::int`,
        quota: sql<number>`coalesce(sum(${kpssPostings.quota}), 0)::int`,
      })
      .from(kpssPostings)
      .groupBy(kpssPostings.cityCode);
  }

  /** Everything advertised in one province, for the sidebar list. */
  async listPostingsByCity(
    db: Database | DatabaseTx,
    cityCode: string,
  ): Promise<PostingRow[]> {
    return db
      .select({
        osymCode: kpssPostings.osymCode,
        round: kpssPostings.round,
        educationLevel: kpssPostings.educationLevel,
        titleName: titles.name,
        institutionName: institutions.name,
        cityCode: kpssPostings.cityCode,
        district: kpssPostings.district,
        employmentType: kpssPostings.employmentType,
        serviceClass: kpssPostings.serviceClass,
        quota: kpssPostings.quota,
      })
      .from(kpssPostings)
      .innerJoin(titles, eq(titles.id, kpssPostings.titleId))
      .innerJoin(institutions, eq(institutions.id, kpssPostings.institutionId))
      .where(eq(kpssPostings.cityCode, cityCode))
      .orderBy(asc(titles.name), asc(institutions.name));
  }

  /** Newest round present in the table — shown next to every count so nothing looks timeless. */
  async findLatestRound(
    db: Database | DatabaseTx,
  ): Promise<{ round: string; source: string; sourceUrl: string; verifiedAt: Date } | undefined> {
    const rows = await db
      .select({
        round: kpssPostings.round,
        source: kpssPostings.source,
        sourceUrl: kpssPostings.sourceUrl,
        verifiedAt: kpssPostings.verifiedAt,
      })
      .from(kpssPostings)
      .orderBy(desc(kpssPostings.round))
      .limit(1);
    return rows[0];
  }

  async searchTitles(
    db: Database | DatabaseTx,
    needle: string,
    limit: number,
  ): Promise<TitleRow[]> {
    return db
      .select()
      .from(titles)
      .where(sql`${foldTurkish(titles.name)} LIKE ${`%${needle}%`}`)
      .orderBy(asc(titles.name))
      .limit(limit);
  }

  async searchInstitutions(
    db: Database | DatabaseTx,
    needle: string,
    limit: number,
  ): Promise<InstitutionRow[]> {
    return db
      .select()
      .from(institutions)
      .where(sql`${foldTurkish(institutions.name)} LIKE ${`%${needle}%`}`)
      .orderBy(asc(institutions.name))
      .limit(limit);
  }

  /** Resolves a stored goal's ids to names, for the AI note and the sidebar summary. */
  async findTitleById(
    db: Database | DatabaseTx,
    id: string,
  ): Promise<TitleRow | undefined> {
    const rows = await db.select().from(titles).where(eq(titles.id, id)).limit(1);
    return rows[0];
  }

  async findInstitutionById(
    db: Database | DatabaseTx,
    id: string,
  ): Promise<InstitutionRow | undefined> {
    const rows = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, id))
      .limit(1);
    return rows[0];
  }

  /** City names for the KPSS search branch — the geo repo owns the same table for YKS. */
  async searchCities(db: Database | DatabaseTx, needle: string, limit: number) {
    return db
      .select()
      .from(cities)
      .where(sql`${foldTurkish(cities.name)} LIKE ${`%${needle}%`}`)
      .orderBy(asc(cities.name))
      .limit(limit);
  }
}
