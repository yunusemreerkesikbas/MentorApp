import { Inject, Injectable } from "@nestjs/common";
import type {
  InstitutionDto,
  KpssPostingDto,
  KpssTargetsDto,
  TitleDto,
} from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  KpssRepository,
  type InstitutionRow,
  type NewInstitution,
  type NewPosting,
  type NewTitle,
  type TitleRow,
} from "../infrastructure/kpss.repository";

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
  ) {}

  /**
   * Everything the KPSS goal screen needs in one read (~130 rows of reference data plus 81 city
   * counts). Postings themselves are NOT included — 1.1k rows nobody has asked for yet; they load
   * per province when a city is opened.
   */
  async getTargets(): Promise<KpssTargetsDto> {
    const [titleRows, institutionRows, counts, meta] = await Promise.all([
      this.kpss.listTitles(this.db),
      this.kpss.listInstitutions(this.db),
      this.kpss.countPostingsByCity(this.db),
      this.kpss.findLatestRound(this.db),
    ]);

    return {
      titles: titleRows.map(toTitleDto),
      institutions: institutionRows.map(toInstitutionDto),
      cityPostings: counts.map((c) => ({
        cityCode: c.cityCode,
        postings: c.postings,
        quota: c.quota,
      })),
      round: meta?.round ?? null,
      source: meta
        ? {
            source: meta.source,
            sourceUrl: meta.sourceUrl,
            verifiedAt: meta.verifiedAt.toISOString(),
          }
        : null,
    };
  }

  async getCityPostings(cityCode: string): Promise<KpssPostingDto[]> {
    const rows = await this.kpss.listPostingsByCity(this.db, cityCode);
    return rows.map((r) => ({
      osymCode: r.osymCode,
      round: r.round,
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

  /** Seed entry point — one batched statement per table inside a single SERVICE-context tx. */
  async seedKpss(input: {
    titles: NewTitle[];
    institutions: NewInstitution[];
    postings: (Omit<NewPosting, "titleId" | "institutionId"> & {
      titleSlug: string;
      institutionSlug: string;
    })[];
  }): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await this.kpss.upsertTitles(tx, input.titles);
      await this.kpss.upsertInstitutions(tx, input.institutions);
      if (input.postings.length === 0) return;

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
        postings.push({ ...rest, titleId, institutionId });
      }
      await this.kpss.upsertPostings(tx, postings);
    });
  }
}

function toTitleDto(row: TitleRow): TitleDto {
  return { id: row.id, name: row.name, slug: row.slug };
}

function toInstitutionDto(row: InstitutionRow): InstitutionDto {
  return { id: row.id, name: row.name, slug: row.slug };
}
