/** Official YKS score families accepted by the preference comparison. */
export const YKS_SCORE_TYPES = ["SAY", "EA", "SÖZ", "DİL", "TYT"] as const;
export type YksScoreType = (typeof YKS_SCORE_TYPES)[number];

export interface ProgramCatalogDatasetDto {
  version: string;
  examType: "YKS";
  guideYear: number;
  placementYear: number;
  officialPreferenceLimit: number;
  source: string;
  sourceUrl: string;
  verifiedAt: string;
}

export interface ProgramCatalogSearchItemDto {
  code: string;
  name: string;
  faculty: string;
  level: "LISANS" | "ONLISANS";
  scoreType: YksScoreType;
  quota: number;
  guideYear: number;
  placementYear: number;
  successRank: number | null;
  universityId: string;
  universityName: string;
  cityCode: string;
  cityName: string;
}

export interface ProgramCatalogSearchResponseDto {
  dataset: ProgramCatalogDatasetDto;
  items: ProgramCatalogSearchItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProgramCatalogSnapshotDto
  extends ProgramCatalogSearchItemDto {
  source: string;
  sourceUrl: string;
  verifiedAt: string;
}

export type CampusCoverageStatus =
  | "PHOTOREALISTIC"
  | "TERRAIN_ONLY"
  | "UNKNOWN";
export type CampusRenderMode = "PHOTOREALISTIC" | "HYBRID";

export interface CampusCameraPresetDto {
  center: { lat: number; lng: number; altitude: number };
  heading: number;
  tilt: number;
  range: number;
}

export interface CampusPoiDto {
  id: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  position: number;
  camera: CampusCameraPresetDto;
  sourceUrl: string;
  verifiedAt: string;
}

export interface CampusExperienceDto {
  id: string;
  universityId: string;
  universityName: string;
  coverageStatus: CampusCoverageStatus;
  renderMode: CampusRenderMode;
  initialCamera: CampusCameraPresetDto;
  source: string;
  sourceUrl: string;
  verifiedAt: string;
  pois: CampusPoiDto[];
}

export type PreferenceSimulationAccessReason =
  | "FEATURE_DISABLED"
  | "EXAM_NOT_SUPPORTED"
  | "DATASET_UNAVAILABLE";

export interface PreferenceSimulationAccessDto {
  enabled: boolean;
  reason: PreferenceSimulationAccessReason | null;
  dataset: ProgramCatalogDatasetDto | null;
}

export interface PreferenceRankProfileDto {
  SAY: number | null;
  EA: number | null;
  SÖZ: number | null;
  DİL: number | null;
  TYT: number | null;
}

export interface PreferenceProgramSnapshotDto
  extends ProgramCatalogSnapshotDto {
  position: number;
}

export type PreferenceComparisonDto =
  | {
      status: "COMPARED";
      userRank: number;
      cutoffRank: number;
      delta: number;
      direction: "AHEAD" | "BEHIND" | "EQUAL";
    }
  | {
      status: "NOT_COMPARABLE";
      reason: "MISSING_USER_RANK" | "MISSING_PLACEMENT_RANK";
      userRank: number | null;
      cutoffRank: number | null;
      delta: null;
      direction: null;
    };

export interface PreferenceScenarioItemDto {
  snapshot: PreferenceProgramSnapshotDto;
  comparison: PreferenceComparisonDto;
}

export interface PreferenceScenarioDto {
  id: string;
  datasetVersion: string;
  ranks: PreferenceRankProfileDto;
  revision: number;
  createdAt: string;
  updatedAt: string;
  items: PreferenceScenarioItemDto[];
}

export interface PreferenceRefreshSummaryDto {
  updateableProgramCodes: string[];
  removableProgramCodes: string[];
}

export interface PreferenceSimulationDto {
  dataset: ProgramCatalogDatasetDto;
  scenario: PreferenceScenarioDto | null;
  stale: boolean;
  refreshSummary: PreferenceRefreshSummaryDto | null;
}

export interface PreferenceSimulationRefreshResultDto
  extends PreferenceSimulationDto {
  removedProgramCodes: string[];
}
