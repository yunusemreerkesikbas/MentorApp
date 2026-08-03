import { HttpStatus, Injectable } from "@nestjs/common";
import {
  YKS_SCORE_TYPES,
  type PreferenceProgramSnapshotDto,
  type PreferenceRankProfileDto,
  type PreferenceScenarioDto,
  type PreferenceScenarioItemDto,
  type PreferenceSimulationAccessDto,
  type PreferenceSimulationDto,
  type PreferenceSimulationRefreshResultDto,
  type ProgramCatalogDatasetDto,
  type YksScoreType,
} from "@mentor/types";
import type {
  PutPreferenceSimulationInput,
  RefreshPreferenceSimulationInput,
} from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation } from "../../../common/errors/postgres-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { PreferenceCatalogService } from "../../content/application/preference-catalog.service";
import { UsersService } from "../../identity/application/users.service";
import { comparePreferenceRank } from "../domain/preference-comparison";
import {
  PreferenceScenarioRepository,
  type PreferenceScenarioAggregate,
} from "../infrastructure/preference-scenario.repository";
import { Inject } from "@nestjs/common";

interface PreferenceActor {
  userId: string;
  organizationId: string | null;
}

@Injectable()
export class PreferenceSimulationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly scenarios: PreferenceScenarioRepository,
    private readonly catalog: PreferenceCatalogService,
    private readonly users: UsersService,
    private readonly config: ConfigRegistryService,
  ) {}

  async getAccess(userId: string): Promise<PreferenceSimulationAccessDto> {
    if (!(await this.config.get(FeatureFlag.PREFERENCE_SIMULATION_ENABLED))) {
      return { enabled: false, reason: "FEATURE_DISABLED", dataset: null };
    }
    const profile = await this.users.getDiscoveryProfile(userId);
    if (profile.examType !== "YKS") {
      return { enabled: false, reason: "EXAM_NOT_SUPPORTED", dataset: null };
    }
    const dataset = await this.catalog.getActiveDataset();
    if (!dataset || dataset.officialPreferenceLimit <= 0) {
      return { enabled: false, reason: "DATASET_UNAVAILABLE", dataset: null };
    }
    return { enabled: true, reason: null, dataset };
  }

  async get(actor: PreferenceActor): Promise<PreferenceSimulationDto> {
    const dataset = await this.requireAccess(actor.userId);
    const aggregate = await withUserContext(
      this.db,
      { userId: actor.userId, orgId: actor.organizationId },
      (tx) => this.scenarios.findByUser(tx, actor.userId),
    );
    return this.buildSimulation(dataset, aggregate);
  }

  async put(
    actor: PreferenceActor,
    input: PutPreferenceSimulationInput,
  ): Promise<PreferenceSimulationDto> {
    const dataset = await this.requireAccess(actor.userId);
    if (input.datasetVersion !== dataset.version) {
      throw new DomainError(
        ErrorCode.COACHING_PREFERENCE_DATASET_STALE,
        HttpStatus.CONFLICT,
      );
    }
    if (input.programCodes.length > dataset.officialPreferenceLimit) {
      throw new DomainError(
        ErrorCode.COACHING_PREFERENCE_LIMIT_EXCEEDED,
        HttpStatus.BAD_REQUEST,
      );
    }

    const catalogPrograms = await this.catalog.findProgramSnapshots(
      dataset.version,
      input.programCodes,
    );
    if (catalogPrograms.length !== input.programCodes.length) {
      throw new DomainError(
        ErrorCode.COACHING_PREFERENCE_PROGRAM_INVALID,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      catalogPrograms.some(
        (program) => !YKS_SCORE_TYPES.includes(program.scoreType as YksScoreType),
      )
    ) {
      throw new DomainError(
        ErrorCode.COACHING_PREFERENCE_SCORE_TYPE_MISMATCH,
        HttpStatus.BAD_REQUEST,
      );
    }

    const ranks = this.normalizeRanks(input.ranks);
    const snapshots = catalogPrograms.map((program, index) => ({
      ...program,
      position: index + 1,
    }));

    let aggregate: PreferenceScenarioAggregate;
    try {
      aggregate = await withUserContext(
        this.db,
        { userId: actor.userId, orgId: actor.organizationId },
        async (tx) => {
          const current = await this.scenarios.findByUser(tx, actor.userId);
          if (current && current.scenario.datasetVersion !== dataset.version) {
            throw new DomainError(
              ErrorCode.COACHING_PREFERENCE_DATASET_STALE,
              HttpStatus.CONFLICT,
            );
          }
          if (!current) {
            if (input.expectedRevision !== 0) this.throwRevisionConflict();
            return this.scenarios.create(tx, actor.userId, {
              organizationId: actor.organizationId,
              datasetVersion: dataset.version,
              ranks,
              snapshots,
            });
          }
          if (input.expectedRevision !== current.scenario.revision) {
            this.throwRevisionConflict();
          }
          const updated = await this.scenarios.replace(
            tx,
            actor.userId,
            input.expectedRevision,
            {
              organizationId: actor.organizationId,
              datasetVersion: dataset.version,
              ranks,
              snapshots,
            },
          );
          if (!updated) this.throwRevisionConflict();
          return updated;
        },
      );
    } catch (error) {
      // Two first-save requests can both observe no row; the unique(user_id) belt turns the loser
      // into the same public revision conflict as every other multi-tab race.
      if (isUniqueViolation(error)) this.throwRevisionConflict();
      throw error;
    }
    return this.buildSimulation(dataset, aggregate);
  }

  async refresh(
    actor: PreferenceActor,
    input: RefreshPreferenceSimulationInput,
  ): Promise<PreferenceSimulationRefreshResultDto> {
    const dataset = await this.requireAccess(actor.userId);
    let removedProgramCodes: string[] = [];
    const aggregate = await withUserContext(
      this.db,
      { userId: actor.userId, orgId: actor.organizationId },
      async (tx) => {
        const current = await this.scenarios.findByUser(tx, actor.userId);
        if (!current || current.scenario.revision !== input.expectedRevision) {
          this.throwRevisionConflict();
        }
        const codes = current.items.map((item) => item.programCode);
        const catalogPrograms = await this.catalog.findProgramSnapshots(
          dataset.version,
          codes,
        );
        const available = new Set(catalogPrograms.map((program) => program.code));
        removedProgramCodes = codes.filter((code) => !available.has(code));
        const snapshots = catalogPrograms.map((program, index) => ({
          ...program,
          position: index + 1,
        }));
        const updated = await this.scenarios.replace(
          tx,
          actor.userId,
          input.expectedRevision,
          {
            organizationId: actor.organizationId,
            datasetVersion: dataset.version,
            ranks: this.ranksFromAggregate(current),
            snapshots,
          },
        );
        if (!updated) this.throwRevisionConflict();
        return updated;
      },
    );
    return {
      ...(await this.buildSimulation(dataset, aggregate)),
      removedProgramCodes,
    };
  }

  async delete(actor: PreferenceActor): Promise<void> {
    await this.requireAccess(actor.userId);
    await withUserContext(
      this.db,
      { userId: actor.userId, orgId: actor.organizationId },
      (tx) => this.scenarios.deleteByUser(tx, actor.userId),
    );
  }

  private async buildSimulation(
    dataset: ProgramCatalogDatasetDto,
    aggregate: PreferenceScenarioAggregate | undefined,
  ): Promise<PreferenceSimulationDto> {
    if (!aggregate) {
      return { dataset, scenario: null, stale: false, refreshSummary: null };
    }
    const stale = aggregate.scenario.datasetVersion !== dataset.version;
    let refreshSummary = null;
    if (stale) {
      const codes = aggregate.items.map((item) => item.programCode);
      const available = await this.catalog.findProgramSnapshots(dataset.version, codes);
      const availableCodes = new Set(available.map((program) => program.code));
      refreshSummary = {
        updateableProgramCodes: codes.filter((code) => availableCodes.has(code)),
        removableProgramCodes: codes.filter((code) => !availableCodes.has(code)),
      };
    }
    return {
      dataset,
      scenario: this.toScenarioDto(aggregate),
      stale,
      refreshSummary,
    };
  }

  private toScenarioDto(aggregate: PreferenceScenarioAggregate): PreferenceScenarioDto {
    const ranks = this.ranksFromAggregate(aggregate);
    const items: PreferenceScenarioItemDto[] = aggregate.items.map((item) => {
      const snapshot: PreferenceProgramSnapshotDto = {
        position: item.position,
        code: item.programCode,
        name: item.programName,
        faculty: item.faculty,
        level: item.level as PreferenceProgramSnapshotDto["level"],
        scoreType: item.scoreType as YksScoreType,
        quota: item.quota,
        guideYear: item.guideYear,
        placementYear: item.placementYear,
        successRank: item.successRank,
        universityId: item.universityId,
        universityName: item.universityName,
        cityCode: item.cityCode,
        cityName: item.cityName,
        source: item.source,
        sourceUrl: item.sourceUrl,
        verifiedAt: item.verifiedAt.toISOString(),
      };
      return {
        snapshot,
        comparison: comparePreferenceRank(ranks[snapshot.scoreType], snapshot.successRank),
      };
    });
    return {
      id: aggregate.scenario.id,
      datasetVersion: aggregate.scenario.datasetVersion,
      ranks,
      revision: aggregate.scenario.revision,
      createdAt: aggregate.scenario.createdAt.toISOString(),
      updatedAt: aggregate.scenario.updatedAt.toISOString(),
      items,
    };
  }

  private ranksFromAggregate(
    aggregate: PreferenceScenarioAggregate,
  ): PreferenceRankProfileDto {
    return {
      SAY: aggregate.scenario.rankSay,
      EA: aggregate.scenario.rankEa,
      SÖZ: aggregate.scenario.rankSoz,
      DİL: aggregate.scenario.rankDil,
      TYT: aggregate.scenario.rankTyt,
    };
  }

  private normalizeRanks(
    ranks: PutPreferenceSimulationInput["ranks"],
  ): PreferenceRankProfileDto {
    return {
      SAY: ranks.SAY ?? null,
      EA: ranks.EA ?? null,
      SÖZ: ranks.SÖZ ?? null,
      DİL: ranks.DİL ?? null,
      TYT: ranks.TYT ?? null,
    };
  }

  private async requireAccess(userId: string): Promise<ProgramCatalogDatasetDto> {
    const access = await this.getAccess(userId);
    if (access.enabled && access.dataset) return access.dataset;
    const mapping = {
      FEATURE_DISABLED: ErrorCode.COACHING_PREFERENCE_SIMULATION_DISABLED,
      EXAM_NOT_SUPPORTED: ErrorCode.COACHING_PREFERENCE_EXAM_NOT_SUPPORTED,
      DATASET_UNAVAILABLE: ErrorCode.CONTENT_PROGRAM_DATASET_UNAVAILABLE,
    } as const;
    const status = access.reason === "DATASET_UNAVAILABLE"
      ? HttpStatus.SERVICE_UNAVAILABLE
      : HttpStatus.FORBIDDEN;
    throw new DomainError(mapping[access.reason!], status);
  }

  private throwRevisionConflict(): never {
    throw new DomainError(ErrorCode.SCENARIO_REVISION_CONFLICT, HttpStatus.CONFLICT);
  }
}
