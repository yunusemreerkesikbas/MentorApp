import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type {
  CampusCameraPresetDto,
  CampusExperienceDto,
  ProgramCatalogDatasetDto,
  ProgramCatalogSearchItemDto,
  ProgramCatalogSearchResponseDto,
  ProgramCatalogSnapshotDto,
  YksScoreType,
} from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import {
  PreferenceCatalogRepository,
  type CampusExperienceRow,
  type ProgramCatalogDatasetRow,
  type ProgramCatalogRow,
} from "../infrastructure/preference-catalog.repository";

@Injectable()
export class PreferenceCatalogService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repository: PreferenceCatalogRepository,
  ) {}

  async getActiveDataset(): Promise<ProgramCatalogDatasetDto | null> {
    const row = await this.repository.findActiveDataset(this.db);
    return row ? this.toDatasetDto(row) : null;
  }

  async search(
    query: string,
    page: number,
    pageSize: number,
    scoreType?: YksScoreType,
  ): Promise<ProgramCatalogSearchResponseDto> {
    const dataset = await this.requireActiveDataset();
    const result = await this.repository.searchPrograms(
      this.db,
      dataset,
      this.foldTurkish(query.trim()),
      scoreType,
      page,
      pageSize,
    );
    return {
      dataset: this.toDatasetDto(dataset),
      items: result.rows.map((row) => this.toProgramDto(row)),
      total: result.total,
      page,
      pageSize,
    };
  }

  /** Public content boundary used by coaching; returned rows preserve the caller's order. */
  async findProgramSnapshots(
    datasetVersion: string,
    programCodes: string[],
  ): Promise<ProgramCatalogSnapshotDto[]> {
    const dataset = await this.requireActiveDataset();
    if (dataset.version !== datasetVersion) return [];
    const rows = await this.repository.findProgramsByCodes(
      this.db,
      dataset,
      programCodes,
    );
    const byCode = new Map(
      rows.map((row) => [
        row.code,
        {
          ...this.toProgramDto(row),
          source: row.source,
          sourceUrl: row.sourceUrl,
          verifiedAt: row.verifiedAt.toISOString(),
        },
      ]),
    );
    return programCodes.flatMap((code) => {
      const program = byCode.get(code);
      return program ? [program] : [];
    });
  }

  async getCampusExperience(
    universityId: string,
    locale: string,
  ): Promise<CampusExperienceDto> {
    const row = await this.repository.findCampusExperience(this.db, universityId);
    if (!row) {
      throw new DomainError(
        ErrorCode.CONTENT_CAMPUS_EXPERIENCE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    const english = locale.toLowerCase().startsWith("en");
    return {
      id: row.experience.id,
      universityId: row.experience.universityId,
      universityName: row.universityName,
      coverageStatus: row.experience.coverageStatus as CampusExperienceDto["coverageStatus"],
      renderMode: row.experience.renderMode as CampusExperienceDto["renderMode"],
      initialCamera: this.toCamera(row.experience, "initial"),
      source: row.experience.source,
      sourceUrl: row.experience.sourceUrl,
      verifiedAt: row.experience.verifiedAt.toISOString(),
      pois: row.pois.map((poi) => ({
        id: poi.id,
        slug: poi.slug,
        category: poi.category,
        title: english ? poi.titleEn : poi.titleTr,
        summary: english ? poi.summaryEn : poi.summaryTr,
        position: poi.position,
        camera: {
          center: {
            lat: Number(poi.latitude),
            lng: Number(poi.longitude),
            altitude: Number(poi.altitude),
          },
          heading: Number(poi.heading),
          tilt: Number(poi.tilt),
          range: Number(poi.range),
        },
        sourceUrl: poi.sourceUrl,
        verifiedAt: poi.verifiedAt.toISOString(),
      })),
    };
  }

  private async requireActiveDataset(): Promise<ProgramCatalogDatasetRow> {
    const dataset = await this.repository.findActiveDataset(this.db);
    if (!dataset) {
      throw new DomainError(
        ErrorCode.CONTENT_PROGRAM_DATASET_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return dataset;
  }

  private toDatasetDto(row: ProgramCatalogDatasetRow): ProgramCatalogDatasetDto {
    return {
      version: row.version,
      examType: "YKS",
      guideYear: row.guideYear,
      placementYear: row.placementYear,
      officialPreferenceLimit: row.officialPreferenceLimit,
      source: row.source,
      sourceUrl: row.sourceUrl,
      verifiedAt: row.verifiedAt.toISOString(),
    };
  }

  private toProgramDto(row: ProgramCatalogRow): ProgramCatalogSearchItemDto {
    return {
      code: row.code,
      name: row.name,
      faculty: row.faculty,
      level: row.level as ProgramCatalogSearchItemDto["level"],
      scoreType: row.scoreType as YksScoreType,
      quota: row.quota,
      guideYear: row.guideYear,
      placementYear: row.placementYear,
      successRank: row.successRank,
      universityId: row.universityId,
      universityName: row.universityName,
      cityCode: row.cityCode,
      cityName: row.cityName,
    };
  }

  private toCamera(
    experience: CampusExperienceRow["experience"],
    prefix: "initial",
  ): CampusCameraPresetDto {
    return {
      center: {
        lat: Number(experience[`${prefix}Latitude`]),
        lng: Number(experience[`${prefix}Longitude`]),
        altitude: Number(experience[`${prefix}Altitude`]),
      },
      heading: Number(experience[`${prefix}Heading`]),
      tilt: Number(experience[`${prefix}Tilt`]),
      range: Number(experience[`${prefix}Range`]),
    };
  }

  private foldTurkish(value: string): string {
    const map: Record<string, string> = {
      ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", I: "i", İ: "i",
      ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
    };
    return [...value].map((character) => map[character] ?? character).join("").toLowerCase();
  }
}
