import { Injectable } from "@nestjs/common";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { referenceDatasets } from "../../../database/schema";

export type ReferenceDatasetRow = typeof referenceDatasets.$inferSelect;
export type NewReferenceDataset = typeof referenceDatasets.$inferInsert;

/**
 * Published editions of reference datasets — KPSS placement rounds, YKS guide years.
 *
 * Deliberately not part of `KpssRepository`: every family that ships reference data needs the same
 * "which editions exist, which is current" questions answered, and leaving generic dataset access
 * inside a file titled "KPSS reference tables" is how the YKS caller would end up duplicating it.
 */
@Injectable()
export class DatasetRepository {
  /**
   * Every published edition of one dataset, newest first.
   *
   * Ordered by `sortKey`, not `period`: the old `ORDER BY round DESC` compared text, so a
   * hypothetical "2026-10" would have sorted behind "2026-2" and the wrong round become default.
   */
  async listDatasets(
    db: Database | DatabaseTx,
    kind: string,
  ): Promise<ReferenceDatasetRow[]> {
    return db
      .select()
      .from(referenceDatasets)
      .where(eq(referenceDatasets.kind, kind))
      .orderBy(desc(referenceDatasets.sortKey));
  }

  /** The edition served when the caller does not name one. */
  async findCurrentDataset(
    db: Database | DatabaseTx,
    kind: string,
  ): Promise<ReferenceDatasetRow | undefined> {
    const rows = await db
      .select()
      .from(referenceDatasets)
      .where(
        and(
          eq(referenceDatasets.kind, kind),
          eq(referenceDatasets.isCurrent, true),
        ),
      )
      .limit(1);
    // Falls back to the newest edition: a seed that forgot the flag should not blank the map.
    if (rows[0]) return rows[0];
    const newest = await db
      .select()
      .from(referenceDatasets)
      .where(eq(referenceDatasets.kind, kind))
      .orderBy(desc(referenceDatasets.sortKey))
      .limit(1);
    return newest[0];
  }

  async findDatasetById(
    db: Database | DatabaseTx,
    id: string,
  ): Promise<ReferenceDatasetRow | undefined> {
    const rows = await db
      .select()
      .from(referenceDatasets)
      .where(eq(referenceDatasets.id, id))
      .limit(1);
    return rows[0];
  }

  /**
   * Upserts one edition and returns it, so the seed can attach postings to the id it just wrote.
   * `isCurrent` is set by the caller, which clears the previous holder first — the partial unique
   * index would otherwise reject two current editions of the same kind.
   */
  async upsertDataset(
    tx: DatabaseTx,
    row: NewReferenceDataset,
  ): Promise<ReferenceDatasetRow> {
    const rows = await tx
      .insert(referenceDatasets)
      .values(row)
      .onConflictDoUpdate({
        target: [referenceDatasets.kind, referenceDatasets.period],
        set: {
          examFamily: sql`excluded.exam_family`,
          sortKey: sql`excluded.sort_key`,
          descriptionTr: sql`excluded.description_tr`,
          descriptionEn: sql`excluded.description_en`,
          source: sql`excluded.source`,
          sourceUrl: sql`excluded.source_url`,
          verifiedAt: sql`excluded.verified_at`,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return rows[0]!;
  }

  /** Demotes every other edition of a kind before one is promoted. */
  async clearCurrentDataset(
    tx: DatabaseTx,
    kind: string,
    keepId: string,
  ): Promise<void> {
    await tx
      .update(referenceDatasets)
      .set({ isCurrent: false, updatedAt: sql`now()` })
      .where(
        and(
          eq(referenceDatasets.kind, kind),
          eq(referenceDatasets.isCurrent, true),
          ne(referenceDatasets.id, keepId),
        ),
      );
  }

  async markDatasetCurrent(tx: DatabaseTx, id: string): Promise<void> {
    await tx
      .update(referenceDatasets)
      .set({ isCurrent: true, updatedAt: sql`now()` })
      .where(eq(referenceDatasets.id, id));
  }
}
