import { Inject, Injectable } from "@nestjs/common";
import type {
  CityPostingCountDto,
  DatasetInfoDto,
  DatasetKind,
  InstitutionDto,
  KpssPostingDto,
  KpssTargetsDto,
  TitleDto,
} from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import type {
  NewReferenceDataset,
  ReferenceDatasetRow,
} from "../infrastructure/dataset.repository";
import {
  KpssRepository,
  type InstitutionRow,
  type NewInstitution,
  type NewPosting,
  type NewTitle,
  type TitleRow,
} from "../infrastructure/kpss.repository";
import { DatasetService } from "./dataset.service";
import { foldTurkishText } from "../infrastructure/turkish-sql";

const KPSS_POSTINGS = "KPSS_POSTINGS" as const;

/**
 * KPSS reference data — civil-service titles, the institutions that posted, and this round's
 * vacancies.
 *
 * Kept apart from `GeoService`: universities and public-sector jobs share only the province table,
 * and that file is already carrying geo plus 21.5k programs plus search.
 *
 * Everything here is round-scoped and says so. `titles` is the one list stable enough to anchor a
 * goal; `institutions` is whoever advertised in the imported rounds, so the API always ships the
 * round alongside it and the UI never presents it as a complete catalogue.
 */
@Injectable()
export class KpssService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly kpss: KpssRepository,
    private readonly datasets: DatasetService,
  ) {}

  /**
   * Everything the KPSS goal screen needs in one read (~130 rows of reference data plus 81 city
   * counts). Postings themselves are NOT included — 1.1k rows nobody has asked for yet; they load
   * per province when a city is opened.
   */
  async getTargets(
    educationLevel?: string | null,
    datasetId?: string | null,
    locale?: string,
  ): Promise<KpssTargetsDto> {
    const dataset = await this.resolveDataset(datasetId);
    const [titleRows, institutionRows, counts] = await Promise.all([
      this.kpss.listTitles(this.db),
      this.kpss.listInstitutions(this.db),
      // Only the counts narrow by level and period. Titles and institutions stay whole: a goal is
      // a career, and a candidate may well target a title this guide does not advertise for them.
      dataset
        ? this.kpss.countPostingsByCity(this.db, dataset.id, {
            educationLevel: educationLevel || undefined,
          })
        : Promise.resolve([]),
    ]);

    return {
      titles: titleRows.map(toTitleDto),
      institutions: institutionRows.map(toInstitutionDto),
      cityPostings: counts.map((c) => ({
        cityCode: c.cityCode,
        postings: c.postings,
        quota: c.quota,
      })),
      dataset: dataset ? this.datasets.info(dataset, locale) : null,
      round: dataset?.period ?? null,
      source: dataset
        ? {
            source: dataset.source,
            sourceUrl: dataset.sourceUrl,
            verifiedAt: dataset.verifiedAt.toISOString(),
          }
        : null,
    };
  }

  /** Which round a request is about; `DatasetService` owns the resolution rules. */
  private resolveDataset(
    datasetId?: string | null,
  ): Promise<ReferenceDatasetRow | undefined> {
    return this.datasets.resolve(KPSS_POSTINGS, datasetId);
  }

  /**
   * Per-province vacancy counts, optionally narrowed to one title or to a search term.
   *
   * This is the KPSS answer to YKS pin filtering: typing "mühendis" there hides campuses with no
   * matching programme, and here it hides provinces with no matching vacancy. A term shorter than
   * the search minimum is treated as no filter, so the map never blanks out mid-keystroke.
   *
   * `titleId` wins over `q`: once a goal is set, the map answers "where is my title hired?" and a
   * half-typed word in the box must not override that.
   */
  async getCityCounts(
    query?: string,
    titleId?: string,
    educationLevel?: string | null,
    datasetId?: string | null,
  ): Promise<CityPostingCountDto[]> {
    const dataset = await this.resolveDataset(datasetId);
    if (!dataset) return [];
    const needle = foldTurkishText((query ?? "").trim());
    const rows = await this.kpss.countPostingsByCity(this.db, dataset.id, {
      titleId: titleId || undefined,
      needle: needle.length >= 2 ? needle : undefined,
      educationLevel: educationLevel || undefined,
    });
    return rows.map((c) => ({
      cityCode: c.cityCode,
      postings: c.postings,
      quota: c.quota,
    }));
  }

  async getCityPostings(
    cityCode: string,
    educationLevel?: string | null,
    datasetId?: string | null,
  ): Promise<KpssPostingDto[]> {
    const dataset = await this.resolveDataset(datasetId);
    if (!dataset) return [];
    const rows = await this.kpss.listPostingsByCity(
      this.db,
      dataset.id,
      cityCode,
      educationLevel || undefined,
    );
    return rows.map((r) => ({
      osymCode: r.osymCode,
      // The round lives on the dataset now, not repeated on every posting row.
      round: dataset.period,
      educationLevel: r.educationLevel,
      titleName: r.titleName,
      institutionName: r.institutionName,
      cityCode: r.cityCode,
      district: r.district,
      employmentType: r.employmentType,
      serviceClass: r.serviceClass,
      quota: r.quota,
    }));
  }

  /** KPSS half of the one search box: titles and institutions. */
  async search(
    needle: string,
    limits: { titles: number; institutions: number },
  ): Promise<{ titles: TitleDto[]; institutions: InstitutionDto[] }> {
    const [titleRows, institutionRows] = await Promise.all([
      this.kpss.searchTitles(this.db, needle, limits.titles),
      this.kpss.searchInstitutions(this.db, needle, limits.institutions),
    ]);
    return {
      titles: titleRows.map(toTitleDto),
      institutions: institutionRows.map(toInstitutionDto),
    };
  }

  /**
   * Guards the `vision_boards.target_institution_id` write the way the university check guards its
   * YKS counterpart: the ids must exist. Unlike a university there is no city to cross-check —
   * an institution is national, and this round's postings are not a claim about where it operates.
   */
  async assertTargetsExist(
    titleId: string | null,
    institutionId: string | null,
  ): Promise<boolean> {
    const [title, institution] = await Promise.all([
      titleId ? this.kpss.findTitleById(this.db, titleId) : undefined,
      institutionId ? this.kpss.findInstitutionById(this.db, institutionId) : undefined,
    ]);
    return (!titleId || Boolean(title)) && (!institutionId || Boolean(institution));
  }

  /** Stored goal ids → names, for the AI note and the sidebar summary. */
  async resolveNames(
    titleId: string | null,
    institutionId: string | null,
  ): Promise<{ titleName: string | null; institutionName: string | null }> {
    const [title, institution] = await Promise.all([
      titleId ? this.kpss.findTitleById(this.db, titleId) : undefined,
      institutionId ? this.kpss.findInstitutionById(this.db, institutionId) : undefined,
    ]);
    return {
      titleName: title?.name ?? null,
      institutionName: institution?.name ?? null,
    };
  }

  /**
   * Seed entry point — one batched statement per table inside a single SERVICE-context tx.
   *
   * The dataset row is written first because the postings hang off its id. Seeding a second round
   * is therefore additive: a new period file creates a new edition and leaves the earlier one
   * intact, which is what makes the period picker have anything to pick from.
   */
  async seedKpss(input: {
    dataset: Omit<NewReferenceDataset, "examFamily" | "kind">;
    titles: NewTitle[];
    institutions: NewInstitution[];
    postings: (Omit<NewPosting, "titleId" | "institutionId" | "datasetId"> & {
      titleSlug: string;
      institutionSlug: string;
    })[];
  }): Promise<string> {
    return withServiceContext(this.db, async (tx) => {
      const dataset = await this.datasets.upsert(tx, {
        ...input.dataset,
        examFamily: "KPSS",
        kind: KPSS_POSTINGS,
      });

      await this.kpss.upsertTitles(tx, input.titles);
      await this.kpss.upsertInstitutions(tx, input.institutions);
      if (input.postings.length === 0) return dataset.id;

      // Ids only exist after the upserts above, so slugs are resolved here rather than in the seed
      // file — the JSON stays free of database identifiers and survives a wipe-and-reseed.
      const [titleRows, institutionRows] = await Promise.all([
        this.kpss.listTitles(tx),
        this.kpss.listInstitutions(tx),
      ]);
      const titleIdBySlug = new Map(titleRows.map((t) => [t.slug, t.id]));
      const institutionIdBySlug = new Map(
        institutionRows.map((i) => [i.slug, i.id]),
      );

      const postings: NewPosting[] = [];
      for (const { titleSlug, institutionSlug, ...rest } of input.postings) {
        const titleId = titleIdBySlug.get(titleSlug);
        const institutionId = institutionIdBySlug.get(institutionSlug);
        if (!titleId || !institutionId) continue;
        postings.push({ ...rest, titleId, institutionId, datasetId: dataset.id });
      }
      await this.kpss.upsertPostings(tx, postings);
      return dataset.id;
    });
  }
}

function toTitleDto(row: TitleRow): TitleDto {
  return { id: row.id, name: row.name, slug: row.slug };
}

function toInstitutionDto(row: InstitutionRow): InstitutionDto {
  return { id: row.id, name: row.name, slug: row.slug };
}
