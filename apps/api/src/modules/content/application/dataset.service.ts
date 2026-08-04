import { Inject, Injectable } from "@nestjs/common";
import type { DatasetInfoDto, DatasetKind } from "@mentor/types";
import { NotFoundError } from "../../../common/errors/domain-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  DatasetRepository,
  type NewReferenceDataset,
  type ReferenceDatasetRow,
} from "../infrastructure/dataset.repository";

/** Which dataset each exam family publishes. A family absent here simply has no reference data. */
const KIND_BY_FAMILY: Record<string, DatasetKind | undefined> = {
  KPSS: "KPSS_POSTINGS",
  YKS: "YKS_PROGRAMS",
};

/**
 * Published editions of the reference datasets — the period picker's source of truth, and the
 * owner of the editorial note shown beside the data.
 *
 * Lives apart from `KpssService`/`GeoService` because the question ("which editions exist, which
 * one am I looking at, what does it cover") is identical for every family, while the data behind
 * each edition is not.
 */
@Injectable()
export class DatasetService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly datasets: DatasetRepository,
  ) {}

  /** Every published edition for a family, newest first. Unknown family → empty, not an error. */
  async listByFamily(
    family: string,
    locale?: string,
  ): Promise<DatasetInfoDto[]> {
    const kind = KIND_BY_FAMILY[family];
    if (!kind) return [];
    const rows = await this.datasets.listDatasets(this.db, kind);
    return rows.map((row) => toDatasetInfoDto(row, locale));
  }

  /** The edition served when no period is named. */
  async getCurrent(kind: DatasetKind): Promise<ReferenceDatasetRow | undefined> {
    return this.datasets.findCurrentDataset(this.db, kind);
  }

  /**
   * Resolves the edition a request is about.
   *
   * An unknown id is rejected rather than falling back to the current edition: a user who believes
   * they are looking at 2025/2 must not be shown 2026/1's numbers under that label, and they have
   * no way to tell the difference. Omitting the id is the supported way to ask for "current".
   */
  async resolve(
    kind: DatasetKind,
    datasetId?: string | null,
  ): Promise<ReferenceDatasetRow | undefined> {
    if (!datasetId) return this.getCurrent(kind);
    const row = await this.datasets.findDatasetById(this.db, datasetId);
    if (!row || row.kind !== kind) {
      throw new NotFoundError({ resource: "dataset" });
    }
    return row;
  }

  /**
   * Writes one edition and returns it, so a seed can attach its rows to the id it just created.
   * Runs inside the caller's transaction when given one — the KPSS seed writes the edition and its
   * 1.1k postings together, and a half-applied round is worse than none.
   */
  async upsert(
    tx: DatabaseTx,
    row: NewReferenceDataset,
  ): Promise<ReferenceDatasetRow> {
    const dataset = await this.datasets.upsertDataset(tx, row);
    if (row.isCurrent) {
      // Two statements: the partial unique index allows one current edition per kind, so the
      // previous holder is demoted before this one is promoted.
      await this.datasets.clearCurrentDataset(tx, dataset.kind, dataset.id);
      await this.datasets.markDatasetCurrent(tx, dataset.id);
    }
    return dataset;
  }

  /** Seed entry point for editions that have no rows of their own to attach (YKS, LGS). */
  async seedDatasets(rows: NewReferenceDataset[]): Promise<void> {
    if (rows.length === 0) return;
    await withServiceContext(this.db, async (tx) => {
      for (const row of rows) {
        await this.upsert(tx, row);
      }
    });
  }

  info(row: ReferenceDatasetRow, locale?: string): DatasetInfoDto {
    return toDatasetInfoDto(row, locale);
  }
}

/** Editorial text is stored per locale; `tr` is the product's default and the fallback. */
export function toDatasetInfoDto(
  row: ReferenceDatasetRow,
  locale?: string,
): DatasetInfoDto {
  return {
    id: row.id,
    examFamily: row.examFamily,
    kind: row.kind as DatasetKind,
    period: row.period,
    isCurrent: row.isCurrent,
    description:
      (locale === "en" ? row.descriptionEn : row.descriptionTr) ??
      row.descriptionTr,
    source: row.source,
    sourceUrl: row.sourceUrl,
    verifiedAt: row.verifiedAt.toISOString(),
  };
}
